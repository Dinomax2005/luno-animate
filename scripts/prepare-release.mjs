import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { load } from 'js-yaml';
const [input = 'installers', destination = 'release-assets'] = process.argv.slice(2);
const source = resolve(input), output = resolve(destination); if (source === output) throw new Error('Use separate source and output directories.');
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
await mkdir(output, { recursive: true }); if ((await readdir(output)).length) throw new Error('Use an empty release output directory; existing files have not been removed.'); const files = new Map();
async function collect(folder) { for (const entry of await readdir(folder, { withFileTypes: true })) { const file = join(folder, entry.name); if (entry.isDirectory()) await collect(file); else if (entry.isFile()) { if (!/\.(exe|dmg|zip|deb|AppImage|blockmap|yml)$/.test(entry.name)) throw new Error(`Unexpected release asset: ${entry.name}`); if (files.has(entry.name)) throw new Error(`Duplicate release filename: ${entry.name}`); files.set(entry.name, file); } else throw new Error('Release assets must be regular files.'); } }
await collect(source);
for (const required of ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']) if (!files.has(required)) throw new Error(`Missing update feed: ${required}`);
async function digest(file, algorithm, encoding) { const hash = createHash(algorithm); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest(encoding); }
for (const [name, file] of files) if (name.endsWith('.yml')) {
  const manifest = load(await readFile(file, 'utf8')); if (manifest.version !== version || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error(`Invalid update manifest: ${name}`);
  for (const asset of manifest.files) { const url = decodeURIComponent(asset.url); if (url !== basename(url) || !files.has(url)) throw new Error(`Manifest asset is missing: ${asset.url}`); if (await digest(files.get(url), 'sha512', 'base64') !== asset.sha512) throw new Error(`Update checksum mismatch: ${url}`); }
}
const sums = [];
for (const [name, file] of [...files].sort(([a], [b]) => a.localeCompare(b))) { await copyFile(file, join(output, name)); sums.push(`${await digest(file, 'sha256', 'hex')}  ${name}`); }
await writeFile(join(output, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`); console.log(`Verified manifests and flattened ${files.size} release assets for v${version}.`);
