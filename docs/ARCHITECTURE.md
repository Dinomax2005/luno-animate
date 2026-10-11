# Architecture · v0.3.7

## Local-first boundaries

There are no creator accounts, telemetry, cloud storage, remote fonts, backend, or server-side encoders. React renders an offline SVG studio. Electron adds a narrow context bridge, native file dialogs, filesystem persistence, and optional GitHub update traffic. Artwork never goes to the update service.

## Versioned engine

`Project` is schema 2: stable document identity, global canvas/FPS, three animation modes, shared immutable media assets, ordered scenes, and an inline active scene plus separate inactive scenes. Each scene owns layers, keys, cels, camera, sounds, duration, background, and work area. Activating a scene creates a new root and retains the previous scene; it does not duplicate or discard its art. Schema-1 `.luno` JSON migration supplies scene/camera/audio defaults without changing original source files.

Zod and semantic validation check bounds, identities, duplicate frames, missing layer/bone/scene references, rig/layer cycles, audio timing, and work areas. `.lam` adds a versioned compressed container, bounded inflation, and payload integrity checking; see [LAM-FORMAT](LAM-FORMAT.md). Checksums detect accidental corruption, not authorship or malicious changes.

`project.ts`, `animation.ts`, `rig.ts`, `geometry.ts`, `clips.ts`, and `keyframes.ts` are UI-independent. Affine matrices compose animated group/rig/attachment ancestry. Layers paint in coherent hierarchical stacks; sibling ordering controls stacking. Visibility, opacity, and locking inherit. Cutout parts follow selected bone positions/angles; imported art is not automatically mesh-skinned.

## Sampling and rendering

`Project + active frame → sampled channels/cels/camera → hierarchical RenderNodes → shared SVG artwork`

Forward kinematics resolves bone hierarchies; connected hand/foot IK maintains segment lengths and bend direction, clamps reach, and respects joint locks/limits through editor actions. Shift performs direct rotation. Text is escaped React content. SVG image imports are rasterized into embedded PNGs, not inserted as untrusted markup.

Nine easing modes include configurable cubic Bézier, overshoot, bounce, elastic, hold, and conventional curves. Auto-key seeds the starting pose before a later edit. Timed layer visibility and sampled blur/brightness/saturation/opacity use the same renderer as exports. Video frames are looked up by scene/source time and asset FPS; inactive/out-of-source footage is omitted. Easing/Bézier metadata remains shared at each physical key, not independently stored per channel. Drawing cels hold until the next cel unless single-frame exposure is selected; empty cels end a held drawing. Camera channels use position, zoom, and rotation independently of editor pan/zoom.

Editor-only grids, onion ghosts, handles, paths, bones, and guides do not enter exports. Shared `SceneArtwork` implements all real artwork. Uniform animated grouping can be flattened by baking child keys at every frame; lossy skew/out-of-range flattening is refused instead of silently changing the picture. Attaching/detaching parts explicitly warns about replacing transform keys; Undo retains the previous state.

Elapsed-time requestAnimationFrame playback respects FPS, work range, loop/pause, and document visibility. Sound playback follows the same frame clock, seeks on loop/scrub, and pauses outside playback. A separate sound subscriber avoids rerendering the entire app every frame.

## State and transactions

Zustand holds immutable document roots and transient selection/tools/playback/modal state. History is limited to 40 document snapshots. Pointer gestures record one checkpoint, then make non-recording updates; timeline key drags commit on release. Keys can be selected/copied/pasted with relative timing and fresh IDs. Property-lane refs optionally identify one pose channel. Pure key helpers split/merge/remove only selected values, preserving other transforms/effects/bones and occupied-frame easing when unrelated values remain. Full-key and lane selections are canonicalized to avoid duplicate destructive edits. Immutable media is shared across history rather than cloned per pose update. Clip trims preserve all source frames, adjust linked audio offsets, and bound restoration by source/audio/scene availability; moves also preserve authored keys/cels outside the clip. Pixel-tolerant snapping previews the same bounded timing that will commit. Scene/layer duplication rebinds group/rig references and key IDs.

