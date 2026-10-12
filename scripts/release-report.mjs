import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const [folder = "verified-assets", output = ".cache/release.md"] =
  process.argv.slice(2);
const notes = await readFile("docs/RELEASE.md", "utf8");
let report =
  notes +
  `\n\n<details><summary>Exact-source verification and checksums</summary>\n\nBuild commit: \`${process.env.GITHUB_SHA ?? "local"}\`\n\nInstaller run: ${process.env.GITHUB_RUN_ID ?? "local"}\n\n### SHA-256\n\n\`\`\`text\n${await readFile(path.join(folder, "SHA256SUMS.txt"), "utf8")}\`\`\`\n`;
for (const name of [
  "studio-v1.yml",
  "studio-v1-mac.yml",
  "studio-v1-linux.yml",
])
  report += `\n### ${name}\n\n\`\`\`yaml\n${await readFile(path.join(folder, name), "utf8")}\`\`\`\n`;
report += "</details>\n";
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, report);
