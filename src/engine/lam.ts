import { deflateSync, Inflate, strFromU8, strToU8 } from 'fflate';
import { sha256 } from '@noble/hashes/sha2.js';
import { getScenes, MAX_PROJECT_BYTES, parseProject } from './project';
import type { Project } from './types';

export const LAM_MAGIC = new Uint8Array([76, 85, 78, 79, 76, 65, 77, 0]);
export const LAM_HEADER_BYTES = 56;
export const MAX_LAM_BYTES = MAX_PROJECT_BYTES + LAM_HEADER_BYTES;
// Older readers reject flags=3 before parsing, rather than silently losing new brush/eraser/fill data.
export const LAM_PAINT_FLAG = 2;
export function hasPaintFeatures(project: Project): boolean {
  return getScenes(project).some(scene => scene.items.some(item => !!item.brush || (item.strokeWidth > 100) || item.points?.some(p => p.pressure !== undefined) || item.cels?.some(c => c.strokes.some(s => !!s.brush || !!s.fill || s.mode !== undefined || s.width > 100 || s.points.some(p => p.pressure !== undefined)))));
}
/** LAM 1: magic, LE version/flags, schema, raw/compressed lengths, SHA-256 of the payload, raw DEFLATE. */
export function encodeLam(project: Project): Uint8Array {
  const validated = parseProject(JSON.stringify(project), false);
  const raw = strToU8(JSON.stringify(validated));
  if (raw.length > MAX_PROJECT_BYTES) throw new Error('This project is too large (64 MB maximum).');
  const payload = deflateSync(raw, { level: 6 });
  if (payload.length + LAM_HEADER_BYTES > MAX_LAM_BYTES) throw new Error('This project is too large.');
  const bytes = new Uint8Array(LAM_HEADER_BYTES + payload.length);
  const view = new DataView(bytes.buffer);
  bytes.set(LAM_MAGIC); view.setUint16(8, 1, true); view.setUint16(10, 1 | (hasPaintFeatures(validated) ? LAM_PAINT_FLAG : 0), true);
  view.setUint32(12, validated.version, true); view.setUint32(16, raw.length, true); view.setUint32(20, payload.length, true);
  bytes.set(sha256(payload), 24); bytes.set(payload, LAM_HEADER_BYTES);
  return bytes;
}
export function decodeLam(bytes: Uint8Array): Project {
  if (bytes.length < LAM_HEADER_BYTES || bytes.length > MAX_LAM_BYTES || LAM_MAGIC.some((b, i) => bytes[i] !== b)) throw new Error('This is not a Luno .lam file.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(8, true) !== 1 || ![1, 1 | LAM_PAINT_FLAG].includes(view.getUint16(10, true)) || view.getUint32(12, true) !== 2) throw new Error('This .lam file needs a different version of Luno. Your current project has not been changed.');
  const size = view.getUint32(16, true), compressedSize = view.getUint32(20, true);
  if (size < 2 || size > MAX_PROJECT_BYTES || compressedSize !== bytes.length - LAM_HEADER_BYTES) throw new Error('This .lam file has invalid lengths or is incomplete.');
  if (sha256(bytes.subarray(LAM_HEADER_BYTES)).some((b, i) => b !== bytes[24 + i])) throw new Error('The .lam integrity check failed. The file may be damaged.');
  const raw = new Uint8Array(size); let written = 0;
  // Bounded streaming inflation: never allocate the untrusted expanded size beyond our limit.
  const inflater = new Inflate(chunk => {
    if (written + chunk.length > size) throw new Error('This .lam file expands beyond its declared size.');
    raw.set(chunk, written); written += chunk.length;
  });
  try {
    for (let offset = LAM_HEADER_BYTES; offset < bytes.length; offset += 4096) inflater.push(bytes.subarray(offset, Math.min(offset + 4096, bytes.length)), offset + 4096 >= bytes.length);
  } catch (error) { throw new Error(error instanceof Error ? `Could not read this .lam file: ${error.message}` : 'The .lam file is damaged.'); }
  if (written !== size) throw new Error('The .lam integrity check failed. The file may be damaged.');
  const project = parseProject(strFromU8(raw), false);
  if (!(view.getUint16(10, true) & LAM_PAINT_FLAG) && hasPaintFeatures(project)) throw new Error('This .lam file contains advanced painting without its required feature flag. Your project was not changed.');
  return project;
}
export function readProjectData(data: string | Uint8Array | ArrayBuffer): Project {
  if (typeof data === 'string') return parseProject(data);
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (LAM_MAGIC.every((b, i) => bytes[i] === b)) return decodeLam(bytes);
  if (bytes.length > MAX_PROJECT_BYTES) throw new Error('This project is too large.');
  return parseProject(strFromU8(bytes));
}
