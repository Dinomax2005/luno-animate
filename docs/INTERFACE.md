# Pegbar Studio — interface changes

**Goal:** make the interface read as a purpose-built studio tool instead of a generic template, without changing a single function.

Current release: [the latest build](https://github.com/Dinomax2005/luno-animate/releases/latest). The 1.0.0 interface shipped from build `d04cfb2`.

## 1. What the defaults are

2026 design writing on look-alike interfaces lists a repeatable cluster, not vague taste:

| Default pattern | Why it reads as a template |
| --- | --- |
| Violet → indigo gradient accent | The stock accent of most UI starter kits |
| Exactly three equal rounded cards | The "three features, one row" landing-page pattern |
| One font at display scale | No typographic decision was made |
| Same 12–18px radius + soft shadow everywhere | One surface recipe copy-pasted onto every element |
| Glassmorphism, neon glow, gradient text | Decoration substituting for hierarchy |
| Centered hero + badge + slogan | Marketing-site skeleton inside a product |
| Weightless copy ("Bring your ideas to life") | No domain knowledge in the words |

Two rules follow: **commit to one aesthetic in writing**, and **use product patterns instead of landing-page patterns**. Both are in `DESIGN.md` (direction: *Studio Instrument*).

## 2. What replaced what

| Area | Before | Now |
| --- | --- | --- |
| Palette | Graphite + iris/violet accent | Graphite + single amber signal `#d9822b`; state colours only for state |
| Gradients | Gradient logo, glow, gradient fills | Flat fills; amber timeline bands capped at 12–20% opacity |
| Radii | 12–18px on everything | 0 for panels, 2px controls, 3px overlays |
| Depth | Soft shadow on every surface | Shadow only for menus, dialogs, toasts, update notice |
| Type | Inter at several scales, letter-spaced captions | Inter Variable kept as the UI face with tabular numerals (functional, not decorative); 10px labels, 11px base, 12px row titles, 15–18px dialog titles |
| Home | Hero, badge, three feature cards, slogan | Sidebar tool rail + document table (Name, Mode, Scenes, Length, Modified, actions) with search/sort and an inline empty state |
| New project | Three equal illustrated cards | Compact `Draw / Motion / Edit` list with one-line scopes |
| Dialogs | "What will you make?", "Give it an audience.", "Learn the instrument." | "Create a project", "Export", "Tools, keys and limits" — labels and limits instead of slogans |
| Rig / canvas | Violet armature, violet selection, violet grid | Amber selection and joints, graphite armature, 20% graphite grid |
| Icons | Rounded-square gradient mark | Flat mark, amber `L` on graphite; package icons regenerated to match |

New behaviour: the canvas shows a **paint cursor** sized to the brush tip (scales with zoom, dashed when the tip is smaller than the minimum ring, dashed variant for the eraser, hidden outside the artboard and during playback), plus a tool-options bar above the canvas (brush tip/size/opacity/flow/stabilize/spacing/pressure, selection grid/snap/pose readout, rig joint). It concentrates the density professional tools have rather than leaving empty chrome, and it is a product pattern, not a landing-page one.

## 3. Locked tokens

Full list in `DESIGN.md`. Dark / light:

```
bg #1c1d1f / #dcdedd      chrome #232528 / #e6e7e5     panel #26282b / #eef0ee
field #161718 / #ffffff    line #34363a / #c6c8c5      line-2 #4a4d53 / #a9aca8
text #e8e8ea / #24262a     dim #a2a4aa / #4e5157        mute #787b82 / #74777c
accent #d9822b / #a8621a   ok #6aa877  warn #c9a227  err #c9635a
radius 0 / 2px / 3px       shadow only above the canvas
```

Density: 22–26px rows, 26px controls, 28–38px bars. Motion: 120ms background and border transitions, removed under `prefers-reduced-motion`.

## 4. Files changed

`DESIGN.md` (new), `src/ui.css` (rewritten, −4.1k/+1.0k lines), `src/components/Home.tsx` (document table), `src/components/Header.tsx` (menu bar, document bar, tool-options bar), `src/components/Dialogs.tsx` (copy), `src/App.tsx`, `src/components/BrushPanel.tsx`, `src/components/Stage.tsx`, `src/core/model.ts`, `src/core/render.ts`, `src/state/studio.ts`, `public/mark.svg`, `assets/icon.*`, `README.md`, `docs/RELEASE.md`, `.github/workflows/installers.yml` (draft title), `tests/studio.spec.ts` (two copy assertions).

## 5. Nothing was removed

Every function and every accessibility hook asserted by the browser and desktop suites is intact: menu bar with File/View menus, command search, context menus, tool box, navigator tabs, inspector tabs, timeline interactions, imports, exports, library, updates. Local verification: typecheck, **54 unit**, **15 browser** (real H.264 and non-silent audio decode), **19 native**, production build — all pass.

## 6. Release history

- **1.0.3** — single-row application bar, no bar on the library screen, drawn pointer across the whole application, plain-language release notes.
- **1.0.2** — canvas pointer for every tool, hotspot-accurate glyphs, remount fix.
- **1.0.1** — brush-sized paint cursor on the canvas.
- **1.0.0** — this interface, on build `d04cfb2`.

Every release is built by the installer pipeline, which packages Windows, macOS and Linux, checks the artifacts and stages the draft for review before publishing.

## 7. Limits

Packaged-installer and physical-tablet verification happen in CI and on real hardware, not in this workspace. Windows and unsigned macOS builds show the usual SmartScreen/Gatekeeper warnings; macOS and DEB updates are manual because they are unsigned. The licence draft and provider-permission items in `docs/RELEASE.md` still need the owner's review before any company or commercial distribution.
