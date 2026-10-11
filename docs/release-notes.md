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
