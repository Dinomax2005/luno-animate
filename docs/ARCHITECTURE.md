# Independent architecture

- `src/core/model.ts`: new unified document/layer/asset/scene types and factories. No former `SceneItem` or legacy mode decoder.
- `src/core/codec.ts` / `validate.ts`: new `PEGB1LAM` container, schema 1, bounded inflation, SHA-256, strict references/timing/hierarchy/raster/work budgets.
- `motion.ts` / `bounds.ts`: property interpolation, implicit initial pose, transforms, FK/IK and hit-testing geometry.
- `assist.ts`: on-device timing analysis. Samples the curve the keys already describe to place in-betweens without moving existing poses, reports spacing, pops, dead holds and linear ramps, and names the fix that matches each finding. No network call, no model, no account; the panel is a readout over data already in the document.
- `paint.ts` / `render.ts`: procedural painting, active-cel compositing, bounded fill, Canvas scene renderer and bounded caches. Stage, thumbnails and output share rendered artwork; guides are separate.
- `media.ts` / `export.ts`: bounded media decoding and PCM normalization; MP4 and WebM encoding with audio mixing; PNG, sequence, sprite-atlas, SVG and `.lam` output.
- `src/state/studio.ts`: immutable structural transactions, guarded gesture previews, single-step Undo, cels, key edits, clip splits, scene and reference actions.
- `src/services`: local repository with revisions, collision-safe adoption, approved external file links, command registry and audio transport.
- `src/components`: independently authored project home, brand/workspace chrome, Navigator, Inspector, Stage, Timeline, dialogs and update warnings.
- `desktop`: sandboxed native shell, a separate startup window, narrow preload capabilities, trusted-frame IPC, new profile/partition, generation-based atomic library, external-file conflict checks and verified collection backup/restore.

Only `studio.pegbar.studio`, the Pegbar Studio profile and `studio-v1` updates belong to this supported product. The profile is adopted from the 1.0 folder by rename on first start; the channel name is kept unbroken so an existing installation can find 2.x. The app id changed with the rename, so an NSIS update may install beside a 1.0 build instead of over it. Pre-1.0 archives remain unsupported and are not migrated. No account server or payment system exists.

Native collection restoration verifies every captured project before publishing a new active collection pointer. Update installation waits for a renderer durable save and a verified backup, and pauses during active work, playback, modals or external file changes. These guards reduce risk; they are not a universal damage-free guarantee.
