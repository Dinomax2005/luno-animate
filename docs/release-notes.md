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
