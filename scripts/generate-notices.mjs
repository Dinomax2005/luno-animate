import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
const root = fileURLToPath(new URL('..', import.meta.url));
const packages = new Map([
  ['react', 'LICENSE'], ['react-dom', 'LICENSE'], ['scheduler', 'LICENSE'], ['zustand', 'LICENSE'], ['zod', 'LICENSE'], ['lucide-react', 'LICENSE'],
  ['gifenc', 'LICENSE.md'], ['@fontsource-variable/inter', 'LICENSE'], ['fflate', 'LICENSE'], ['@noble/hashes', 'LICENSE'], ['idb', 'LICENSE'], ['mediabunny', 'LICENSE'],
]);
const inputs = JSON.parse(await readFile(resolve(root, '.cache/native-packages.json'), 'utf8'));
for (const input of inputs) {
  const match = input.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//); if (!match) continue;
  const folder = match[1]; const key = folder.replace(/^node_modules\//, ''); if (packages.has(key)) continue;
  const files = await readdir(resolve(root, folder)); const license = files.find(f => /^licen[cs]e(?:\.(?:txt|md))?$/i.test(f));
  if (!license && key !== 'lazy-val') throw new Error(`A bundled dependency has no license notice: ${key}`); packages.set(key, license ?? 'MIT-METADATA');
}
let notices = 'LUNO ANIMATE — THIRD-PARTY NOTICES\n\nThese licenses apply to their respective components, not to Luno’s own source.\nElectron and Chromium retain their license files in the desktop distribution.\n\nSOURCE AVAILABILITY\nMediabunny is included without source modifications under MPL 2.0.\nThe exact installed Source Code Form is bundled as third-party/mediabunny-sources.zip,\navailable from Help → Third-party notices, and includes its original license.\nUpstream: https://github.com/Vanilagy/mediabunny\nNo FFmpeg/x264 executable or AAC WASM extension is bundled. MP4 uses WebCodecs.\n';
for (const [name, file] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
  const folder = resolve(root, 'node_modules', name), metadata = JSON.parse(await readFile(resolve(folder, 'package.json'), 'utf8')), license = file === 'MIT-METADATA' ? await readFile(resolve(root, 'src/config/licenses/lazy-val.txt'), 'utf8') : await readFile(resolve(folder, file), 'utf8');
  notices += `\n${'='.repeat(68)}\n${metadata.name} ${metadata.version}\n${'='.repeat(68)}\n\n${license.trim()}\n`;
}
for (const folder of ['src/config', 'public']) { await mkdir(resolve(root, folder), { recursive: true }); await writeFile(resolve(root, folder, 'third-party-notices.txt'), notices); }
const sourceFolder = resolve(root, 'node_modules/mediabunny'), archive = {};
async function collect(folder, prefix) { for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) { const key = `${prefix}/${entry.name}`; if (entry.isDirectory()) await collect(join(folder, entry.name), key); else archive[key] = [new Uint8Array(await readFile(join(folder, entry.name))), { mtime: new Date('2026-01-01T00:00:00Z') }]; } }
await collect(join(sourceFolder, 'src'), 'mediabunny/src');
for (const file of ['LICENSE', 'README.md', 'package.json']) archive[`mediabunny/${file}`] = [new Uint8Array(await readFile(join(sourceFolder, file))), { mtime: new Date('2026-01-01T00:00:00Z') }];
archive['SOURCE-AVAILABILITY.txt'] = [strToU8('Unmodified Mediabunny Source Code Form for the version named in its package.json.\nOriginal notices and MPL 2.0 are preserved. No changes to upstream source were made.\nhttps://github.com/Vanilagy/mediabunny\n'), { mtime: new Date('2026-01-01T00:00:00Z') }];
await mkdir(resolve(root, 'public/third-party'), { recursive: true }); await writeFile(resolve(root, 'public/third-party/mediabunny-sources.zip'), zipSync(archive));
console.log(`Bundled complete notices for ${packages.size} shipped dependencies and Mediabunny’s exact source.`);
