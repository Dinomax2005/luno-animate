import { build } from "esbuild";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { zipSync } from "fflate";
await mkdir("desktop", { recursive: true });
await mkdir("assets", { recursive: true });
await mkdir("public/legal", { recursive: true });
await build({
  entryPoints: ["desktop/core-entry.ts"],
  outfile: "desktop/core.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "warning",
});
await build({
  entryPoints: ["desktop/update-core.cjs"],
  outfile: "desktop/updater.bundle.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  logLevel: "warning",
});
const svg = await readFile("public/mark.svg");
await writeFile("assets/icon.svg", svg);
await sharp(svg).resize(512, 512).png().toFile("assets/icon.png");
const sizes = [16, 32, 48, 128, 256],
  images = await Promise.all(
    sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer()),
  ),
  header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
for (let i = 0; i < images.length; i++) {
  const at = 6 + i * 16;
  header[at] = sizes[i] === 256 ? 0 : sizes[i];
  header[at + 1] = header[at];
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(images[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += images[i].length;
}
await writeFile("assets/icon.ico", Buffer.concat([header, ...images]));
const pkg = JSON.parse(await readFile("package.json", "utf8")),
  visited = new Set(),
  sections = [
    "LUNO STUDIO — THIRD-PARTY NOTICES\nThese licences cover their respective components, not original Luno Studio code.\nElectron/Chromium keep their own distributed runtime notices.\nUnmodified Mediabunny source and licence: mediabunny-source.zip.\n",
  ];
async function notice(folder) {
  if (visited.has(folder)) return;
  let meta;
  try {
    meta = JSON.parse(
      await readFile(path.join(folder, "package.json"), "utf8"),
    );
  } catch {
    return;
  }
  visited.add(folder);
  const candidates = (await readdir(folder)).filter((n) =>
    /^licen[sc]e|^copying|^ofl/i.test(n),
  );
  let licence = "";
  for (const file of candidates) {
    const full = path.join(folder, file);
    if ((await stat(full)).isFile())
      licence += (await readFile(full, "utf8")) + "\n";
  }
  sections.push(
    `\n=== ${meta.name} ${meta.version} ===\nDeclared licence: ${typeof meta.license === "string" ? meta.license : JSON.stringify(meta.license)}\n${licence || "This installed package does not include standalone licence text; retain its declared licence and upstream attribution.\n"}`,
  );
  for (const name of Object.keys(meta.dependencies ?? {})) {
    const nested = path.join(folder, "node_modules", name);
    try {
      await stat(path.join(nested, "package.json"));
      await notice(nested);
    } catch {
      await notice(path.join("node_modules", name));
    }
  }
}
for (const name of Object.keys(pkg.dependencies))
  await notice(path.join("node_modules", name));
await writeFile("public/legal/NOTICE.txt", sections.join("\n"));
const archive = {};
async function collect(dir, prefix) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name),
      name = prefix + "/" + entry.name;
    if (entry.isDirectory()) await collect(full, name);
    else if (entry.isFile())
      archive[name] = new Uint8Array(await readFile(full));
  }
}
await collect("node_modules/mediabunny", "mediabunny");
await writeFile(
  "public/legal/mediabunny-source.zip",
  zipSync(archive, { level: 6 }),
);
console.log(
  `Prepared new Luno Studio brand, native codec/updater and ${visited.size} component notices.`,
);
