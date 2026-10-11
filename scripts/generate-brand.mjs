import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const svg = await readFile('assets/icon.svg');
await writeFile('public/favicon.svg', svg);
await sharp(svg).resize(1024, 1024).png().toFile('assets/icon.png');
const sizes = [16, 32, 48, 64, 128, 256], images = await Promise.all(sizes.map(size => sharp(svg).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4); let offset = header.length;
sizes.forEach((size, n) => { const at = 6 + n * 16; header[at] = size === 256 ? 0 : size; header[at + 1] = header[at]; header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6); header.writeUInt32LE(images[n].length, at + 8); header.writeUInt32LE(offset, at + 12); offset += images[n].length; });
await writeFile('assets/icon.ico', Buffer.concat([header, ...images]));
async function bmp(svg, filename, width, height) {
  const pixels = await sharp(Buffer.from(svg)).flatten({ background: '#151318' }).removeAlpha().raw().toBuffer(), row = Math.ceil(width * 3 / 4) * 4, buffer = Buffer.alloc(54 + row * height);
  buffer.write('BM'); buffer.writeUInt32LE(buffer.length, 2); buffer.writeUInt32LE(54, 10); buffer.writeUInt32LE(40, 14); buffer.writeInt32LE(width, 18); buffer.writeInt32LE(height, 22); buffer.writeUInt16LE(1, 26); buffer.writeUInt16LE(24, 28); buffer.writeUInt32LE(row * height, 34);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) buffer[54 + (height - 1 - y) * row + x * 3 + c] = pixels[(y * width + x) * 3 + 2 - c];
  await writeFile(filename, buffer);
}
const icon = `data:image/svg+xml;base64,${svg.toString('base64')}`;
await bmp(`<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314"><rect width="164" height="314" fill="#151318"/><path d="M0 250Q90 170 164 200V314H0Z" fill="#391a25"/><image href="${icon}" x="30" y="49" width="104" height="104"/><text x="82" y="185" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="600" fill="#f2e5e6">LUNO</text><text x="82" y="203" text-anchor="middle" font-family="sans-serif" font-size="10" letter-spacing="3" fill="#e97a81">ANIMATE</text><text x="82" y="287" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#bc9ca7">ANIMATION &amp; VIDEO</text></svg>`, 'assets/installer-sidebar.bmp', 164, 314);
await bmp(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57"><rect width="150" height="57" fill="#151318"/><image href="${icon}" x="8" y="8" width="41" height="41"/><text x="57" y="29" font-family="sans-serif" font-size="13" fill="#f2e5e6">LUNO</text><text x="57" y="42" font-family="sans-serif" font-size="8" letter-spacing="1.8" fill="#e97a81">ANIMATE</text></svg>`, 'assets/installer-header.bmp', 150, 57);
console.log('Generated eclipse PNG, six-resolution Windows ICO, favicon, and NSIS artwork from the SVG source.');
