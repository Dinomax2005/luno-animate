import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
/**
 * Composes the release body from the user-facing notes in docs/RELEASE.md.
 * Installer details stay in a collapsed section so the page reads as a change
 * log first, and never mentions how the build was produced.
 */
const [folder = "verified-assets", output = ".cache/release.md"] =
  process.argv.slice(2);
const notes = await readFile("docs/RELEASE.md", "utf8");
let report = notes.trimEnd();
report += `\n\n<details><summary>Installers, checksums and update manifests</summary>\n\nBuild \`${process.env.GITHUB_SHA ?? "local"}\`\n\n### SHA-256\n\n\`\`\`text\n${await readFile(path.join(folder, "SHA256SUMS.txt"), "utf8")}\`\`\`\n`;
for (const name of [
  "studio-v1.yml",
  "studio-v1-mac.yml",
  "studio-v1-linux.yml",
])
  report += `\n### ${name}\n\n\`\`\`yaml\n${await readFile(path.join(folder, name), "utf8")}\`\`\`\n`;
report += "</details>\n";
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, report);
