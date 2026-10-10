const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const run = promisify(execFile);
const { version } = require('../package.json');
const installer = (os, arch, ext) => `Luno-Animate-${version}-${os}-${arch}.${ext}`;
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'luno-release-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const input = path.join(root, 'artifacts'), output = path.join(root, 'flat');
  for (const [platform, manifest, assets, referenced] of [
    ['Windows', 'latest.yml', [installer('win', 'x64', 'exe')], [0]],
    ['macOS', 'latest-mac.yml', [installer('mac', 'x64', 'zip'), installer('mac', 'arm64', 'zip'), installer('mac', 'x64', 'dmg'), installer('mac', 'arm64', 'dmg')], [0, 1]],
    ['Linux', 'latest-linux.yml', [installer('linux', 'x64', 'AppImage'), installer('linux', 'x64', 'deb')], [0]],
  ]) {
    const dir = path.join(input, `Luno-${platform}`); await fs.mkdir(dir, { recursive: true });
    const bytes = Buffer.from(platform); for (const asset of assets) await fs.writeFile(path.join(dir, asset), bytes);
    const files = referenced.map(index => `  - url: ${assets[index]}\n    sha512: ${createHash('sha512').update(bytes).digest('base64')}\n    size: ${bytes.length}`).join('\n');
    await fs.writeFile(path.join(dir, manifest), `version: ${version}\nfiles:\n${files}\n`);
  }
  return { input, output, root };
}
test('release assets/checksums are flattened and match every platform/architecture', async t => {
  const { input, output } = await fixture(t); await run(process.execPath, ['scripts/prepare-release.mjs', input, output]);
  const sums = await fs.readFile(path.join(output, 'SHA256SUMS.txt'), 'utf8'); assert.equal((await fs.readdir(output)).length, 11); assert(!sums.includes('artifacts/'));
  for (const line of sums.trim().split('\n')) { const [hash, name] = line.split('  '); assert.equal(createHash('sha256').update(await fs.readFile(path.join(output, name))).digest('hex'), hash); }
});
test('damaged installers cannot become a release', async t => {
  const { input, output } = await fixture(t); await fs.writeFile(path.join(input, 'Luno-Windows', installer('win', 'x64', 'exe')), 'x'.repeat('Windows'.length));
  await assert.rejects(run(process.execPath, ['scripts/prepare-release.mjs', input, output]), /checksum mismatch/); assert.equal((await fs.readdir(output)).length, 0);
});
test('missing platform installers cannot leave a partial release', async t => {
  const { input, output } = await fixture(t); await fs.unlink(path.join(input, 'Luno-macOS', installer('mac', 'arm64', 'dmg')));
  await assert.rejects(run(process.execPath, ['scripts/prepare-release.mjs', input, output]), /Missing platform installer/); assert.equal((await fs.readdir(output)).length, 0);
});
test('both macOS architectures must be referenced by the updater manifest', async t => {
  const { input, output } = await fixture(t), file = path.join(input, 'Luno-macOS', 'latest-mac.yml');
  const yaml = require('js-yaml'); const manifest = yaml.load(await fs.readFile(file, 'utf8')); manifest.files.pop(); await fs.writeFile(file, yaml.dump(manifest));
  await assert.rejects(run(process.execPath, ['scripts/prepare-release.mjs', input, output]), /omits platform\/architecture/);
});
test('wrong update sizes are refused before copying any assets', async t => {
  const { input, output } = await fixture(t), file = path.join(input, 'Luno-Linux', 'latest-linux.yml'); await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('size: 5', 'size: 6'));
  await assert.rejects(run(process.execPath, ['scripts/prepare-release.mjs', input, output]), /size mismatch/); assert.equal((await fs.readdir(output)).length, 0);
});
test('duplicate filenames are refused instead of silently replacing another platform asset', async t => { const { input, output } = await fixture(t); await fs.writeFile(path.join(input, 'Luno-Linux', 'latest.yml'), 'duplicate'); await assert.rejects(run(process.execPath, ['scripts/prepare-release.mjs', input, output]), /Duplicate/); });
test('an existing output directory is left intact', async t => { const { input, output } = await fixture(t); await fs.mkdir(output); await fs.writeFile(path.join(output, 'keep-me'), 'work'); await assert.rejects(run(process.execPath, ['scripts/prepare-release.mjs', input, output]), /empty/); assert.equal(await fs.readFile(path.join(output, 'keep-me'), 'utf8'), 'work'); });
