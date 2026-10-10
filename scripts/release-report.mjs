import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const [folder = 'release-assets', output = '.cache/release-notes.md'] = process.argv.slice(2);
const notes = await readFile('docs/release-notes.md', 'utf8');
const sums = await readFile(join(folder, 'SHA256SUMS.txt'), 'utf8');
let report = `${notes}\n\n<details>\n<summary>Verified build, update manifests, and SHA-256 checksums</summary>\n\nBuild commit: \`${process.env.GITHUB_SHA ?? 'local-verification'}\`\n\n`;
if (process.env.GITHUB_RUN_ID) report += `Installer checks: https://github.com/Dinomax2005/luno-animate/actions/runs/${process.env.GITHUB_RUN_ID}\n\n`;
report += `### Download checksums\n\n\`\`\`text\n${sums}\`\`\`\n\n`;
for (const manifest of ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']) report += `### ${manifest}\n\n\`\`\`yaml\n${await readFile(join(folder, manifest), 'utf8')}\`\`\`\n\n`;
report += '</details>\n';
await mkdir(dirname(output), { recursive: true });
await writeFile(output, report);
