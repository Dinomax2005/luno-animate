import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const packages = [
  ['react', 'LICENSE'], ['react-dom', 'LICENSE'], ['scheduler', 'LICENSE'],
  ['zustand', 'LICENSE'], ['zod', 'LICENSE'], ['lucide-react', 'LICENSE'],
  ['gifenc', 'LICENSE.md'], ['@fontsource-variable/inter', 'LICENSE'],
];
let notices = 'LUNO ANIMATE — THIRD-PARTY NOTICES\n\nThe following libraries and font are included in this application.\nThese licenses apply to their respective components, not to Luno’s own source.\nElectron and Chromium also retain their license files in the desktop distribution.\n';
for (const [name, file] of packages) {
  const folder = resolve(root, 'node_modules', name);
  const metadata = JSON.parse(await readFile(resolve(folder, 'package.json'), 'utf8'));
  const license = await readFile(resolve(folder, file), 'utf8');
  notices += `\n${'='.repeat(68)}\n${name} ${metadata.version}\n${'='.repeat(68)}\n\n${license.trim()}\n`;
}
for (const folder of ['src/config', 'public']) {
  await mkdir(resolve(root, folder), { recursive: true });
  await writeFile(resolve(root, folder, 'third-party-notices.txt'), notices);
}
console.log(`Bundled license notices for ${packages.length} dependencies, including the Inter font.`);
