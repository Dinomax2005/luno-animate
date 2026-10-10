# Luno Animate · v0.3.4

**Precision. Every frame.**

A professional, local-first 2D animation workspace with vector, keyframe, frame-by-frame, and character-rigging workflows. React + TypeScript power the editor; Electron provides standalone desktop installers, a native project library, and protected updates.

## What works

This version removes the beginner-first welcome art, tutorial prompts, and prominent preset cards. New documents default to a blank stage; the document manager defaults to a sortable list. Technical controls, menus, and shortcuts take priority.

- **Production workspace:** dense charcoal/light interfaces; eight context-aware application menus; searchable command palette; persistent Animation/Drawing/Rigging layouts; pointer/keyboard-resizable docks; stage rulers, context actions, spatial nudging, and focus mode; responsive panel overlays and document properties. See the [workspace reference](docs/WORKSPACE.md).
- **Document manager:** every saved project, thumbnails, favorites, search/sort, rename, duplicate, Trash/restore, revision recovery, and five editable templates. Projects remain independent and survive restarting.
- **Compose:** vector strokes/shapes, imported artwork, editable text, multiselect, marquee selection, move/rotate/scale, alignment, animated groups, layer ordering, inherited visibility/opacity/locks, and artwork blend modes.
- **Rig:** a ready-to-pose 15-bone Milo, blank cutout rigs, joint-attached imported body parts, forward kinematics, two-bone hand/foot IK, custom child bones, editable parents/lengths, angle limits, and joint locks. No automatic mesh skinning.
- **Animate:** automatic/manual keys, draggable timeline keys, key multiselection/copy/paste/delete, nine easing modes including custom Bézier, eight editable motion starters, work areas, timeline zoom, and elapsed-time playback.
- **Draw frame by frame:** drawing cels, held/single-frame exposure, blank cels, copy previous drawing, draggable cel timing, brush controls, and configurable onion skin.
- **Tell a story:** multiple ordered scenes, animated camera pan/zoom/rotation, embedded audio, waveform tracks, audio positioning/trimming/volume/mute, and synchronized playback.
- **Keep and share:** binary `.lam` projects containing every scene, rig, drawing, key, image, and sound; real `.mp4` video with mixed audio; animated GIF; transparent PNG/SVG stills; sprite atlas PNG + JSON in a ZIP.
- **Desktop:** Windows guided NSIS setup, Intel/Apple silicon macOS DMG/ZIP, Linux AppImage/DEB, first-run setup, `.lam` file association, three prior project saves, five complete library backups, and a guarded GitHub updater.

This is a **working early studio, not full Adobe Animate parity**. Symbols/nested timelines, arbitrary mesh deformation, shape morphing, masks, lip-sync, and professional publishing pipelines are not implemented. Imported SVG artwork is rasterized for safety. See the [roadmap](docs/ROADMAP.md).

## Download and install

Use the **[official v0.3.4 release](https://github.com/Dinomax2005/luno-animate/releases/tag/v0.3.4)** for installers and stable update feeds. Existing updater-enabled Windows and AppImage installations can use **Updates & backups → Check GitHub** without uninstalling.

| Platform | Installer | How to install |
| --- | --- | --- |
| Windows x64 | `Luno-Animate-0.3.4-win-x64.exe` | NSIS setup, selectable installation folder, shortcuts, workspace configuration. |
| macOS Apple silicon | `Luno-Animate-0.3.4-mac-arm64.dmg` | Drag the app to Applications. |
| macOS Intel | `Luno-Animate-0.3.4-mac-x64.dmg` | Drag the app to Applications. |
| Linux x64 | `.AppImage` or `.deb` | Make the AppImage executable, or install the DEB with your package manager. |

Public release downloads do not require GitHub sign-in and do not expire like Actions artifacts. Installers are unsigned development builds without configured certificates; macOS automatic installation remains disabled without Developer ID signing. DEB packages require manual/package-manager updates; v0.1 has no updater. See [installation and releases](docs/INSTALLATION.md).

No Node.js, server, terminal, or account is needed to **use an installed build**. Projects are never uploaded. Fonts and artwork are bundled. Desktop update checks/downloads contact GitHub; automatic updates can be switched off.

## Animation workflow

1. Create a **New project** (blank by default), import a `.lam`, or choose an opt-in document under **Templates**.
2. Pose Milo by dragging a hand/foot joint, or draw/add/import your own artwork.
3. Move the playhead, make another pose, and let Auto-key capture it. Press **Space** to play.
4. For drawings, choose **Draw → Frame-by-frame**; **F7** creates a blank cel and **F6** copies the previous drawing.
5. Use **Add scene**, **Animate camera**, or **Import sound** to build a longer story.
6. **Export → MP4** creates video. **File → Export .lam project** keeps an editable portable copy. **Back to all projects** durably saves before returning home.

Workspace: `Ctrl/⌘ Shift P` command search · stage `Tab` focus/restore panels · stage arrows nudge (Shift: 10 px) · `, / .` step frames · `Ctrl/⌘ 0` fit stage. See **Help → Tools & keyboard reference**.

Shortcuts: `V` select · `B` draw · `T` text · `G` pose · `C` camera · `K` key · `U` onion skin · `Ctrl/⌘ G` group · `Ctrl/⌘ C/V` keys · `Ctrl/⌘ S` `.lam` · `Ctrl/⌘ Z` undo. Open Help for the complete list.

### File and storage notes

`.lam` is a program-specific compressed binary container with a signature, format/schema versions, bounded lengths, and SHA-256 integrity checking. It is **not encryption or DRM**: another program could implement its reader. Exclusive readability cannot honestly be guaranteed. Legacy `.luno` JSON is migrated on import, without modifying the source. See [the file format](docs/LAM-FORMAT.md).

Browser projects use IndexedDB; browser cleanup/quotas still apply. Export `.lam` copies for durable, portable backups. Desktop projects use append-only files in the app's user-data directory; external `.lam` copies are never altered by an update. No backup system can guarantee against every hardware/OS failure—keep important work on a second device too.

MP4 uses available WebCodecs encoders: H.264 first, AV1 if necessary; AAC audio first, Opus if necessary. The export dialog shows the actual compatibility note. Opus/AV1 MP4 may require a modern browser/player or VLC. Limits: 5 minutes/18,000 video frames/150 MB; 300 GIF frames; 256 sprite frames; 64 MB portable project; 32 scenes/500 layers per scene. Audio import is limited to 20 MB/5 minutes.

### Safe updates

The desktop updater checks official newer **stable** GitHub releases, downloads and checksum-verifies them, then waits for a clean idle studio. After two idle minutes it gives a cancellable 30-second warning. Before installation it stops editing, flushes the latest work/settings, awaits a renderer acknowledgement, and creates/re-reads a complete filesystem backup. A failed save, corrupt library, failed backup, or interrupted verification blocks installation and leaves the app open. Use **Updates & backups** to defer, switch automation off, manually restart, or restore a snapshot.

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
