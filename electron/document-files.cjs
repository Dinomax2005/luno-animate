const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { decodeLam, readProjectData, MAX_LAM_BYTES } = require('./lib/core.cjs');
const { atomicWrite, boundedRead } = require('./vault.cjs');

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/** Only main-process approved picker/association paths can become writable capabilities. */
class DocumentFiles {
  constructor(userData, write = atomicWrite) { this.userData = userData; this.write = write; this.targets = new Map(); this.queue = Promise.resolve(); }
  serial(action) { const result = this.queue.then(action); this.queue = result.catch(() => {}); return result; }
  async canonical(file) {
    const absolute = path.resolve(file), parent = await fs.realpath(path.dirname(absolute));
    return path.join(parent, path.basename(absolute));
  }
  async isProtected(file) {
    const root = await fs.realpath(this.userData).catch(() => path.resolve(this.userData));
    const relative = path.relative(root, file);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  }
  publicTarget(token, target) { return { token, name: path.basename(target.path), displayPath: target.path, documentId: target.documentId }; }
  async snapshot(file) {
    const info = await fs.lstat(file);
    if (!info.isFile()) throw new Error('Save cannot replace a symbolic link or a special file. Use Save As.');
    const bytes = await boundedRead(file, MAX_LAM_BYTES);
    return { hash: digest(bytes), dev: info.dev, ino: info.ino, size: info.size, mtime: info.mtimeMs, mode: info.mode & 0o777 };
  }
  async open(file) {
    return this.serial(async () => {
      const canonical = await this.canonical(file), data = await boundedRead(canonical, MAX_LAM_BYTES);
      const lam = path.extname(canonical).toLowerCase() === '.lam', project = lam ? decodeLam(data) : readProjectData(data);
      if (!lam || await this.isProtected(canonical)) return { data, filename: path.basename(canonical), target: null };
      const before = await this.snapshot(canonical);
      if (before.hash !== digest(data)) throw new Error('The file changed while opening. Please open it again.');
      const token = randomUUID(), target = { path: canonical, documentId: project.id, snapshot: before };
      this.targets.set(token, target);
      return { data, filename: path.basename(canonical), target: this.publicTarget(token, target) };
    });
  }
  async unchanged(target) {
    if (await this.canonical(target.path) !== target.path) throw new Error('The file location changed. Reopen it or use Save As.');
    let current;
    try { current = await this.snapshot(target.path); }
    catch (error) { if (error.code === 'ENOENT') throw new Error('The opened file was moved or deleted. Use Save As to choose a destination.'); throw error; }
    if (current.hash !== target.snapshot.hash || current.dev !== target.snapshot.dev || current.ino !== target.snapshot.ino || current.size !== target.snapshot.size || current.mtime !== target.snapshot.mtime) throw new Error('The opened file changed on disk. Reopen it or use Save As; the external changes were not overwritten.');
    if (process.platform !== 'win32' && !(current.mode & 0o222)) throw new Error('The opened file is read-only. Use Save As.');
    await fs.access(target.path, fs.constants.W_OK);
    if (await this.isProtected(target.path)) throw new Error('Save cannot replace internal library revisions or backups. Use Save As outside application data.');
    return current;
  }
  validate(data) {
    if (!(data instanceof Uint8Array) || data.byteLength > MAX_LAM_BYTES) throw new Error('Choose a valid .lam document smaller than 64 MB.');
    return decodeLam(data);
  }
  capture(input) {
    if (!(input instanceof Uint8Array) || input.byteLength > MAX_LAM_BYTES) throw new Error('Choose a valid .lam document smaller than 64 MB.');
    const data = Buffer.from(input); return { data, project: this.validate(data) };
  }
  save(token, input) {
    const { project, data } = this.capture(input);
    return this.serial(async () => {
      const target = this.targets.get(token);
      if (!target) throw new Error('This file is not authorized for saving. Open it again or use Save As.');
      if (project.id !== target.documentId) throw new Error('This save belongs to another document. Use Save As.');
      const current = await this.unchanged(target);
      await this.write(target.path, data, () => this.unchanged(target), current.mode);
      const after = await this.snapshot(target.path);
      if (after.hash !== digest(data)) throw new Error('The saved file could not be verified. Keep your library copy and use Save As.');
      target.snapshot = after;
      return this.publicTarget(token, target);
    });
  }
  saveAs(file, input) {
    const { project, data } = this.capture(input);
    return this.serial(async () => {
      if (path.extname(file).toLowerCase() !== '.lam') throw new Error('Choose a .lam filename. Other file formats are not replaced.');
      const canonical = await this.canonical(file);
      if (await this.isProtected(canonical)) throw new Error('Save As must be outside internal application data, library revisions, and backups.');
      let before = null;
      try { before = await this.snapshot(canonical); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const target = { path: canonical, documentId: project.id, snapshot: before };
      await this.write(canonical, data, async () => {
        if (await this.canonical(canonical) !== canonical || await this.isProtected(canonical)) throw new Error('The chosen file location changed. Choose Save As again.');
        if (before) await this.unchanged(target);
        else { try { await fs.lstat(canonical); } catch (error) { if (error.code === 'ENOENT') return; throw error; } throw new Error('A file appeared at the chosen destination. Choose Save As again to confirm replacement.'); }
      }, before?.mode ?? 0o600);
      const after = await this.snapshot(canonical);
      if (after.hash !== digest(data)) throw new Error('The saved file could not be verified.');
      target.snapshot = after;
      const token = randomUUID(); this.targets.set(token, target);
      return this.publicTarget(token, target);
    });
  }
  reset() { this.targets.clear(); }
}
module.exports = { DocumentFiles };
