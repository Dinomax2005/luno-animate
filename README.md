# Luno Animate · v0.3.7

**Precision. Every frame.**

A professional, local-first 2D animation workspace with vector, keyframe, frame-by-frame, and character-rigging workflows. React + TypeScript power the editor; Electron provides standalone desktop installers, a native project library, and protected updates.

## What works

The production interface stays technical rather than tutorial-first. A separate small desktop launcher closes before the ready studio opens; browsers have a compact startup card, not a full-screen loading page. The optional Start window offers New, Open, and Recent documents, and What’s New is shown once per version. New documents default to a blank stage; the document manager defaults to a sortable list. Technical controls, menus, and shortcuts take priority.

- **Production workspace:** blue-accented charcoal/light interfaces; eight context-aware application menus; searchable command palette; individually remembered Animation/Drawing/Rigging/Motion/Video layouts; pointer/keyboard-resizable docks; stage rulers, context actions, spatial nudging, and focus mode; responsive panel overlays and document properties. See the [workspace reference](docs/WORKSPACE.md).
- **Save documents:** Save overwrites the opened `.lam`; Save As selects and binds a new destination only after success. Copy export remains separate. External changes, missing files, invalid data, symbolic links, and internal library targets are refused instead of silently clobbered.
- **Three document types:** Hand-drawn uses manually authored cels; Rig / motion combines FK/IK posing with a layer motion studio; Video editing imports footage and adds animated overlays.
- **Document manager:** every saved project, thumbnails, favorites, search/sort, rename, duplicate, Trash/restore, revision recovery, and five editable templates. Projects remain independent and survive restarting.
- **Compose:** vector strokes/shapes, imported artwork, editable text, multiselect, marquee selection, move/rotate/scale, alignment, animated groups, layer ordering, inherited visibility/opacity/locks, and artwork blend modes.
- **Rig:** a ready-to-pose 15-bone Milo, blank cutout rigs, joint-attached imported body parts, forward kinematics, two-bone hand/foot IK, custom child bones, editable parents/lengths, angle limits, and joint locks. No automatic mesh skinning.
- **Motion studio:** timed layer bars with snapping, drag-to-move, and restorable trim handles; expandable property timeline lanes; channel-safe key editing; individual property diamonds; editable Bézier graph; animated blur/brightness/saturation; opacity fades and non-destructive splitting. Inspired by layer-based mobile motion workflows, not full Alight Motion parity.
- **Video editing:** real MP4/WebM/MOV/M4V decoding into portable JPEG proxies, automatically linked embedded sound, clip trim/split/arrangement, and animation overlays using the same renderer as exports.
- **Animate:** automatic/manual keys, draggable timeline keys, key multiselection/copy/paste/delete, nine easing modes including custom Bézier, eight editable motion starters, work areas, timeline zoom, and elapsed-time playback.
- **Draw frame by frame:** drawing cels, held/single-frame exposure, next blank/duplicate frame controls that preserve existing cels and grow the timeline, draggable cel timing, brush controls, and configurable onion skin.
- **Tell a story:** multiple ordered scenes, animated camera pan/zoom/rotation, embedded audio, waveform tracks, audio positioning/trimming/volume/mute, and synchronized playback.
- **Keep and share:** binary `.lam` projects containing every scene, rig, drawing, key, image, embedded video proxy, and sound; real `.mp4` video with mixed audio; animated GIF; transparent PNG/SVG stills; sprite atlas PNG + JSON in a ZIP.
- **Desktop:** Windows guided NSIS setup, Intel/Apple silicon macOS DMG/ZIP, Linux AppImage/DEB, a separate small native “Starting up Luno Animations” popup that closes before the main app appears, blue solar-eclipse icons, a Photoshop-inspired Start window, optional workspace configuration, `.lam` file association, three prior project saves, five complete library backups, and a guarded GitHub updater.

This is a **working early studio, not full Adobe Animate parity**. Symbols/nested timelines, arbitrary mesh deformation, shape morphing, masks, lip-sync, and professional publishing pipelines are not implemented. Imported SVG artwork is rasterized for safety. See the [roadmap](docs/ROADMAP.md).

## Download and install

