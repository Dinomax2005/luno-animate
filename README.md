# Luno Studio 1.0

**Animation, with intent.** A clean, local-first professional animation workspace. Completely free: no accounts, subscriptions, activation codes, watermarks or locked tools.

This is an independent 1.0 implementation, not a theme patch on Luno Animate. The old application files, engine, interface, tests, branding and packaging have been replaced. **Only Studio 1.x is supported.** Earlier Luno Animate versions and .lam/.luno formats are unsupported; their files and published archives are not deleted or silently migrated.

## My product direction

Graphite surfaces and an iris accent. A custom geometric Luno mark. Deliberate tools instead of a simplified beginner UI. One unified document, with **Draw**, **Motion** and **Edit** workspaces:

- **Draw:** eight procedural brush families, pressure, stabilization, flow, pixel marks, ordered cel erasure, bounded area fill and a composited eyedropper. Manual blank/duplicate cels, optional held exposures, onion skins and Undo/Redo.
- **Motion:** vector shapes, editable text, layer transforms, groups, property keys, interpolation and a custom Bézier editor. A new ten-bone armature, constrained FK/IK posing, new joints and artwork attachments.
- **Edit:** embedded image/audio/video media, waveform clips, decoded video proxies, linked extracted audio, clipping, trimming and splitting. These coexist with animated drawings and rigs on the same timeline.
- **Production:** multiple scenes, range playback, scene ordering, reference images with notes, searchable real commands, keyboard-resizable docks, focus mode and dark/light surfaces.
- **Files:** independent native filesystem or browser IndexedDB library, thumbnails, duplicate/delete, bounded revisions and verified desktop backups. Native approved-file overwrite and browser File System Access Save/Save As detect external conflicts.
- **Output:** H.264 MP4 with audio where supported, transparent PNG, PNG frame sequences with metadata, flattened raster SVG snapshots and the new integrity-checked editable `.lam` format. References and editor guides are excluded.

The renderer, scene graph, painting, animation and project container are implemented from scratch under `src/core`. Application state is in `src/state`; the sandboxed desktop shell is new under `desktop`.

## Run and verify

```bash
npm ci
npm run dev        # binds to 0.0.0.0:5173
npm run verify    # strict TS, unit tests, production build, native tests
npx playwright install chromium
npm run test:browser
```

Development browser code uses local/relative assets, not a sandbox localhost API. Desktop installers are built with `npm run desktop:windows`, `desktop:mac` or `desktop:linux`. Node.js is not required to use an installed build. The native startup card closes before the main window is shown.

## Install and support

Installer assets are staged only after exact-source CI succeeds. A reviewed **v1.0.0** release is the first supported Luno Studio version. Product name **Luno Studio**, app ID `studio.luno.studio`, user-data folder **Luno Studio**, and update channel **studio-v1** are independent of the unsupported predecessor. Do not uninstall an old app or discard legacy projects before independently exporting/backing up that work. There is no automatic conversion of old projects.

Windows NSIS setup includes the application licence and folder/shortcut options. macOS uses DMG/ZIP; Linux uses AppImage/DEB. Unsigned macOS and package-managed DEB updates are manual. Windows/AppImage use verified Studio 1.x manifests; install waits for a durable library save, verified backup, idle warning and no external-file changes. Physical Windows/macOS upgrades are not established by CI builds.

## Honest boundaries

These are technical safety limits, not a paid tier: 64 MB project payload, 1,800 frames per scene, 32 scenes, 256 layers per scene; bounded procedural detail. Video input is at most 100 MB / 30 seconds and becomes a 960px/20fps JPEG proxy (up to 48 MB), not preservation of the original full-source video. Audio input is normalized to embedded PCM WAV, up to 120 seconds. MP4 render jobs support up to 1,800 frames / 120 seconds; PNG ZIP jobs up to 300 frames / 100 MB. MP4 codec availability depends on the device. Opus-in-MP4 is used when AAC encoding is unavailable and may have compatibility limits in third-party players. SVG is explicitly a flattened raster snapshot; editable vectors remain in `.lam`. Rigging is a 2D armature/attachment system, not deformable meshes or 3D.

No measured speedup, Adobe parity, universal codec support, damage-proof upgrade guarantee or physical tablet/cross-OS verification is claimed.

## Licence and distribution rights

[LICENSE](LICENSE) is a **free proprietary application licence draft**, not MIT/open source. Application reuse, resale, redistribution and rebranding require appropriate permission except where law, GitHub terms or third-party component licences independently grant rights. Creative output is not claimed by Luno.

The distributor must verify the actual legal entity and Arena/provider permissions before relying on the draft for public/company distribution. This document does not supply official Arena permission, guarantee exclusive rights in AI output, or override service terms. See [licensing](docs/LICENSING.md).

Build-time notices include shipped JS/font dependencies. Electron/Chromium retain their runtime notices. Unmodified Mediabunny is MPL 2.0; exact installed sources and licence ship in `public/legal/mediabunny-source.zip` and are accessible through About → Third-party notices. Inter retains its SIL Open Font Licence.