History/selection are not persisted. Renderer file/navigation services serialize writes, check document identity before marking saved, and flush before switching projects/home. Imported document ID collisions receive a new document identity rather than overwriting another project. Native preparation blurs pending fields before taking the final save snapshot. Browser unload warns during dirty/failed saves, ongoing gestures, and protected navigation; it cannot await asynchronous disk writes, so wait for the saved indicator before closing a tab.

## Two real repositories

**Browser:** IndexedDB atomically stores binary payload + card metadata; revisions and the replacement document share one readwrite transaction. Failed transactions abort cleanly. Three prior saves, favorites, trash, and preferences persist. Storage cleanup/quota and conflicting edits in multiple browser tabs remain browser limitations; portable copies are the safety net.

**Desktop:** one serialized vault stores `library/projects/<safe-id>/<sequence>-<uuid>.lam`, with an atomic `entry.json` pointer. It fsyncs a complete immutable revision before changing the pointer and retains the current + three prior revisions. Numeric monotonic sequences tolerate a backwards wall clock. Trash is metadata until explicit permanent deletion. Damaged pointers offer recovery; a damaged project cannot be silently omitted from an update backup.

Complete native snapshots include projects/trash/revisions, studio settings, and the default export-folder setting. Copy/read/parse/integrity verification and file/directory fsync precede committing their manifests. Five verified snapshots are retained. Restore first validates a staged tree, protects the current library in a new backup, and records a durable rollback journal before swapping directories/settings. Startup rolls back incomplete restores. Initialization failures remain fail-closed across every subsequent request. Backups are local; export important projects to other media as well.

The v0.1 current-project localStorage key is imported once; a migration recovery copy remains. Invalid legacy storage also retains a recovery copy. An uninstall does not intentionally remove desktop creator data.

## Bounded video import

Mediabunny probes and decodes supported MP4/WebM/MOV/M4V input; failed/unsupported codecs or cancellation never add partial clips. Import is limited to 150 MB, 30 seconds, a 960px proxy long side, project FPS, and a 24-million-character JPEG budget inside the aggregate 64 MB LAM limit. The importer copies decoded frames into its own OffscreenCanvas (synchronous HTML-canvas fallback), builds embedded PCM16 WAV sound/waveforms, then validates the entire candidate project before a single undoable insertion. Progress is rate-limited; an identity check rejects a document switch mid-import. Shared proxy assets are reused by split/duplicate clips and pruned only when no scene references them. This is portable proxy editing, not full-source conforming/relinking.

## Media exports

- **SVG/PNG:** shared sampled vector artwork; embedded imports remain raster. PNG supports transparency and up to 8192 px per side.
- **GIF:** sampled scoped scenes/work areas, palette quantization/real GIF encoding; 300 frames/960 px, progress and cancellation, no sound.
- **MP4:** capability-probed WebCodecs + Mediabunny MP4 muxing; H.264/AAC preferred, AV1/Opus fallbacks are disclosed. OfflineAudioContext mixes audible clipped/trimmed scene tracks at correct timeline offsets. Video/audio encode concurrently with cancellation/progress. Up to 300 seconds/18,000 frames/150 MB. No cloud converter.
- **Sprite ZIP:** transparent PNG atlas plus ordered per-frame JSON, max 256 frames/8192 px atlas.
- **LAM:** the entire editable document, independent of the current export scope.

Media and server-side React serialization are lazy-loaded. Build output contains all needed chunks/fonts and an exact unmodified Mediabunny source ZIP with MPL notices.

## Guarded updater

`electron-updater` is bundled into an isolated native module; development/unsupported platform installs are disabled. Feed: public `Dinomax2005/luno-animate` stable releases, newer semantic versions only, never downgrades. Automatic checks start after 20 seconds and repeat every 6 hours; checks do not block offline editing. SDK eager downloads and quit-triggered installation are disabled; the controller explicitly downloads then guards installation.

Clean 120-second idle + a 30-second cancellable warning precede automatic installation. Pointer/key/input/wheel, playback, gestures, dialogs, exports/imports, dirty work, and persistence failures prevent that restart. Manual install still requires no active operation. Installation requires a UUID renderer save acknowledgement (45-second timeout), flushed vault, and successful verified complete backup. Any failed/interrupted preparation or backup leaves the app open/resumes editing, with a delayed retry. Only this guarded path permits silent `quitAndInstall`.

