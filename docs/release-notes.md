# Luno Animate v0.4.0 — Brushes & Paint

A substantial painting update, not just a theme change. The professional blue workspace and separate small startup window remain.

## Painting workspace

- **Twelve procedural brushes:** Studio Round, Smooth Ink, Soft Airbrush, Felt Marker, Calligraphy, Graphite, Dry Bristle, Chalk, Pixel Square, Scatter Spray, Stipple and Neon Glow. Brush settings and texture seeds are captured per mark.
- **Brush Studio:** searchable/category-filtered presets, scaled scratchpad, relevant tip/dynamics controls, stabilization, optional pressure/taper, flow, opacity, blend modes and two-/four-way symmetry. Open **Paint → Brush Studio** or **Ctrl/Cmd+Shift+B**.
- **Color Studio:** HSV/HEX controls, native picker, foreground/background pair, four palettes, recent colors and saved swatches. **X/D** swap/reset; **[/]** change paint-tool size.
- **Custom brushes:** saved presets and additive, validated `.lunobrush` packs containing presets and swatches. Settings are saved locally and in library backups, including native restarts.
- **Tools:** **B** brush, **E** cel-only non-destructive eraser, **F** connected-area fill, **I** composited-stage eyedropper; **Alt** temporarily samples with the brush.
- **Animated paint:** new paint layers in all three modes, editable/recolorable/restylable stroke stack, held-exposure-safe edits, F6/F7 manual cels, onion skins, atomic Undo/Redo and shared preview/export rendering. Vector brush strokes remain transformable in rig/motion and video projects.

## Compatibility and limits

Legacy projects keep their old stroke rendering and remain loadable. Advanced painting uses LAM feature flag `2` with compression (`3`), requiring **v0.4.0 or later**; old readers reject unsupported artwork rather than silently stripping it. The schema-2 project/container-v1 identity is retained.

Fill works on the active cel, not all composited layers, at up to 1024 px on its longest side. Eyedropper rendering is capped at 2048 px. Painting uses bounded geometry/detail budgets and checks the existing 64 MB project limit before committing. Pressure depends on supported hardware/browser input; this is not a physical paint simulation, calibrated color-management system or Photoshop-equivalent raster engine. See [PAINTING.md](PAINTING.md).

## Preserved workflows and updates

Three document types, rigging/FK/IK/cutouts, precision motion channels, clip trim/split, camera, linked overwrite Save/Save As, library autosave/revisions, protected backups, portable `.lam` and MP4/audio export remain. Video still uses portable JPEG/WAV proxies up to 30 seconds and 960 px, not embedded full-source editing.

Use **Updates & backups → Check GitHub** in updater-enabled installations. Newer stable releases only; checksum verification, durable save and a verified backup precede restart. Windows NSIS and writable Linux AppImage support in-place updates. Unsigned macOS and DEB installs require manual/package-manager updates. Keep independent `.lam` backups; physical Windows/macOS cross-version upgrade testing and signing are not claimed.

---

# Luno Animate v0.3.7 — Blueprint / Precision

## A small window first, then the studio

The fullscreen startup screen is removed. The installed application now opens a **separate 460 × 282 native launcher** with the blue eclipse mark and “Starting up Luno Animations”. The actual studio stays hidden until the local library, associated document, and ready workspace paint are prepared. The small window closes **before** the main window is shown. Errors offer Retry or Quit rather than exposing a half-ready editor. Its isolated preload has no document/library/updater capabilities. Browser previews use a compact startup card; they cannot create a native desktop window.

## A coherent blue professional interface

Blue charcoal and light themes, blue eclipse icons/installer artwork, stronger panel hierarchy, readable selections, explicit keyboard focus, and technical document-settings copy. The dense menus/tools/property workflow is retained; this is not a tutorial-first redesign. Existing artwork is never recolored.

## Precision that changes how you edit

- Expand animated layer chevrons into authored property tracks. Move, copy, paste, or delete lane diamonds without discarding unrelated transforms, effects, or rig poses. Occupied-frame pastes merge unrelated values; Undo restores overwritten values.
- Clips snap to the playhead, neighboring clip/sound boundaries, scene, and work area. A visible guide identifies the alignment. The magnet toggles snapping; hold **Alt** to bypass.
- Clip edges and **Timing → Clip in / Clip out** can restore available source footage, not just shorten it. Source and scene limits are honored; linked sound follows the edit. Clicking an edge without moving is a safe no-op.
- **Ctrl/⌘ Shift D** now actually splits rather than duplicating. Clip/diamond arrow keys support precision timing. The playhead ruler adds Home/End and one-second Page Up/Down navigation.
- Opacity sliders and effect reset edit the animated values at the playhead. A continuous opacity drag is one undo gesture.
- Animation, Drawing, Rigging, Motion, and Video editing retain independent dock sizes, visibility, timeline zoom, and snapping across switching/restarts. Reset changes only the active workspace.

