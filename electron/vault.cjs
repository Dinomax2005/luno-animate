const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { decodeLam, encodeLam, projectRecord, MAX_LAM_BYTES } = require('./lib/core.cjs');
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
const RESERVED = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf']);
function checkId(id) { if (typeof id !== 'string' || !SAFE_ID.test(id) || RESERVED.has(id)) throw new Error('Invalid project identifier.'); return id; }
function checkBytes(bytes) { if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_LAM_BYTES) throw new Error('Invalid or oversized project data.'); return bytes; }
function validateSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Invalid studio settings.');
  if (settings.lastProjectId !== null) checkId(settings.lastProjectId);
  const p = settings.preferences;
  if (p !== undefined) {
    if (!p || typeof p !== 'object' || Array.isArray(p) || !['light', 'dark'].includes(p.theme)) throw new Error('Invalid studio preferences.');
    const bools = ['onboardingComplete', 'showBones', 'showGrid', 'loop', 'autoKey', 'onionSkin', 'showMotionPath', 'snapToGrid', 'inverseKinematics', 'automaticUpdates'];
    if (bools.some(k => typeof p[k] !== 'boolean') || !['vector', 'cel'].includes(p.drawingMode) || !/^#[a-f0-9]{6}$/i.test(p.brushColor)) throw new Error('Invalid studio preferences.');
    for (const key of ['brushSize', 'gridSize', 'onionBefore', 'onionAfter']) if (!Number.isFinite(p[key]) || p[key] < (key.startsWith('onion') ? 0 : 1) || p[key] > (key.startsWith('onion') ? 5 : 100)) throw new Error('Invalid studio preferences.');
  }
  return { lastProjectId: settings.lastProjectId, ...(p ? { preferences: p } : {}) };
}
async function atomicWrite(file, data, beforeCommit, mode = 0o600) {
  const temp = `${file}.${randomUUID()}.tmp`; let handle;
  try {
    await fs.mkdir(path.dirname(file), { recursive: true }); handle = await fs.open(temp, 'wx', mode);
    await handle.writeFile(data); await handle.chmod(mode); await handle.sync(); await handle.close(); handle = null; await beforeCommit?.(); await fs.rename(temp, file);
    // Sync directory entries on systems that support it (Windows does not).
    let directory; try { directory = await fs.open(path.dirname(file), 'r'); await directory.sync(); } catch (e) { if (!['EINVAL', 'EPERM', 'EISDIR', 'ENOTSUP', 'EBADF', 'EACCES'].includes(e.code)) throw e; } finally { await directory?.close(); }
  } finally { await handle?.close().catch(() => {}); await fs.rm(temp, { force: true }).catch(() => {}); }
}
async function boundedRead(file, limit = MAX_LAM_BYTES) { const stat = await fs.lstat(file); if (!stat.isFile() || stat.size > limit) throw new Error('This file is too large or is not a regular file.'); return fs.readFile(file); }
async function syncDirectory(folder) {
  let handle; try { handle = await fs.open(folder, 'r'); await handle.sync(); }
  catch (e) { if (!['EINVAL', 'EPERM', 'EISDIR', 'ENOTSUP', 'EBADF', 'EACCES'].includes(e.code)) throw e; }
  finally { await handle?.close(); }
}
async function syncTree(folder) {
  for (const file of await fs.readdir(folder, { withFileTypes: true })) {
    const name = path.join(folder, file.name);
    if (file.isDirectory()) await syncTree(name);
    else if (file.isFile()) { const handle = await fs.open(name, 'r+'); try { await handle.sync(); } finally { await handle.close(); } }
    else throw new Error('A library backup cannot contain symbolic links or special files.');
  }
  await syncDirectory(folder);
}
function validateWorkspace(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (value.folder !== null && (typeof value.folder !== 'string' || value.folder.length > 4096))) throw new Error('Invalid workspace settings.');
  return { folder: value.folder };
}
async function optionalJson(file, validate) { try { return validate(JSON.parse(await boundedRead(file, 50_000))); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
async function restoreOptional(file, value) { if (value === null) { await fs.rm(file, { force: true }); await syncDirectory(path.dirname(file)); } else await atomicWrite(file, JSON.stringify(value)); }
function publicRecord(entry) { const { file: _file, ...record } = entry; return record; }
function validEntry(entry, id) {
  if (!entry || entry.id !== id || typeof entry.file !== 'string' || !/^[0-9]+-[a-f0-9-]+\.lam$/.test(entry.file)) throw new Error('The library index is damaged. Prior saves are retained.');
  return entry;
}
class ProjectVault {
  constructor(userData, version) { this.root = path.join(userData, 'library'); this.projects = path.join(this.root, 'projects'); this.backupRoot = path.join(userData, 'work-backups'); this.settingsFile = path.join(userData, 'studio-settings.json'); this.workspaceFile = path.join(userData, 'workspace.json'); this.version = version; this.initialization = this.recoverInterruptedRestore(); this.initialization.catch(() => {}); this.queue = Promise.resolve(); }
  async recoverInterruptedRestore() {
    await fs.mkdir(this.projects, { recursive: true });
    const journalFile = path.join(this.root, 'restore-journal.json'); let journal;
    try { journal = JSON.parse(await boundedRead(journalFile, 100_000)); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    if (!/^restore-[a-f0-9-]+$/.test(journal.staged) || !/^before-restore-[a-f0-9-]+$/.test(journal.rollback)) throw new Error('The restore journal is damaged. Your backups have been retained.');
    if (Object.hasOwn(journal, 'settings') && journal.settings !== null) validateSettings(journal.settings);
    if (Object.hasOwn(journal, 'workspace') && journal.workspace !== null) validateWorkspace(journal.workspace);
    const rollback = path.join(this.root, journal.rollback);
    try { await fs.stat(rollback); await fs.rm(this.projects, { recursive: true, force: true }); await fs.rename(rollback, this.projects); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (Object.hasOwn(journal, 'settings')) await restoreOptional(this.settingsFile, journal.settings === null ? null : validateSettings(journal.settings));
    if (Object.hasOwn(journal, 'workspace')) await restoreOptional(this.workspaceFile, journal.workspace === null ? null : validateWorkspace(journal.workspace));
    await syncDirectory(this.root);
    await fs.rm(journalFile, { force: true }); await syncDirectory(this.root);
    await fs.rm(path.join(this.root, journal.staged), { recursive: true, force: true });
  }
  serial(action) { const result = this.queue.then(async () => { await this.initialization; return action(); }); this.queue = result.catch(() => {}); return result; }
  async flush() { await this.initialization; await this.queue; }
  folder(id) { return path.join(this.projects, checkId(id)); }
  async entry(id) { return validEntry(JSON.parse(await boundedRead(path.join(this.folder(id), 'entry.json'), 2_000_000)), id); }
  async listUnsafe() {
    await fs.mkdir(this.projects, { recursive: true }); const result = [];
    for (const dir of await fs.readdir(this.projects, { withFileTypes: true })) {
      if (!dir.isDirectory() || !SAFE_ID.test(dir.name)) continue;
      try { result.push(publicRecord(await this.entry(dir.name))); } catch { /* Damaged entries are recovered below, not silently discarded. */
        const files = (await fs.readdir(this.folder(dir.name))).filter(f => /^[0-9]+-[a-f0-9-]+\.lam$/.test(f)).sort((a, b) => Number(b.split('-')[0]) - Number(a.split('-')[0]));
        for (const file of files) { try { const project = decodeLam(await boundedRead(path.join(this.folder(dir.name), file))); if (project.id !== dir.name) continue; const record = projectRecord(project); result.push({ ...record, name: `${record.name} (recovery needed)`, thumbnail: null }); break; } catch { /* Retain every file for manual recovery. */ } }
      }
    }
    return result;
  }
  list() { return this.serial(() => this.listUnsafe()); }
  async loadUnsafe(id) { const entry = await this.entry(id); const bytes = await boundedRead(path.join(this.folder(id), entry.file)); if (decodeLam(bytes).id !== id) throw new Error('Project integrity mismatch.'); return bytes; }
  load(id) { return this.serial(() => this.loadUnsafe(id)); }
  async writeUnsafe(project, bytes, thumbnail, previous) {
    const folder = this.folder(project.id); await fs.mkdir(folder, { recursive: true });
    const existing = (await fs.readdir(folder)).filter(f => /^[0-9]+-[a-f0-9-]+\.lam$/.test(f));
    const previousTime = Math.max(0, ...existing.map(f => Number(f.split('-')[0])).filter(Number.isSafeInteger));
    const file = `${Math.max(Date.now(), previousTime + 1)}-${randomUUID()}.lam`; const record = projectRecord(project, previous, thumbnail);
    if (record.thumbnail && (typeof record.thumbnail !== 'string' || record.thumbnail.length > 1_500_000 || !/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(record.thumbnail))) throw new Error('Invalid project preview.');
    // Append a complete immutable revision, then atomically move the index pointer. A crash cannot truncate the current document.
    await atomicWrite(path.join(folder, file), bytes); await atomicWrite(path.join(folder, 'entry.json'), JSON.stringify({ ...record, file }));
    const files = (await fs.readdir(folder)).filter(f => /^[0-9]+-[a-f0-9-]+\.lam$/.test(f)).sort((a, b) => Number(b.split('-')[0]) - Number(a.split('-')[0]));
    for (const old of files.slice(4)) await fs.rm(path.join(folder, old), { force: true }).catch(() => {});
    return record;
  }
  save(input, thumbnail) {
    const bytes = checkBytes(input); const project = decodeLam(bytes);
    return this.serial(async () => { let previous; try { previous = publicRecord(await this.entry(project.id)); } catch (e) { if (e.code !== 'ENOENT') throw e; } return this.writeUnsafe(project, bytes, thumbnail, previous); });
  }
  patch(id, patch) {
    checkId(id); if (!patch || typeof patch !== 'object' || Object.keys(patch).some(k => !['name', 'starred', 'deletedAt'].includes(k))) throw new Error('Invalid project metadata.');
    if (patch.starred !== undefined && typeof patch.starred !== 'boolean') throw new Error('Invalid favorite setting.');
    if (patch.deletedAt !== undefined && patch.deletedAt !== null && (!Number.isSafeInteger(patch.deletedAt) || patch.deletedAt < 0)) throw new Error('Invalid trash timestamp.');
    return this.serial(async () => {
      const entry = await this.entry(id);
      if (patch.name !== undefined) {
        if (typeof patch.name !== 'string' || !patch.name.trim()) throw new Error('Please give your project a name.');
        const project = { ...decodeLam(await this.loadUnsafe(id)), name: patch.name.trim().slice(0, 100) };
        await this.writeUnsafe(project, encodeLam(project), undefined, { ...publicRecord(entry), ...patch });
      } else await atomicWrite(path.join(this.folder(id), 'entry.json'), JSON.stringify({ ...entry, ...patch }));
    });
  }
  deleteForever(id) { return this.serial(async () => { const entry = await this.entry(checkId(id)); if (!entry.deletedAt) throw new Error('Move the project to Trash first.'); await fs.rm(this.folder(id), { recursive: true, force: true }); }); }
  recover(id) {
    return this.serial(async () => {
      const folder = this.folder(id); let entry; try { entry = await this.entry(id); } catch { /* Scan retained revisions when the pointer is damaged. */ }
      const files = (await fs.readdir(folder)).filter(f => /^[0-9]+-[a-f0-9-]+\.lam$/.test(f) && f !== entry?.file).sort((a, b) => Number(b.split('-')[0]) - Number(a.split('-')[0]));
      for (const file of files) { let project, bytes; try { bytes = await boundedRead(path.join(folder, file)); project = decodeLam(bytes); if (project.id !== id) continue; } catch { continue; } await this.writeUnsafe(project, bytes, undefined, entry ? publicRecord(entry) : undefined); return bytes; }
      throw new Error('No readable prior save is available. Your existing files have not been removed.');
    });
  }
  async settingsUnsafe() { try { return validateSettings(JSON.parse(await boundedRead(this.settingsFile, 50_000))); } catch (e) { if (e.code === 'ENOENT') return { lastProjectId: null }; throw e; } }
  getSettings() { return this.serial(() => this.settingsUnsafe()); }
  saveSettings(settings) { const validated = validateSettings(settings); return this.serial(() => atomicWrite(this.settingsFile, JSON.stringify(validated))); }
  async backupsUnsafe() {
    await fs.mkdir(this.backupRoot, { recursive: true }); const result = [];
    for (const dir of await fs.readdir(this.backupRoot, { withFileTypes: true })) if (dir.isDirectory() && SAFE_ID.test(dir.name)) {
      try { const info = JSON.parse(await boundedRead(path.join(this.backupRoot, dir.name, 'manifest.json'), 50_000)); if (info.id === dir.name && Number.isSafeInteger(info.createdAt)) result.push(info); } catch { /* An incomplete backup is never offered for restore. */ }
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }
  backups() { return this.serial(() => this.backupsUnsafe()); }
  async backupUnsafe(reason) {
    await fs.mkdir(this.projects, { recursive: true }); const records = [];
    // Do not silently omit a damaged project from a supposedly complete backup.
    for (const folder of await fs.readdir(this.projects, { withFileTypes: true })) {
      if (!folder.isDirectory()) throw new Error('The project library contains an unexpected entry. Update installation was blocked.');
      const entry = await this.entry(checkId(folder.name)); await this.loadUnsafe(folder.name); records.push(publicRecord(entry));
    }
    await optionalJson(this.settingsFile, validateSettings); await optionalJson(this.workspaceFile, validateWorkspace);
    const id = `${Date.now()}-${randomUUID()}`; const folder = path.join(this.backupRoot, id); const temporary = `${folder}.incomplete`;
    await fs.mkdir(temporary, { recursive: true });
    try {
      await fs.cp(this.projects, path.join(temporary, 'projects'), { recursive: true, errorOnExist: true, force: false });
      for (const [source, name] of [[this.settingsFile, 'studio-settings.json'], [this.workspaceFile, 'workspace.json']]) { try { await fs.copyFile(source, path.join(temporary, name)); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
      // Re-read copied documents: low disk space and interrupted copies must block installation.
      for (const record of records) { const entry = await this.entry(record.id); const copiedFile = path.join(temporary, 'projects', record.id, entry.file); const copied = decodeLam(await boundedRead(copiedFile)); if (copied.id !== record.id) throw new Error('Backup verification failed.'); }
      const info = { id, createdAt: Date.now(), reason, version: this.version, projects: records.length };
      await atomicWrite(path.join(temporary, 'manifest.json'), JSON.stringify(info)); await syncTree(temporary); await fs.rename(temporary, folder); await syncDirectory(this.backupRoot);
      for (const old of (await this.backupsUnsafe()).filter(b => b.id !== id).slice(4)) await fs.rm(path.join(this.backupRoot, old.id), { recursive: true, force: true }).catch(() => {});
      return info;
    } catch (e) { await fs.rm(temporary, { recursive: true, force: true }).catch(() => {}); throw e; }
  }
  backup(reason = 'manual') { return this.serial(() => this.backupUnsafe(reason)); }
  restore(id) {
    checkId(id);
    return this.serial(async () => {
      const info = (await this.backupsUnsafe()).find(b => b.id === id); if (!info) throw new Error('This backup could not be found.');
      const source = path.join(this.backupRoot, id); const staged = path.join(this.root, `restore-${randomUUID()}`);
      const rollback = path.join(this.root, `before-restore-${randomUUID()}`);
      // Stage and validate before touching the current library, including all settings.
      let committed = false;
      try {
        await fs.cp(path.join(source, 'projects'), staged, { recursive: true, errorOnExist: true, force: false });
        const folders = await fs.readdir(staged, { withFileTypes: true });
        if (folders.length !== info.projects) throw new Error('The backup project count is incomplete.');
        for (const folder of folders) { if (!folder.isDirectory()) throw new Error('Invalid backup entry.'); checkId(folder.name); const entry = validEntry(JSON.parse(await boundedRead(path.join(staged, folder.name, 'entry.json'), 2_000_000)), folder.name); if (decodeLam(await boundedRead(path.join(staged, folder.name, entry.file))).id !== folder.name) throw new Error('Backup integrity mismatch.'); }
        const restoredSettings = await optionalJson(path.join(source, 'studio-settings.json'), validateSettings);
        const restoredWorkspace = await optionalJson(path.join(source, 'workspace.json'), validateWorkspace);
        const currentSettings = await optionalJson(this.settingsFile, validateSettings);
        const currentWorkspace = await optionalJson(this.workspaceFile, validateWorkspace);
        await syncTree(staged); await this.backupUnsafe('before-restore');
        await atomicWrite(path.join(this.root, 'restore-journal.json'), JSON.stringify({ staged: path.basename(staged), rollback: path.basename(rollback), settings: currentSettings, workspace: currentWorkspace }));
        try {
          await fs.rename(this.projects, rollback); await syncDirectory(this.root);
          await fs.rename(staged, this.projects); await syncDirectory(this.root);
          await restoreOptional(this.settingsFile, restoredSettings); await restoreOptional(this.workspaceFile, restoredWorkspace);
          // Removing this durable journal commits the entire restore. An interruption before this rolls back on startup.
          await fs.rm(path.join(this.root, 'restore-journal.json')); await syncDirectory(this.root); committed = true;
        } catch (error) { await this.recoverInterruptedRestore(); throw error; }
        await fs.rm(rollback, { recursive: true, force: true }).catch(() => {}); return true;
      } finally { if (committed || !await fs.stat(path.join(this.root, 'restore-journal.json')).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; })) await fs.rm(staged, { recursive: true, force: true }).catch(() => {}); }

    });
  }
}
module.exports = { ProjectVault, atomicWrite, boundedRead, checkId, validateSettings, validateWorkspace };
