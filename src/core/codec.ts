import { deflateSync, Inflate, strFromU8, strToU8 } from "fflate";
import { sha256 } from "@noble/hashes/sha2.js";
import { MAX_BYTES, type Document } from "./model";
import { parseDocument, validateDocument } from "./validate";
const MAGIC = strToU8("PEGB1LAM");
// 1.0.x shipped this container as Luno Studio. Those projects still open; they
// are re-saved with the current signature once you save them again.
const LEGACY_MAGIC = strToU8("LUNO1LAM");
export const HEADER = 52;
export function fingerprint(bytes: Uint8Array): string {
  return [...sha256(bytes)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function encode(document: Document): Uint8Array {
  const raw = strToU8(JSON.stringify(validateDocument(document))),
    compressed = deflateSync(raw, { level: 6 });
  if (compressed.length + HEADER > MAX_BYTES + HEADER)
    throw new Error("Project exceeds 64 MB.");
  const result = new Uint8Array(HEADER + compressed.length),
    v = new DataView(result.buffer);
  result.set(MAGIC);
  v.setUint16(8, 1, true);
  v.setUint16(10, 1, true);
  v.setUint32(12, raw.length, true);
  v.setUint32(16, compressed.length, true);
  result.set(sha256(compressed), 20);
  result.set(compressed, HEADER);
  return result;
}
export function decode(bytes: Uint8Array): Document {
  if (bytes.length < HEADER)
    throw new Error(
      "Unsupported project. Pegbar Studio 2.0 does not read the abandoned pre-1.0 format. Your work is unchanged.",
    );
  const current = MAGIC.every((x, i) => x === bytes[i]),
    legacy = LEGACY_MAGIC.every((x, i) => x === bytes[i]);
  if (!current && !legacy)
    throw new Error(
      "Unsupported project. Pegbar Studio 2.0 opens Pegbar Studio 1.0 files and its own, not the abandoned pre-1.0 format. Your work is unchanged.",
    );
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint16(8, true) !== 1 || v.getUint16(10, true) !== 1)
    throw new Error("This project requires another Pegbar Studio reader.");
  const rawSize = v.getUint32(12, true),
    size = v.getUint32(16, true);
  if (
    rawSize < 2 ||
    rawSize > MAX_BYTES ||
    size !== bytes.length - HEADER ||
    bytes.length > MAX_BYTES + HEADER
  )
    throw new Error("Invalid project lengths.");
  const body = bytes.subarray(HEADER);
  if (sha256(body).some((b, i) => b !== bytes[20 + i]))
    throw new Error(
      "Project integrity check failed. Keep the original and recover a backup.",
    );
  const raw = new Uint8Array(rawSize);
  let offset = 0;
  const inflater = new Inflate((chunk) => {
    if (offset + chunk.length > rawSize)
      throw new Error("Project expands beyond its declared limit.");
    raw.set(chunk, offset);
    offset += chunk.length;
  });
  for (let i = 0; i < body.length; i += 4096)
    inflater.push(
      body.subarray(i, Math.min(i + 4096, body.length)),
      i + 4096 >= body.length,
    );
  if (offset !== rawSize) throw new Error("Incomplete project payload.");
  return parseDocument(strFromU8(raw));
}