Stable published releases must include matching `latest*.yml`, checksum-referenced installers/ZIPs/AppImages, and block maps. A draft/prerelease/Actions artifact is not a stable feed. Unsigned macOS and system-package Linux use manual updates. End-to-end installation still requires target-OS/release/signing validation, not just mocked policy tests.

## Desktop security

Sandbox/context isolation/web security remain enabled; Node is not exposed. Main IPC verifies sender window/origin, argument types/size bounds, safe project IDs, and document integrity. No arbitrary renderer path is accepted; native dialogs choose external paths. Permissions are denied. Remote navigation/scripts/assets/frames/plugins are blocked; external links are restricted to this repository's HTTPS GitHub pages. CSP permits local data/blob media for offline audio/images/exports.

Native tests run against temporary directories; packaged smoke uses an isolated test profile with updates disabled. Build/release scripts verify exact successful source, flatten asset filenames, and validate manifest SHA-512 plus flat SHA-256 download checksums before drafting a release.

## Explicit external-file saving

`electron/document-files.cjs` issues main-process opaque capabilities only for validated regular `.lam` paths selected in the OS picker or received by file association. Renderer Save supplies only the capability and bounded bytes—not a write path. Capabilities bind the external project ID; the service checks identity, size, checksum, path location, file identity/mtime/SHA-256, write permission, and non-vault/non-symlink status. Atomic staging fsyncs the data, checks the destination again immediately before rename, preserves file permissions, then verifies the written file. A moved/deleted/changed file is refused; new Save As detects a file appearing during staging. Writes are serialized. These checks reduce ordinary conflict/race risks but are not a portable filesystem compare-and-swap or a guarantee against every OS/hardware race.

The preload exposes `documents.open/save/saveAs` and descriptor-bearing associations. Renderer `services/document-files.ts` stores session-only links under the **actual** library ID after collision cloning. It serializes the source document ID for direct Save; successful Save As alone switches the link. Recovery/deletion/restore clear links. Compatible top-level secure browsers use transactional writable file-system handles with hash/mtime conflict checking and permission requests. Ordinary file inputs, legacy JSON, unsupported browsers, and cross-origin iframe previews use an honestly labelled copy/download fallback. Source permissions are not persisted in portable files or across restarts. Library autosave remains separate; a failing local store cannot block an explicit portable rescue save.

## Animation modes and launch

Schema-2 `animationMode` is backward compatible with a default of `rigged`. Hand-drawn factories create a selected single-frame drawing layer and two-frame scene; `nextDrawingFrame` creates or independently clones the next cel, extends duration/work area within bounds, and never clears an existing destination cel. New scenes and reopened documents apply drawing defaults. Manual-mode transforms do not automatically record keys. The existing rig/sampling workflow is retained.

`services/launch.ts` stores a validated startup preference and last acknowledged app version independently from artwork. After durable library initialization and the native association-ready handoff, one release-note dialog precedes an optional Start window. Associated files suppress Start. Existing dialogs/guarded operations are not interrupted, React StrictMode does not trigger duplicate launch UI, and both dialogs use the shared focus trap/Escape handling.


## Native launcher and independent layouts

The main BrowserWindow is created hidden; painting HTML alone no longer shows it. `startup-window.cjs` owns a separate frameless 460 × 282 sandboxed window with a nonpersistent partition and strict local CSP. Its dedicated preload exposes only status subscription, retry, and quit. Launcher IPC requires its exact sender and main frame; studio IPC requires the separate studio sender/main frame. Native ready-to-show and a trusted post-library/association/workspace-paint completion handshake jointly gate reveal. The launcher is destroyed first, then the main window is shown/focused. Error states cancel pending reveal; disposal removes action listeners/timers. Retry reruns renderer boot or reloads a failed renderer. Browser boot uses a compact card and hidden/inert app shell instead of a fullscreen screen. Start/What’s New remain ordinary optional/version-aware app dialogs.

Active layout storage remains `luno.workspace.pro.v1` for compatibility. `luno.workspace.pro.profiles.v1` keeps sanitized per-mode dock dimensions, visibility, timeline zoom, and snapping. Switching stores the current profile and restores the target; Reset affects only that profile. Focus/popouts/cursor stay transient. Layout persistence is independent of document history and the existing vault backup/settings schema, and must never block artwork saving.
