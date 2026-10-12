import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  readdir,
  readFile,
  mkdir,
  stat,
  copyFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
const [source = "artifacts", destination = "verified-assets"] =
    process.argv.slice(2),
  version = JSON.parse(await readFile("package.json", "utf8")).version;
if (!/^1\.\d+\.\d+$/.test(version))
  throw new Error("Only supported stable Studio 1.x releases can be staged.");
const feeds = {
    "studio-v1.yml": [`Luno-Studio-${version}-win-x64.exe`],
    "studio-v1-mac.yml": [
      `Luno-Studio-${version}-mac-x64.zip`,
      `Luno-Studio-${version}-mac-arm64.zip`,
    ],
    "studio-v1-linux.yml": [`Luno-Studio-${version}-linux-x86_64.AppImage`],
  },
  required = [
    ...Object.keys(feeds),
    ...Object.values(feeds).flat(),
    `Luno-Studio-${version}-mac-x64.dmg`,
    `Luno-Studio-${version}-mac-arm64.dmg`,
    `Luno-Studio-${version}-linux-amd64.deb`,
  ],
  files = new Map();
async function scan(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) await scan(full);
    else if (item.isFile()) {
      if (!/\.(exe|dmg|zip|deb|AppImage|blockmap|yml)$/.test(item.name))
        throw new Error(`Unexpected artifact ${item.name}`);
      if (files.has(item.name))
        throw new Error(`Duplicate artifact ${item.name}`);
      files.set(item.name, full);
    } else throw new Error("Artifacts must be regular files.");
  }
}
await scan(source);
for (const name of required)
  if (!files.has(name)) throw new Error(`Missing required artifact: ${name}`);
await mkdir(destination, { recursive: true });
if ((await readdir(destination)).length)
  throw new Error("Use an empty verified output directory.");
async function hash(file, algorithm, encoding) {
  const digest = createHash(algorithm);
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest(encoding);
}
for (const [name, file] of files)
  if (name.endsWith(".yml")) {
    if (!Object.hasOwn(feeds, name))
      throw new Error(
        "Legacy/latest or unknown channel manifests are forbidden.",
      );
    const manifest = load(await readFile(file, "utf8"));
    if (manifest.version !== version || !Array.isArray(manifest.files))
      throw new Error("Manifest version mismatch.");
    for (const expected of feeds[name])
      if (!manifest.files.some((f) => decodeURIComponent(f.url) === expected))
        throw new Error(`Missing update architecture: ${expected}`);
    for (const entry of manifest.files) {
      const filename = decodeURIComponent(entry.url);
      if (filename !== path.basename(filename) || !files.has(filename))
        throw new Error("Unsafe or missing manifest path.");
      if (
        entry.size !== (await stat(files.get(filename))).size ||
        entry.sha512 !== (await hash(files.get(filename), "sha512", "base64"))
      )
        throw new Error(`Invalid updater size/hash for ${filename}`);
    }
  }
const sums = [];
for (const [name, file] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
  await copyFile(file, path.join(destination, name));
  sums.push(`${await hash(file, "sha256", "hex")}  ${name}`);
}
await writeFile(
  path.join(destination, "SHA256SUMS.txt"),
  sums.join("\n") + "\n",
);
console.log(
  `Verified ${files.size} assets, exact v${version} and all Studio 1.x manifests.`,
);
