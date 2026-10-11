# Roadmap

## v0.2: implemented

Real persistent all-project home; schema-2 scenes; portable binary LAM with legacy migration; WebCodecs MP4 with sound/progress/cancel; vector/text/group composition; drawing cels/onion exposure; key clipboard and advanced easing; camera; audio waveform/timing; FK/IK/custom/limited joints and cutout attachments; filesystem revisions/backups/transactional restore; guarded newer-stable GitHub updater; installer associations/feed manifests; beginner-first setup.

## Validation and distribution work

Clean Windows/macOS runtime/install testing, signing/notarization, and a real published-version update exercise on every supported OS remain release responsibilities. Hosted installer creation/Linux packaged smoke and mocked updater failure tests are not replacements for those checks. Configure/publish stable GitHub release manifests for automatic update delivery. Browser cross-tab concurrent editing is not coordinated.

## v0.3.4: implemented

- Production-first document manager and blank-document defaults.
- Eight menus, command search, technical Properties, resizable docks, timeline zoom, stage rulers/context actions, persistent workspaces, and light/dark themes.
- Public stable release packaging with unchanged application/storage identity, exact checksums, and all three updater feeds.
- Configuration forms replace beginner mascot/tour screens; motion presets are optional collapsed controls.

## v0.3.5: implemented

- Explicit Save overwrite, Save As rebinding, separate copy export, visible failure/cancel status, and source-file capability/conflict protections.
- Backward-compatible hand-drawn versus rig/motion document types, preserved cels, manual next-frame workflow, and timeline growth.
- Compact Start/New/Open/Recent launcher and acknowledged once-per-version What’s New with manual Help access.
- Native disk-failure tests, browser file-handle/launch/mode acceptance, and packaged repeated-save/Save As/conflict smoke.

## v0.3.6: implemented

- Alight Motion–inspired timed layer bars, independent transform/effect keys, accessible editable Bézier graph, and Gaussian blur/brightness/saturation/opacity transitions; existing FK/IK cutout rigging retained.
- Third Video editing document type and workspace: bounded real video decoding, embedded JPEG proxies, linked PCM sound, non-destructive trim/split/move, animated overlays, and the shared export renderer.
- Real VP8/Opus footage acceptance, pixel-sampling, linked edit/save/reopen, playable non-silent MP4 output, cancellation, and malformed/oversized-input rejection.
- Pre-workspace startup/readiness/retry screen, static HTML fallback, red eclipse SVG/PNG/ICO/favicon and installer artwork, and red light/dark accents.
- Portable media sharing in undo/history and cross-scene references, bounded lifetime validation, and automatic unlinking for independently re-timed sound.

## v0.3.7: implemented

- Separate compact native launcher → close → ready main studio, isolated narrow bridge, failure/retry/quit, compact browser fallback instead of fullscreen loading.
- Blue dark/light studio and eclipse/installer identity; clearer focus/selection states and technical settings copy.
- Expandable authored property lanes; channel-safe move/delete/copy/paste with rig/effect preservation; keyboard timing nudges.
- Pixel-tolerant magnetic clip alignment with a visible guide and Alt bypass; source-restoring trim handles/fields and linked sound.
- Remembered independent workspace dock/visibility/zoom/snap profiles; real split shortcut; sampled opacity/effect edits; standard ruler keyboard navigation.

## Future features (not claimed in v0.3.7)

- Reusable symbols and nested timelines.
- Vector shape morphing, masks/clipping, richer paths/brushes.
- Arbitrary mesh skinning, deformable art/weights, richer custom rig creation.
- Lip-sync and stronger audio/scene editing.
- Full-resolution external-media conform/relink, longer footage, extendable source handles, masks, and a dedicated audio mixer.
- Better large-document undo/memory budgets and GPU rendering.
- Broad platform/codec compatibility and production export pipelines.
- Optional password encryption (not “only this program can read”).

Prefer small, tested workflows over inflated feature counts. Keep legacy documents recoverable and project data independent of updates.

## v0.4.0 · Brushes & Paint

Twelve procedural brush families, captured per-mark settings/pressure/seeds, smooth and crisp pixel painting, a full painting/color dock, symmetry, non-destructive cel eraser, bounded fill, composited eyedropper, editable mark stack, custom presets/packs, shared animated-paint rendering and portable LAM feature flags. Physical pigment simulation, unlimited/full-resolution raster surfaces, CMYK/ICC color management, Photoshop/Adobe/Alight feature parity and universal tablet-driver compatibility are not part of this release.