## Compatibility and limits

All three document modes, FK/IK/cutout rigs, manual drawing cels, ordered scenes, camera, linked-file overwrite Save, copy export, autosave, revisions/backups, and MP4/audio export remain. Application/storage identity and LAM container/schema are unchanged; v0.3.6 and v0.3.7 video files are interoperable.

**Video remains bounded proxy editing:** 150 MB input, 30 seconds/960px per clip, project FPS, 24 million JPEG characters/import, 32 media assets, and the 64 MB portable-project limit. Export size cannot recreate full-source detail. Easing is shared by channels at the same physical keyframe; independent per-channel curves, arbitrary-length/full-source footage, group effects/timing, masks, nested symbols, and media relinking are not implemented. This is a usable early studio, not a claim of Adobe/Alight parity or a measured “10×” gain.

## Install and update

Use the assets attached to this release. Existing updater-enabled Windows NSIS and Linux AppImage installs can use **Updates & backups → Check GitHub → Save, back up & restart** without uninstalling. The guarded save/verified-backup path remains unchanged. Unsigned macOS and DEB/system-managed Linux still update manually. Installers remain unsigned development builds; physical Windows/macOS upgrade tests are not claimed.

Earlier releases are left untouched; this is a new version, not replacement assets for 0.3.6.

---

# Luno Animate v0.3.6 — Eclipse / Motion / Video

## Layer motion studio

Rig / motion now opens a dedicated Motion workspace with timed layer clips, drag-to-move and trim handles, individual transform/effect keyframe diamonds, and an editable Bézier graph. Animate blur, brightness and saturation, or add opacity fades. Split and re-time artwork without deleting other animation channels. Existing FK/IK, character poses, cutout attachments, manual drawings, camera and scenes are retained. This is an Alight Motion–inspired workflow, not feature parity.

## Third mode: Video editing

Choose **Video editing** in Start or New. Import actual MP4/WebM/MOV/M4V footage into embedded JPEG proxies, with decoded sound linked to the clip. Use Timing to trim/split, drag to arrange, and add text/artwork/drawing overlays with the same property animation and effects. Video trim/split/move follows linked sound; independently moving or trimming sound unlinks it. Portable `.lam` saves include all proxy frames and sound. MP4 exports render the edited footage, overlays and mixed audio.

**Limits:** 150 MB input, 30 seconds per clip, 960px maximum proxy long side, project FPS, a 24-million-character JPEG budget per import, 32 shared media assets and the existing 64 MB portable-project limit. This is bounded proxy editing—not an arbitrary-length or full-source-quality video editor. Exporting a larger resolution does not restore original detail. Trim handles shorten only; Undo restores. Group effects/timing, masks and external-media relinking are not implemented. Codec support depends on the device; failed or cancelled imports do not add partial footage.

## Startup and red eclipse identity

A real **“Starting up Luno Animations”** screen appears before the interactive app, while the library and associated file initialize. It includes an HTML fallback and error/retry state, and keeps editing locked until ready. The Start/New/Open/Recent launcher remains a separate, remembered preference. The new red solar-eclipse mark is used by the app icon, installers, favicon, header and splash, with red accents in dark and light themes.

## Existing work and updates

Save still overwrites the opened approved `.lam`; Save As and copy export remain separate. Older hand-drawn/rig projects, library revisions/backups, app identity, storage location, file protections and the guarded updater are preserved. Video documents require v0.3.6 or newer.

Windows NSIS and Linux AppImage can update in place through **Updates & backups → Check GitHub**. There is no need to uninstall. Unsigned macOS/DEB need a manual newer installer/package update; v0.1 needs an initial manual upgrade. Installers are unsigned development builds. Physical Windows/macOS upgrade testing and signing/notarization remain outstanding. Keep independent portable backups; no software can guarantee against every hardware/OS failure.

Release assets and updater manifests are validated for the exact release source; the public feed consumer covers installed v0.2.0/v0.3.4/v0.3.5. Public downloads need no GitHub sign-in. Prior releases are not replaced.

