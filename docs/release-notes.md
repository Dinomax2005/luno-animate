## Luno Animate v0.2.0 — a real creative home

- Persistent project dashboard: thumbnails, favorites, search/sort, independent projects, rename/copy, Trash and recovery.
- Portable **binary `.lam`** with compression/integrity checking, all embedded artwork/audio/scenes/rigs/cels/keys, and non-destructive legacy `.luno` migration. Application-specific does not mean encrypted or exclusively decodable.
- Real **MP4** video with mixed audio, scene/work-area selection, progress, resolution and cancellation. H.264/AAC preferred, disclosed AV1/Opus fallbacks. PNG/SVG/GIF and sprite ZIP remain available.
- Multiple scenes, editable text, multiselect/group transforms, hierarchy locks/order, frame-by-frame cels/blank/copy/onion exposure, animated camera, waveform audio tracks, key clipboard, advanced easing/Bézier and more motion starters.
- Cutout artwork attachment, blank rigs, custom/parented joints, lengths, angle limits/locks and connected-limb IK.
- Native immutable save revisions, verified library backups, staged/journaled restore, guarded close/update save acknowledgement, and stable GitHub update controller. Idle warning and failed-save/backup protection come before installation.
- `.lam` OS association, Windows setup wizard, Intel/Apple silicon macOS DMG/ZIP, Linux AppImage/DEB, complete license notices/exact MPL source, and publishable update manifests/block maps with flat download checksums.

### Important early-release notes

This is not full Adobe Animate parity: symbols/nested timelines, mesh deformation, morphing, masks and lip-sync are not included. Projects stay local; GitHub is contacted only for updates/downloads. Export portable backups; storage/hardware failures cannot be universally prevented.

Installers are unsigned development builds unless certificates are configured. Unsigned macOS and DEB/system-managed Linux use manual updates. Automatic delivery requires an actually **published stable** release with the supplied manifests; drafts/prereleases/Actions artifacts are not an update feed. Actual Windows/macOS installation, signing, and previous-version update testing are owner release checks; do not present unit simulations as full OS installation validation.

Actions artifact ZIPs expire after 30 days and require GitHub sign-in. Public release assets do not. Verify flat `SHA256SUMS.txt`; keep installer names exactly as referenced by update manifests. Version 0.1 users need one manual v0.2 installation before using the updater.