Use the **[official v0.3.7 release](https://github.com/Dinomax2005/luno-animate/releases/tag/v0.3.7)** for installers and stable update feeds. Existing updater-enabled Windows and AppImage installations can use **Updates & backups → Check GitHub** without uninstalling.

| Platform | Installer | How to install |
| --- | --- | --- |
| Windows x64 | `Luno-Animate-0.3.7-win-x64.exe` | NSIS setup, selectable installation folder, shortcuts, workspace configuration. |
| macOS Apple silicon | `Luno-Animate-0.3.7-mac-arm64.dmg` | Drag the app to Applications. |
| macOS Intel | `Luno-Animate-0.3.7-mac-x64.dmg` | Drag the app to Applications. |
| Linux x64 | `.AppImage` or `.deb` | Make the AppImage executable, or install the DEB with your package manager. |

Public release downloads do not require GitHub sign-in and do not expire like Actions artifacts. Installers are unsigned development builds without configured certificates; macOS automatic installation remains disabled without Developer ID signing. DEB packages require manual/package-manager updates; v0.1 has no updater. See [installation and releases](docs/INSTALLATION.md).

No Node.js, server, terminal, or account is needed to **use an installed build**. Projects are never uploaded. Fonts and artwork are bundled. Desktop update checks/downloads contact GitHub; automatic updates can be switched off.

## Animation workflow

1. In **Start** or **New project**, choose **Hand-drawn**, **Rig / motion**, or **Video editing**. Open a `.lam` with **Open** / `Ctrl/⌘ O`, or continue a recent library document.
2. **Hand-drawn:** the brush, individual cel exposure, and onion skin are ready. Draw the first frame; **F7** advances to a new blank frame and **F6** duplicates to the next frame. An existing next-frame drawing is preserved. The timeline grows as you author frames; uncreated frames remain blank.
3. **Rig / motion:** use the Motion workspace, layer timing bars, individual property diamonds, Effects, and the editable Bézier graph. Add/import vector artwork or a character template. Drag a joint or object, move the playhead, and record another pose with Auto-key or **K**. Expand a layer’s timeline chevron for property lanes; lane edits preserve unrelated channels and rig poses. Easing remains shared at a frame. **Space** plays any type.
4. **Video editing:** Import video (or drop supported footage), select its layer, and use **Timing** to trim/restore, split, move, or fade. **Ctrl/⌘ Shift D** splits at the playhead; the magnet toggles snapping. Text/artwork layers provide animated overlays. Linked sound follows video edits; independently moving/trimming sound unlinks it. Use scenes, camera, or sound for longer sequences. **Export → MP4** produces video with mixed audio.
5. **Save** / `Ctrl/⌘ S` writes back to the opened file. **Save As…** / `Ctrl/⌘ Shift S` chooses a new `.lam` destination. **Export .lam copy…** does not change the linked Save destination. Local library autosave remains independent.
6. **Help → What’s New…** reopens the current notes. **Help → Start window…** reopens Start; its startup checkbox is remembered. **Workspace setup** remains available manually.

Workspace: `Ctrl/⌘ Shift P` command search · stage `Tab` focus/restore panels · stage arrows nudge (Shift: 10 px) · `, / .` step frames · `Ctrl/⌘ 0` fit stage. See **Help → Tools & keyboard reference**.

Shortcuts: `V` select · `B` draw · `T` text · `G` pose · `C` camera · `K` key · `U` onion skin · `Ctrl/⌘ G` group · `Ctrl/⌘ C/V` keys · `Ctrl/⌘ S` `.lam` · `Ctrl/⌘ Z` undo. Open Help for the complete list.

### File and storage notes

`.lam` is a program-specific compressed binary container with a signature, format/schema versions, bounded lengths, and SHA-256 integrity checking. It is **not encryption or DRM**: another program could implement its reader. Exclusive readability cannot honestly be guaranteed. Legacy `.luno` JSON is migrated on import, without modifying the source. See [the file format](docs/LAM-FORMAT.md).

File permissions are session-only: native picker/file association and compatible browser file-system handles authorize the opened file. A library document reopened after restarting is a library snapshot, not an implicitly writable external file—open the original again or use Save As. Legacy JSON and ordinary file-input/drag-and-drop imports do not authorize overwrite.

Browser projects use IndexedDB; browser cleanup/quotas still apply. Compatible top-level secure browsers can save directly to an approved handle; other browsers (including cross-origin embedded previews) download a copy and explain that limitation. Export `.lam` copies for durable, portable backups. Desktop projects use append-only files in the app's user-data directory; external `.lam` copies are never altered by an update. No backup system can guarantee against every hardware/OS failure—keep important work on a second device too.

MP4 uses available WebCodecs encoders: H.264 first, AV1 if necessary; AAC audio first, Opus if necessary. The export dialog shows the actual compatibility note. Opus/AV1 MP4 may require a modern browser/player or VLC. Limits: 5 minutes/18,000 video frames/150 MB; 300 GIF frames; 256 sprite frames; 64 MB portable project; 32 scenes/500 layers per scene. Audio import is limited to 20 MB/5 minutes.

Video import is **proxy-based**, not a full-resolution source-media editor: up to 150 MB input, 30 seconds per clip, and a 960-pixel proxy long side. The proxy follows the project FPS and is embedded in `.lam`; the original file is untouched. Per-import JPEG budget: 24 million data-URL characters; up to 32 shared video assets; the complete project must still fit the 64 MB portable limit. MP4 resolution choices do not restore source detail lost during proxy creation. Clip edges can shorten or restore available source footage, bounded by the source/linked sound and scene. Alt temporarily bypasses snapping. Masks, arbitrary-length footage, and an external-media conform/relink workflow are not included.

### Safe updates

The desktop updater checks official newer **stable** GitHub releases, downloads and checksum-verifies them, then waits for a clean idle studio. Unsaved edits to a linked external file block automatic restart until explicitly saved. After two idle minutes it gives a cancellable 30-second warning. Before installation it stops editing, flushes the latest work/settings, awaits a renderer acknowledgement, and creates/re-reads a complete filesystem backup. A failed save, corrupt library, failed backup, or interrupted verification blocks installation and leaves the app open. Use **Updates & backups** to defer, switch automation off, manually restart, or restore a snapshot.

Windows NSIS and Linux AppImage support installation; signed macOS ZIP releases support macOS updates. DEB/system-package installs, development builds, and unsigned macOS use manual/package-manager updates. **Stable releases with `latest*.yml` and referenced assets must actually be published before automatic downloads are possible.** The release workflow prepares a draft for owner review, not an automatic public launch.

## Develop

Requires **Node.js 22.12+**:

```sh
npm ci
npm run dev              # project home at http://localhost:5173
npm run desktop:dev      # desktop + hot reload
npm run verify           # types, units, full build, native failure-path tests
npx playwright install chromium
npm run test:e2e          # dashboard/editor, binary files, media decode/cancel
```

The preview binds to `0.0.0.0` and accepts Arena preview hosts. Native builds download Electron/packager tools from GitHub; use hosted Actions builds if the local network blocks those assets—do not disable TLS validation.

```sh
npm run desktop:windows  # run on Windows
npm run desktop:mac      # run on macOS
npm run desktop:linux    # run on Linux
npm run test:desktop     # requires a built Electron app/display server
```

Build output, native generated bundles, test artifacts, and exact third-party source ZIPs are generated/ignored, not checked into Git.

## Structure

`src/engine/` — versioned document, LAM codec, hierarchy, rigs, sampling, shared exports/video.
`src/services/` — browser/native repositories, durable workflows, audio.
`src/store/` — editor actions/undo transactions and independent persistent workspace layout.
`src/components/` — project home, application menus/commands, resizable studio, timeline, Properties, setup, export, updates.
`electron/` — sandboxed bridge, trusted IPC, serialized filesystem vault, guarded updater.
`src/test/`, `native-tests/`, `tests/`, `desktop-tests/` — engine/store/IDB, disk/update failures, browser, packaged acceptance.
`.github/workflows/` — checks, native installers/manifests, verified draft release.

Read the [production workspace reference](docs/WORKSPACE.md), [architecture](docs/ARCHITECTURE.md) and [installation/release instructions](docs/INSTALLATION.md).

## Licenses

Application source is `UNLICENSED` until the owner chooses a license. Build-time notices include all shipped JS/font components; Electron/Chromium keep their own distribution notices. Unmodified Mediabunny is MPL 2.0, with its exact installed source and license bundled as `third-party/mediabunny-sources.zip`, downloadable in **Help → Third-party notices**. No separately installed FFmpeg/x264 executable or AAC WASM extension is included.
