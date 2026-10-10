# Portable `.lam` format

Luno Animate v0.2 writes `.lam`, a **binary project format**, not JSON with a different filename. It includes every ordered scene and embedded image/audio, rig, layer hierarchy, drawing cel, text, key, camera, and work area. File associations register Luno as its editor. Legacy `.luno` JSON remains importable and is never overwritten by migration.

This is an application-specific format, **not a claim that only Luno could ever read it**. Someone could implement the decoder below. There is no password encryption, licensing lock, or DRM. SHA-256 detects accidental corruption, not a malicious author's intent.

## Container version 1

All integer fields are little-endian; the fixed header is 56 bytes:

| Offset | Length | Value |
| --- | --- | --- |
| 0 | 8 | `LUNOLAM\0` (bytes `4c 55 4e 4f 4c 41 4d 00`) |
| 8 | 2 | Container version: `1` |
| 10 | 2 | Flags: `1` (raw DEFLATE compression) |
| 12 | 4 | Document schema version: `2` |
| 16 | 4 | Uncompressed UTF-8 byte length |
| 20 | 4 | Compressed byte length |
| 24 | 32 | SHA-256 of the **compressed payload** |
| 56 | remaining | Raw DEFLATE-compressed UTF-8 JSON document |

Raw payload and total compressed file are limited to 64,000,000 bytes (plus the header for the container). Validate the signature/versions/flags/declared lengths and payload hash **before inflating**. Inflation is streaming in 4096-byte compressed chunks into a bounded declared-size buffer; over-expansion and truncation are rejected. Then validate schema 2 and all semantic references. Containers never silently migrate a mismatched embedded schema.

Scene order is explicit. The active scene lives in the document root; only inactive scenes live in `scenes`. Document identity is stable inside a library. Importing the same identity when it already exists creates a separate imported document rather than overwriting work. Files remain independent of a chosen OS export folder.

Future readers should reject unknown container/schema versions with an explanatory message and leave the open project untouched. Future writers must supply explicit tested migrations. Do not reinterpret unknown flag bits or silently discard new scene data.

## Compatibility limits

32 scenes, 500 layers/scene, 200 bones/rig, 1800 frames/scene, 64–4096 px canvases, 1–60 FPS, 32 audio clips/scene, and bounded embedded/stroke/text data. Audio import/export decoding has a stricter five-minute limit. Full-format validation lives in `src/engine/project.ts`; the codec in `src/engine/lam.ts` is shared with native validation.
