# Luno Studio v1.0.1

Cursor and canvas-navigation release. The canvas now shows a paint cursor: a ring sized to the active brush tip that scales with zoom, with a crosshair and an amber centre dot, drawn above grids and selection guides. It appears on hover, hides outside the artboard and while playing, uses a dashed ring when the brush is smaller than the minimum ring so the exact paint point stays visible, and a dashed variant for the eraser. Plain cursors elsewhere follow the tool (crosshair for paint/fill/eyedropper, grab for hand, default for selection, text for type). No document, format or export behaviour changed.

# Luno Studio v1.0.0

A clean first Studio release: new code, scene engine, renderer, native shell, branding, interface, project format and verification suite.

## Interface

The visual layer was rebuilt against the current "AI interface" fingerprint and the result is locked in `DESIGN.md` as *Studio Instrument*: graphite surfaces, hairline borders, one amber signal accent, square panels with 2px controls and 3px overlays, shadow only for surfaces that float above the canvas, and a document table with a tool rail instead of a hero and feature cards. No gradients, glow, glass, violet or indigo; copy names the object or the action. The Luno mark and every package icon are flat and single-accent.

## Entirely free

No subscriptions, mandatory accounts, paid feature locks or watermarks. The free proprietary application licence restricts application redistribution/rebranding where rights are legally held; user-created output is not claimed by Luno.

## One document, three workspaces

- **Draw:** eight pressure-aware procedural brushes, stabilization, flow, pixel painting, non-destructive active-cel erasure, bounded fill, eyedropper, manual cels, held exposures and onion skins.
- **Motion:** editable vector shapes/type, transform/property keys, custom easing, grouping and a fresh FK/IK armature/attachment system.
- **Edit:** embedded image/audio/video media, waveforms, bounded decoded proxies, linked audio, trim/split controls and animated overlays.
- Scene ordering, work-area playback, references/notes, command search, resizable docks, focus mode, light/dark surfaces, and a real local project library.
- Linked overwrite Save, Save As, external-conflict protection, revisions and verified desktop backups.
- Actual H.264 MP4/audio output where supported, transparent PNG, PNG sequences, flattened raster SVG snapshots, and new compressed/integrity-checked `.lam` documents.

## Legacy support policy

**All previous Luno Animate releases and project formats are out of date and unsupported.** They are not silently converted or deleted. Keep independent legacy backups and export media from an old application before using those assets in Studio 1.0. This app has a new identity/profile and **studio-v1** update channel; do not expect an old updater or old .lam reader to become compatible.

## Limits and verification scope

64 MB projects; bounded procedural work; 1,800 frames per scene. Video inputs up to 100 MB / 30 seconds become 960px/20fps JPEG proxies—not full-source video preservation. MP4 jobs up to 1,800 frames / 120 seconds; PNG ZIP jobs up to 300 frames / 100 MB. AAC or Opus encoding depends on the device. SVG snapshots are flattened; editable vector data stays in `.lam`. 2D armatures are not mesh deformation or 3D.

Unsigned macOS and DEB updates are manual. Physical cross-OS upgrades and tablet verification are not implied by installer builds. No universal performance/parity or damage-proof upgrade claim is made.

## Owner review

The application licence is a draft covering rights the holder can legally license. It does not establish Arena/provider distribution permission or exclusive ownership of AI-generated output. Confirm legal entity, contact process, service terms and component obligations before a public/company distribution.
