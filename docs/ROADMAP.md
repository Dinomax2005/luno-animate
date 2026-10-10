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

## Future features (not claimed in v0.3.5)

- Reusable symbols and nested timelines.
- Vector shape morphing, masks/clipping, richer paths/brushes.
- Arbitrary mesh skinning, deformable art/weights, richer custom rig creation.
- Lip-sync and stronger audio/scene editing.
- Better large-document undo/memory budgets and GPU rendering.
- Broad platform/codec compatibility and production export pipelines.
- Optional password encryption (not “only this program can read”).

Prefer small, tested workflows over inflated feature counts. Keep legacy documents recoverable and project data independent of updates.
