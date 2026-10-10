import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('electron/lib', { recursive: true });
await build({ entryPoints: ['electron/core.ts'], outfile: 'electron/lib/core.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', legalComments: 'eof' });
await build({ entryPoints: ['electron/updater.cjs'], outfile: 'electron/lib/updater.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron', 'original-fs'], legalComments: 'eof', metafile: true }).then(async result => { await mkdir('.cache', { recursive: true }); await writeFile('.cache/native-packages.json', JSON.stringify(Object.keys(result.metafile.inputs))); });
console.log('Built isolated project validator and safe desktop updater.');
