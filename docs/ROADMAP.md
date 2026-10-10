# A sensible path from early studio to production tool

## Working foundation

- Drawing and imported artwork; vector shape library.
- Connected character bones; FK and two-bone IK; custom bones.
- Keyframes, auto-key, easing, editable motion presets, and timeline playback.
- Local persistence, validated project files, undo/redo, GIF/PNG/SVG export.
- Desktop packaging, first-run wizard, automated quality/build workflows.

## Next: richer drawing and rigs

- Editable Bézier paths, pressure-aware brushes, and fill tools.
- Frame-by-frame cels and onion skinning (not present in the initial build).
- Drawable part attachments, cut-out artwork segmentation, bind/rest poses.
- Mesh deformation, bone weights, skinning, rotation limits, and IK constraints.
- Facial parts, mouth switches, reusable/custom character assets.

## Next: larger animation projects

- Multiple scenes, nested groups/symbols, motion clips, copy/paste pose keys.
- Dedicated pose override buffers for manual-key workflows.
- Audio tracks, waveforms, lip-sync helpers.
- Video/WebM/MP4, sprite sheets, larger GIF rendering in workers.
- Optimized storage (IndexedDB/native assets), autosave versions, recent projects.

## Before calling it production-ready

- Choose an explicit source license before public open-source distribution.
- Signed/notarized installer releases and clean-machine installation tests.
- Native crash recovery and durable per-project backups.
- Large-document profiling, lazy asset decoding, worker-based export.
- Accessibility/contrast audit, touch-first inspector navigation, translations.
- Format migration tests, release/update policy, reproducible artifact checksums.

Adobe Animate has many years of drawing, scene, audio, and publishing features. Luno's initial build intentionally focuses on a small, usable pose → keyframe → playback workflow, not claims of complete feature parity.
