# Architecture

## Guiding choices

**Local-first, no backend.** The editor has no accounts, telemetry, cloud storage, remote fonts, or API dependency. This keeps first use simple and packaged use offline. A desktop bridge adds native dialogs without exposing Node to the renderer.

**One document, explicit version.** `Project` is a version-1 JSON document with canvas settings, ordered scene items, bone hierarchies, and per-item keyframes. Zod validates imports and recovery documents. Limits protect the renderer against oversized canvases, embedded images, cyclic rigs, reserved IDs, duplicate IDs/frames, and keys outside the timeline.

**Keep the engine independent.** Project construction, kinematics, pose capture, and interpolation are UI-independent TypeScript. Drawing/import/export need browser APIs; rig and animation logic do not. Future renderers can reuse the core document and sampling functions.

## Render path

`Project → sampleProject(frame) → SceneItem transforms → SVG primitives`

Characters use forward kinematics to position artwork parts. Bone local angles inherit parent world angles; each segment length stays fixed. The two-bone IK solver handles hand/foot endpoint drags, clamps unreachable targets to the limb's reach, and retains bend direction. Shift bypasses IK for direct joint rotation. Custom child bones are rendered as added character segments.

The same `ItemGraphic` / `SceneArtwork` components render the editor and exports. Selection handles, bone guides, grids, and playheads live outside exported artwork. Image imports are decoded and rasterized to embedded PNGs, including SVG imports, instead of accepting executable SVG markup into the DOM.

The initial character is procedurally assembled, not mesh-skinned. Arbitrary imported images support whole-object transform animation. A future mesh/weight system can add attachment data to the versioned document; do not present today's whole-image transforms as automatic skinning.

## Animation

A keyframe stores transform channels and optional bone-angle channels. Sparse channels are sampled independently. Interpolation supports linear, smooth in/out, soft landing, and stepped hold. Rotation channels take the short angular path; a full spin preset uses quarter-turn intermediate keys. Motions replace the selected layer's keys and remain editable.

Playback uses `requestAnimationFrame` and elapsed real time rather than incrementing a frame on every browser repaint. It respects document FPS, loop state, pause, and background-tab visibility. Auto-key records edits on animated/later frames, seeding frame zero when the first later pose is made.

## State and history

Zustand holds the document and transient editor state. Document-changing actions record immutable snapshots; undo history is bounded at 40 entries. Drag gestures begin one checkpoint and update without adding a snapshot for each pointer event. Redo is discarded when a new edit starts. Keyframe drags commit only on pointer release.

Only documents and preferences are persisted. Selection, playback, undo history, canvas pan, and modal state are transient. Autosave is debounced and flushed on backgrounding/unload. The header reports saving/saved/error state. Storage quota failures are surfaced and users can save a `.luno` file. Invalid stored documents preserve a recovery copy. Desktop unload failures get an explicit keep-editing/quit prompt.

## Exports

- SVG: static React serialization of sampled artwork; vectors remain vectors except embedded raster imports.
- PNG: SVG rasterized on a browser canvas; 1×/2× scaling and optional transparent background.
- GIF: each frame sampled/rasterized, palette-quantized, then encoded with `gifenc`. Full loop, progress, cancellation, up to 300 frames and 960 px longest side. The GIF format rounds delays to centiseconds.
- Project: complete versioned document, including embedded artwork and rigs.

The build preserves dependency/font license notices and exposes them in the Help dialog.

The export encoder and dialogs are lazy-loaded. All chunks/fonts are included in native packaging. No network renderer or export service is required.

## Desktop security

`contextIsolation`, `sandbox`, and `webSecurity` remain enabled; `nodeIntegration` is disabled. The preload exposes only save/open/export/folder and narrow menu/file-event subscriptions. Main-process IPC checks the originating window and URL, validates arguments and file-size boundaries, uses native dialogs, and writes atomically. No renderer-provided arbitrary filesystem path is accepted.

Permission requests are denied. Navigation is restricted to the bundled editor/local dev origin. External links are restricted to the project's GitHub path and open in the OS browser. Production CSP blocks remote scripts, embedded frames, plugins, and remote assets. The developer URL is accepted only in unpackaged mode and only for localhost HTTP.

## Adding a feature

1. Extend versioned document types/schema if the feature changes project data.
2. Implement sampling/math independently of UI where possible.
3. Add a store action and decide its undo transaction boundaries.
4. Share artwork rendering with exports instead of implementing a second renderer.
5. Add engine tests and a browser test for the creator workflow.
6. Update early-version limitations and migrate existing projects before changing format versions.
