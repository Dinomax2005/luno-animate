const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DocumentFiles } = require('../electron/document-files.cjs');
const { atomicWrite } = require('../electron/vault.cjs');
const { encodeLam, decodeLam } = require('../electron/lib/core.cjs');

function project(name = 'Opened document', id = 'document-1') { return { version: 2, id, name, width: 960, height: 600, fps: 24, duration: 72, background: '#ffffff', items: [], keyframes: {}, sceneId: 'scene-1', sceneName: 'Scene 1', sceneOrder: ['scene-1'], scenes: [], camera: { x: 480, y: 300, zoom: 1, rotation: 0, keys: [] }, audio: [], workArea: { start: 0, end: 71 } }; }
async function fixture(t, write) {
  const folder = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'luno-document-files-'))); // macOS temp paths have a /private alias.
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const profile = path.join(folder, 'profile'); await fs.mkdir(profile);
  const file = path.join(folder, 'Original.lam'), bytes = encodeLam(project()); await fs.writeFile(file, bytes);
  return { folder, profile, file, bytes, files: new DocumentFiles(profile, write) };
}

test('Open is read-only; a capability names only the approved file and project', async t => {
  const { files, file, bytes } = await fixture(t), result = await files.open(file);
  assert.deepEqual(Buffer.from(result.data), Buffer.from(bytes)); assert.deepEqual(await fs.readFile(file), Buffer.from(bytes));
  assert.equal(result.filename, 'Original.lam'); assert.equal(result.target.name, 'Original.lam');
  assert.equal(result.target.displayPath, file); assert.equal(result.target.documentId, 'document-1');
  assert.match(result.target.token, /^[0-9a-f-]{36}$/); assert.notEqual(result.target.token, file);
});
test('repeated Save atomically overwrites the opened file without creating extra copies', async t => {
  const { files, file, folder } = await fixture(t), { target } = await files.open(file);
  await files.save(target.token, encodeLam(project('First edit')));
  await files.save(target.token, encodeLam(project('Second edit')));
  assert.equal(decodeLam(await fs.readFile(file)).name, 'Second edit');
  assert.deepEqual((await fs.readdir(folder)).sort(), ['Original.lam', 'profile']);
});
test('parallel Save operations are serialized and the last successful edit wins', async t => {
  const { files, file } = await fixture(t), { target } = await files.open(file);
  await Promise.all(Array.from({ length: 4 }, (_, n) => files.save(target.token, encodeLam(project(`Edit ${n}`)))));
  assert.equal(decodeLam(await fs.readFile(file)).name, 'Edit 3');
});
test('Save As chooses a new capability; later Save writes only the newly chosen file', async t => {
  const { files, file, folder, bytes } = await fixture(t), copy = path.join(folder, 'Chosen.lam');
  const source = (await files.open(file)).target;
  const next = await files.saveAs(copy, encodeLam(project('New destination')));
  assert.notEqual(next.token, source.token); assert.equal(next.name, 'Chosen.lam');
  await files.save(next.token, encodeLam(project('Changed copy')));
  assert.equal(decodeLam(await fs.readFile(copy)).name, 'Changed copy');
  assert.deepEqual(await fs.readFile(file), Buffer.from(bytes));
});
test('confirmed Save As can replace an existing regular .lam file', async t => {
  const { files, file } = await fixture(t);
  const target = await files.saveAs(file, encodeLam(project('Confirmed replacement', 'another-document')));
  assert.equal(target.documentId, 'another-document'); assert.equal(decodeLam(await fs.readFile(file)).id, 'another-document');
});
test('arbitrary renderer paths, forged tokens, and another document cannot use a capability', async t => {
  const { files, file, bytes } = await fixture(t), { target } = await files.open(file);
  for (const token of [file, '../escape', 'unknown', {}, null]) await assert.rejects(files.save(token, encodeLam(project())), /not authorized/);
  await assert.rejects(files.save(target.token, encodeLam(project('Wrong document', 'another-id'))), /another document/);
  assert.deepEqual(await fs.readFile(file), Buffer.from(bytes));
});
test('invalid or tampered LAM bytes fail before replacing the original', async t => {
  const { files, file, bytes } = await fixture(t), { target } = await files.open(file);
  const damaged = encodeLam(project()); damaged[60] ^= 2;
  for (const data of [damaged, new Uint8Array(), 'invalid']) assert.throws(() => files.save(target.token, data));
  assert.deepEqual(await fs.readFile(file), Buffer.from(bytes));
});
test('an externally changed file is left intact, and the original capability is not silently rebound', async t => {
  const { files, file } = await fixture(t), { target } = await files.open(file), external = encodeLam(project('Changed by another app'));
  await fs.writeFile(file, external);
  await assert.rejects(files.save(target.token, encodeLam(project('Stale editor'))), /changed on disk/);
  assert.deepEqual(await fs.readFile(file), Buffer.from(external));
  await assert.rejects(files.save(target.token, encodeLam(project('Retry'))), /changed on disk/);
});
test('two independently opened copies cannot overwrite each other’s newer edit', async t => {
  const { files, file } = await fixture(t), first = (await files.open(file)).target, second = (await files.open(file)).target;
  await files.save(first.token, encodeLam(project('Newer edit')));
  await assert.rejects(files.save(second.token, encodeLam(project('Stale copy'))), /changed on disk/);
  assert.equal(decodeLam(await fs.readFile(file)).name, 'Newer edit');
});
test('a moved/deleted file is not recreated by Save', async t => {
  const { files, file } = await fixture(t), { target } = await files.open(file);
  await fs.rename(file, `${file}.moved`);
  await assert.rejects(files.save(target.token, encodeLam(project('Edit'))), /moved or deleted/);
  await assert.rejects(fs.stat(file), { code: 'ENOENT' });
});
test('a failed atomic replacement keeps the original bytes, capability, and no temporary debris', async t => {
  const { files, file, folder, bytes } = await fixture(t), { target } = await files.open(file);
  const rename = fs.rename; fs.rename = async (from, to) => { if (to === file) throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' }); return rename(from, to); };
  try { await assert.rejects(files.save(target.token, encodeLam(project('Unwritten'))), /Disk full/); } finally { fs.rename = rename; }
  assert.deepEqual(await fs.readFile(file), Buffer.from(bytes)); assert.equal((await fs.readdir(folder)).filter(f => f.endsWith('.tmp')).length, 0);
  await files.save(target.token, encodeLam(project('Successful retry'))); assert.equal(decodeLam(await fs.readFile(file)).name, 'Successful retry');
});
test('changes during staging are checked again just before replacement', async t => {
  let original; const { files, file } = await fixture(t, async (destination, bytes, beforeCommit, mode) => {
    await fs.writeFile(destination, encodeLam(project('External edit during staging')));
    return atomicWrite(destination, bytes, beforeCommit, mode);
  }); original = (await files.open(file)).target;
  await assert.rejects(files.save(original.token, encodeLam(project('Editor edit'))), /changed on disk/);
  assert.equal(decodeLam(await fs.readFile(file)).name, 'External edit during staging');
});
test('a file that appears while a new Save As is staged is not overwritten', async t => {
  const { files, folder } = await fixture(t, async (destination, bytes, beforeCommit, mode) => {
    await fs.writeFile(destination, encodeLam(project('Someone else created this')));
    return atomicWrite(destination, bytes, beforeCommit, mode);
  }); const chosen = path.join(folder, 'New.lam');
  await assert.rejects(files.saveAs(chosen, encodeLam(project('My edit'))), /file appeared/);
  assert.equal(decodeLam(await fs.readFile(chosen)).name, 'Someone else created this');
});
test('Save cannot target native library revisions, backups, or other application data', async t => {
  const { files, profile, bytes } = await fixture(t), internal = path.join(profile, 'History.lam'); await fs.writeFile(internal, bytes);
  assert.equal((await files.open(internal)).target, null);
  await assert.rejects(files.saveAs(internal, encodeLam(project('Unsafe replacement'))), /internal application data/);
  assert.deepEqual(await fs.readFile(internal), Buffer.from(bytes));
});
test('legacy JSON projects require Save As, and non-.lam targets are not replaced', async t => {
  const { files, folder } = await fixture(t), legacy = path.join(folder, 'Old.luno'), raw = JSON.stringify(project()); await fs.writeFile(legacy, raw);
  assert.equal((await files.open(legacy)).target, null);
  await assert.rejects(files.saveAs(legacy, encodeLam(project())), /\.lam filename/);
  assert.equal(await fs.readFile(legacy, 'utf8'), raw);
});
test('symbolic links cannot become writable sources or Save As destinations', async t => {
  const { files, file, folder, bytes } = await fixture(t), link = path.join(folder, 'Link.lam');
  try { await fs.symlink(file, link); } catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.skip('Runner has no symbolic-link privilege.'); return; } throw error; }
  await assert.rejects(files.open(link), /regular file/); await assert.rejects(files.saveAs(link, encodeLam(project())), /symbolic link/);
  const target = (await files.open(file)).target; await fs.rename(file, `${file}.original`); await fs.symlink(`${file}.original`, file);
  await assert.rejects(files.save(target.token, encodeLam(project('Edit'))), /symbolic link/);
  assert.deepEqual(await fs.readFile(`${file}.original`), Buffer.from(bytes));
});
test('POSIX read-only files are not replaced, and existing file permissions survive Save', { skip: process.platform === 'win32' }, async t => {
  const { files, file } = await fixture(t), { target } = await files.open(file);
  await fs.chmod(file, 0o440); await assert.rejects(files.save(target.token, encodeLam(project())), /read-only/);
  await fs.chmod(file, 0o640); await files.save(target.token, encodeLam(project('Editable')));
  assert.equal((await fs.stat(file)).mode & 0o777, 0o640);
});
test('capabilities expire when the renderer session resets', async t => {
  const { files, file } = await fixture(t), { target } = await files.open(file); files.reset();
  await assert.rejects(files.save(target.token, encodeLam(project())), /not authorized/);
});
