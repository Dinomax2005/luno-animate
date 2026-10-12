export function rasterSize(bytes: Uint8Array): {
  width: number;
  height: number;
} {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    str = (at: number, n: number) =>
      String.fromCharCode(...bytes.subarray(at, at + n));
  let width = 0,
    height = 0;
  if (
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => n === bytes[i]) &&
    str(12, 4) === "IHDR"
  ) {
    width = v.getUint32(16);
    height = v.getUint32(20);
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    let cursor = 2;
    while (cursor + 4 <= bytes.length) {
      if (bytes[cursor++] !== 255) break;
      while (bytes[cursor] === 255) cursor++;
      const marker = bytes[cursor++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (cursor + 2 > bytes.length) break;
      const size = v.getUint16(cursor);
      if (size < 2 || cursor + size > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        size >= 8
      ) {
        height = v.getUint16(cursor + 3);
        width = v.getUint16(cursor + 5);
        break;
      }
      cursor += size;
    }
  } else if (
    bytes.length >= 20 &&
    str(0, 4) === "RIFF" &&
    str(8, 4) === "WEBP"
  ) {
    for (let cursor = 12; cursor + 8 <= bytes.length; ) {
      const name = str(cursor, 4),
        size = v.getUint32(cursor + 4, true),
        at = cursor + 8;
      if (!size || at + size > bytes.length) break;
      if (name === "VP8X" && size >= 10) {
        width = 1 + bytes[at + 4] + bytes[at + 5] * 256 + bytes[at + 6] * 65536;
        height =
          1 + bytes[at + 7] + bytes[at + 8] * 256 + bytes[at + 9] * 65536;
        break;
      }
      if (
        name === "VP8 " &&
        size >= 10 &&
        bytes[at + 3] === 157 &&
        bytes[at + 4] === 1 &&
        bytes[at + 5] === 42
      ) {
        width = v.getUint16(at + 6, true) & 16383;
        height = v.getUint16(at + 8, true) & 16383;
        break;
      }
      if (name === "VP8L" && size >= 5 && bytes[at] === 47) {
        const bits = v.getUint32(at + 1, true);
        width = (bits & 16383) + 1;
        height = ((bits >>> 14) & 16383) + 1;
        break;
      }
      cursor = at + size + (size & 1);
    }
  }
  if (!width || !height || width * height > 16_000_000)
    throw new Error("Unsupported, malformed or oversized raster image.");
  return { width, height };
}
export function embeddedSize(uri: string) {
  const at = uri.indexOf(","),
    binary = atob(uri.slice(at + 1));
  return rasterSize(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}
