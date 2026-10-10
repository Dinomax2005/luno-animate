# Luno Animate

**A little less complicated. A lot more animated.**

A local-first 2D animation studio built for people who want to make things move without learning a complicated production tool. React + TypeScript power the editor; Electron turns it into an offline desktop application.

## What works today

- **Draw & compose:** selection, freehand pen, rectangles, circles, shape assets, image import, layer visibility/locking/stacking, transform properties, and colors.
- **Rig & pose:** Milo’s connected 15-bone character rig; forward kinematics; two-bone IK for hands and feet; direct joint rotation with Shift; editable bone lengths and custom child bones.
- **Animate:** editable/drag-and-drop keyframes, automatic pose keys, per-key easing, frame scrubbing, looping playback, and Wave/Bounce/Walk/Spin motion starters.
- **Keep & share:** debounced local autosave, bounded undo/redo, validated portable `.luno` projects, real animated GIF exports, transparent PNGs, and vector SVGs.
- **Get started:** a four-step first-run setup wizard, sample projects, project preferences, and keyboard help.
- **Install:** Windows NSIS setup wizard; macOS DMG/ZIP for Intel and Apple silicon; Linux AppImage/DEB.

This is a **working early editor**, not a complete Adobe Animate replacement. Automatic mesh skinning for arbitrary imported art, drawing-by-frame, audio, multiple scenes, video export, and professional publishing pipelines are future work. Imported SVGs are rasterized for safe image import. GIF export is limited to 300 frames / 960 px per side; PNG/SVG export preserves your full canvas size.

## Download & install

Desktop builds are produced by [Build desktop installers](https://github.com/Dinomax2005/luno-animate/actions/workflows/installers.yml). Open a successful run, download the artifact for your platform, and extract the ZIP:

| Platform | File to open | Installation |
| --- | --- | --- |
| Windows x64 | `Luno-Animate-0.1.0-win-x64.exe` | The guided setup installs the app, offers shortcuts, and opens the first-run wizard. |
| macOS Apple silicon | `Luno-Animate-0.1.0-mac-arm64.dmg` | Drag the app to Applications. |
| macOS Intel | `Luno-Animate-0.1.0-mac-x64.dmg` | Drag the app to Applications. |
| Linux x64 | `.AppImage` or `.deb` | Use the package installer for DEB, or `chmod +x` the AppImage and open it. |

GitHub build artifacts require signing into GitHub and expire after 30 days. Permanent public downloads can be published from the included draft-release workflow. Until signing certificates are configured, installers are **unsigned development builds**. See [installation and release guide](docs/INSTALLATION.md) for signing and publishing instructions. macOS unsigned builds are not a frictionless public installer.

No Node.js, terminal, account, or server is required to **use an installed desktop build**. No cloud service receives your projects. All fonts and artwork are bundled.

## Try the editor / develop

Requires **Node.js 22.12+** and npm.

```sh
npm ci
npm run dev              # http://localhost:5173
npm run desktop:dev      # native desktop window + hot reload
```

The web preview binds to `0.0.0.0` and accepts Arena preview hosts. It opens a ready-to-edit demo. The desktop app automatically opens the setup wizard on first launch; the web editor has a **Quick setup** button.

```sh
npm run typecheck
npm test                # engine and state tests
npm run build           # production renderer
npx playwright install chromium
npm run test:e2e        # real browser interactions and export validation
```

## Build installers locally

Run on the target operating system for the most reliable results:

```sh
npm run desktop:windows # Windows setup .exe
npm run desktop:mac     # Intel + Apple silicon DMG/ZIP
npm run desktop:linux   # Linux AppImage + DEB
```

Outputs go into ignored `release/`. `npm run desktop:pack` creates an unpacked application for smoke testing. Electron and packaging tools download their platform binaries during installation/build; internet access is required to build, **not** to run the packaged app.

## Your first little animation

1. Select **Milo** or add a character from **Assets**.
2. Drag a white hand/foot joint to pose the connected limb.
3. Move the playhead to a later frame, then change the pose. Auto-key captures the pose (and creates a starting key if needed).
4. Press **Space** to play. Use a motion starter for an instant starting point.
5. Choose **File → Save a copy** to keep an editable `.luno` project, or **Export → GIF** to share the animation.

Shortcuts: `V` select · `H` pan · `B` pen · `R` rectangle · `O` ellipse · `G` pose rig · `K` keyframe · `←/→` step · `Ctrl/⌘ S` save · `Ctrl/⌘ Z` undo.

Autosave keeps the current working project in browser/Electron local storage. **Save `.luno` copies for durable backups**, particularly after importing large images (browser storage has quotas). Preferences are stored separately. Invalid saved documents retain a recovery copy under `luno.recovery.v1` rather than being silently discarded. Uninstalling does not intentionally delete desktop app data.

## Structure

```text
src/
  components/      Studio UI, SVG artwork, canvas, timeline, inspector, dialogs, wizard
  engine/          Project schema, kinematics/IK, animation sampling, files, exports
  store/           Editor actions, preferences, bounded history, keyframe transactions
  test/            Pure engine and state unit tests
  App.tsx          File workflows, keyboard commands, playback, persistence
  styles.css       Responsive light/dark studio design
  main.tsx         Renderer entry
  env.d.ts         Typed, narrow desktop bridge
electron/
  main.cjs         Native window, menus, trusted IPC, atomic file writes, file associations
  preload.cjs      Sandboxed context bridge (no Node exposure)
assets/           App icon, installer branding, macOS entitlements
tests/            Playwright browser acceptance tests
.github/workflows/
  ci.yml           Type checks, unit tests, production build, browser tests
  installers.yml   Native Windows/macOS/Linux installer builds
  release.yml      Explicit, verified draft-release publication
```

See [architecture](docs/ARCHITECTURE.md), [installation](docs/INSTALLATION.md), and [roadmap](docs/ROADMAP.md).

## License notices

The application source is intentionally `UNLICENSED` until the owner chooses a license. Dependency licenses, including the Inter font’s SIL Open Font License, are generated at build time and bundled with the app. Read them in **Help → Third-party notices** or `public/third-party-notices.txt`.
