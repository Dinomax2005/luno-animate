# Luno Animate v0.3.4

## Production workspace

- Conventional eight-menu application bar, document tabs, command search, and docked Layers, Library, Properties, and Timeline panels.
- Neutral charcoal interface, compact technical controls, stage rulers, aligned frame cells, context menus, keyboard navigation, and resizable panels.
- Animation, Drawing, and Rigging workspaces; panel layout persistence, timeline zoom, and stage-focused mode.
- Document manager defaults to a sortable list of real local documents. Templates are an explicit library section, not a mascot-heavy welcome screen.
- New documents default to a blank white stage. Compact source, width, height, and frame-rate controls replace beginner template cards.
- Workspace configuration is a settings flow, without mascot artwork or step-by-step pose tutorials. Motion presets remain available under Motion, collapsed by default; they do not dominate object properties.

## Update distribution

This release provides public native installers, SHA256SUMS.txt, and the stable Windows, macOS, and Linux update manifests. Earlier Actions-only builds were not a published update feed.

**Updater-enabled v0.2 Windows installations and Linux AppImages can discover v0.3.4 without uninstalling.** Open **Updates & backups → Check GitHub**, or leave automatic updates enabled. A download is verified; the application then awaits a durable save and a verified native library backup before replacing its binaries. Editing, export, playback, or a failed save/backup blocks installation.

The package name (`luno-animate`), product name (`Luno Animate`), application ID (`studio.luno.animate`), storage partition (`persist:luno-studio`), native library location, and document schema are unchanged. Existing .lam files, project libraries, settings, revisions, and backups are retained. No new account or library migration is required.

### Platform limits

- **Windows x64:** NSIS update package. These builds are unsigned unless a signing certificate is configured; Windows may show a publisher/SmartScreen warning.
- **Linux x64 AppImage:** built-in in-place update when running a writable AppImage. DEB/package-manager installations require a manual/package-manager update.
- **macOS Intel/Apple silicon:** unsigned development DMG/ZIP builds. Built-in installation remains disabled without proper Developer ID signing; do not bypass Gatekeeper. Manual replacement retains the library.
- **v0.1:** lacks an updater; an initial manual upgrade is required.

Cross-version Windows GUI installation and signed/notarized macOS installation have not been independently exercised on physical systems. Keep portable .lam copies of important work in addition to automatic snapshots.

## Retained animation features

FK / IK rigging, cutout attachments, nested layers and groups, scene sequencing, camera keyframes, cel drawing/onion skin, easing, embedded audio, portable .lam documents, MP4 with audio, GIF, PNG, SVG, and sprite-sheet export remain available. This is an independent early-stage animation editor, not Adobe software or full Animate feature parity.
