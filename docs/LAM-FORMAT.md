# Portable `.lam` format

Luno Animate v0.4.0 writes `.lam`, a **binary project format**, not JSON with a different filename. It includes every ordered scene and embedded image/video/audio, rig, layer hierarchy, drawing cel, text, key, camera, and work area. File associations register Luno as its editor. Legacy `.luno` JSON remains importable and is never overwritten by migration.

This is an application-specific format, **not a claim that only Luno could ever read it**. Someone could implement the decoder below. There is no password encryption, licensing lock, or DRM. SHA-256 detects accidental corruption, not a malicious author's intent.

## Container version 1

All integer fields are little-endian; the fixed header is 56 bytes:

| Offset | Length | Value |
| --- | --- | --- |
| 0 | 8 | `LUNOLAM\0` (bytes `4c 55 4e 4f 4c 41 4d 00`) |
| 8 | 2 | Container version: `1` |
| 10 | 2 | Flags: `1` (raw DEFLATE) or `3` (raw DEFLATE + advanced painting) |
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

## Animation document type (v0.3.5)

Schema 2 now includes `animationMode: "rigged" | "frame-by-frame"`. The container version, schema number, magic, bounds, and checksum format are unchanged. Older schema-2 files that omit the field default to `rigged`; legacy JSON migration remains supported. Hand-drawn documents start with `holdCels: false`, exact-frame cels, and no generated in-between drawings. Their type and all cels survive portable saving, library autosave/recovery, and scene switching.

External filenames, permission tokens, and browser handles are **not embedded** in `.lam` payloads or portable copies. The renderer keeps session destinations by the actual library ID, while a collision-cloned library document preserves the external document’s original ID when saving back to its source. Save As creates a new external identity from the library document. Copy export never retargets Save.

## Timed layers and embedded video (v0.3.6)

Schema 2 additionally accepts `animationMode: "video-editing"`; omitted modes still default to `rigged`. `media` defaults to an empty array for older files and is shared across all scenes. Assets contain a unique ID/name, dimensions, FPS, and bounded JPEG data-URL frames. Items reference `videoAssetId` rather than duplicating frames. No file-system path or remote URL is stored for playback. Older app versions do not understand video documents; use v0.3.6 or newer to open them.

Layer `startFrame`/exclusive `endFrame` control visibility; `sourceStart` is measured in seconds. Video source sampling uses the scene FPS and asset FPS; out-of-range footage is not displayed. Optional `linkedAudioId` identifies an audio clip in the same scene. Audio `endFrame` is also exclusive and bounds playback/export. Moving/trimming sound independently unlinks it from video; mute/volume do not. Blur (0–50 px), brightness/saturation (0–3), and their keyframe channels use the shared SVG renderer. Asset/range/channel/ID/reference validation runs before project insertion and native saving.

Video input is limited to 150 MB/30 seconds, proxies to a 960-pixel long side at project FPS and 24 million JPEG data-URL characters per import. At most 32 shared assets are supported, with 1–1800 bounded frames each, within the existing 64 MB total payload limit. Split/duplicate clips share immutable source data; deletion prunes only assets no longer referenced by any scene. The LAM container version, magic, schema number, digest, compression and application/storage identity remain unchanged.

## Precision editing (v0.3.7)

Property-lane selection/clipboard and workspace profiles are editor preferences, not new file fields. Lane edits split/merge the existing `values` pose while retaining unrelated channels and bone values; duplicate frame/key-ID validation still applies. A physical keyframe has one easing/Bézier curve shared by its channels. Restorable trim uses the existing source offset/range fields and shared media; no source frame is deleted. Container/schema/app/storage identity are unchanged and v0.3.6 can read v0.3.7 video documents.

## v0.4.0 advanced painting feature flag

The container remains version 1 and the document remains schema 2. Header flags now accept `1` (compressed legacy-compatible content) and `3` (compressed content plus painting flag `2`). The writer scans **all scenes**, including inactive ones, for brush metadata, point pressure, paint/erase modes or fill runs. Advanced painting requires flags `3`; a flags-`1` payload containing it is rejected. Unknown flags are rejected. Older readers accepting only flags `1` cannot silently open and strip the new artwork.

Optional `Stroke.brush`, `Stroke.mode`, `Stroke.fill`, `Point.pressure` and vector `SceneItem.brush` carry validated procedural data. Texture seeds, opacity/flow, pressure behavior and erase order are portable. Fill stores local-coordinate horizontal runs and cell size; it is not an external image. Legacy strokes without these fields retain their original SVG path.

Brush size is at most 256; pressure is finite in [0,1]; raw points, fill runs, and per-cel/per-scene procedural work are bounded. The existing 64 MB raw/compressed document budgets and SHA-256 integrity checks remain. `.lunobrush` is a separate strict JSON brush-preset/swatches format, not a LAM project.