---

## Previous release notes

# Luno Animate v0.3.5

## Save to the document you opened

- **Save / Ctrl or Cmd S** overwrites the opened, approved `.lam` file instead of always exporting another copy.
- **Save As / Ctrl or Cmd Shift S** selects a new destination; subsequent Save uses it only after a successful, verified write.
- **Export .lam copy** remains a separate operation and never retargets the working document.
- Opening a file does not modify it. Native saves use main-process opaque capabilities, bounded LAM validation, atomic staging/fsync/replacement, and file verification. File identity, SHA-256, modification time, write permission, and internal-library/symbolic-link protections are checked before replacement.
- An externally changed or missing file is not silently clobbered or recreated. Cancelled/failed Save As leaves the previous destination intact. Errors remain in a header banner with Save As; a document-tab `*` marks modified file content.
- Browser file-system handles support direct saving where permitted. Ordinary imports, unsupported browsers, and cross-origin embedded previews download a copy with an explicit limitation message. File permissions are session-only; after restarting, a recent library snapshot needs Open/Save As to link an external file again.
- Library autosave/revisions/backups remain independent. An unavailable local autosave store does not prevent an explicit portable rescue save; its failure still blocks a protected update.

## Two animation document types

**Hand-drawn** starts with a selected drawing layer, a cel brush, onion skin, and automatic transform keys disabled. Each cel is a single authored frame—empty frames stay blank in playback and exports. **F7 / Blank frame** advances to a new empty cel; **F6 / Duplicate frame** advances with an independent copy. Existing destination drawings are preserved, and the timeline/work area grows as frames are created, within the scene limit. Scenes and portable projects retain the mode.

**Rig / motion** retains vector drag/transform editing, pose keyframes and interpolation, cutout attachments, and FK / IK rig controls. Existing `.lam` files without the new optional schema-2 mode field default to this workflow. The LAM container version, format limits, and application identity remain unchanged.

## Focused startup windows

- A compact, Photoshop-inspired **Start** window offers New document, Open, two animation types, and recent library documents.
- Its startup checkbox is remembered; **Help → Start window** reopens it manually.
- **What’s New** automatically shows the current changes once per application version and can be reopened from Help.
- Native file associations finish opening before launch UI and do not show Start over the canvas. Existing operations and dialogs are not interrupted.
- The professional v0.3.4 workspace is retained; optional workspace configuration remains under Help rather than an automatic beginner wizard.

## Validation and retained features

Expanded engine/renderer tests cover actual cels, document compatibility, save targets, cancellation/failure handling, version acknowledgement, and launch preferences. Native tests exercise repeated atomic overwrite, forged targets, stale/deleted/read-only/symlink/internal files, staging conflicts, and recovery after a failed replacement. Browser acceptance tests draw/play/export/reopen hand-drawn documents and verify both modes, focus, repeated file-handle saving, collision-safe imports, Save As, and persistent errors. The packaged Linux smoke exercises actual disk overwrite, cancellation, Save As rebinding, external conflicts, library backups, LAM association/restart, and real MP4 audio decode.

Scenes, nested layers/groups, camera, cels, keyframe/easing controls, rigging, embedded audio, MP4/GIF/PNG/SVG/sprite export, durable library revisions, verified backups, and the guarded updater remain available. This is an independent early-stage animation editor—not Adobe software or full Animate parity.

## Update and platform notes

Use **Updates & backups → Check GitHub** in an updater-enabled installation. Do not uninstall or clear application data. Newer stable releases only: checksum verification, durable library save, and a verified backup precede restart; busy operations or a failed save/backup block installation. Modified linked files block automatic restart until explicitly saved.

- **Windows x64:** NSIS in-place updates; unsigned builds may show publisher/SmartScreen warnings.
- **Linux x64 AppImage:** built-in update when the AppImage is writable. DEB/package-manager installs require a manual/package-manager update.
- **macOS Intel/Apple silicon:** unsigned DMG/ZIP development builds; manual replacement retains the library. Built-in installation is disabled without Developer ID signing. Do not bypass Gatekeeper.
- **v0.1:** has no updater and needs one manual upgrade.

Windows/macOS GUI cross-version installation has not been independently exercised on physical systems. Filesystem conflict checks are not a portable compare-and-swap or a guarantee against all OS/hardware races. Keep independent `.lam` backups of important work.
