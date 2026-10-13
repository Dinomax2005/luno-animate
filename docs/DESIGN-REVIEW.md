# Luno Studio 1.0 — interface redesign review

**Goal:** make the 1.0 preview stop reading as an AI-generated interface, without changing a single function.

Published releases: [v1.0.1](https://github.com/Dinomax2005/luno-animate/releases/tag/v1.0.1) (current) and [v1.0.0](https://github.com/Dinomax2005/luno-animate/releases/tag/v1.0.0) (redesign, build commit `d04cfb2`).

## 1. What was researched

2026 design writing on "AI slop" interfaces lists a repeatable cluster, not vague "bad taste":

| Told | Why it reads as generated |
| --- | --- |
| Violet → indigo gradient accent | Tailwind `indigo-500 → purple-600` is the default accent in generated code |
| Exactly three equal rounded cards | The "three features, one row" prompt pattern |
| One font (Inter) at display scale | No typographic decision was made |
| Same 12–18px radius + soft shadow everywhere | One surface recipe copy-pasted onto every element |
| Glassmorphism, neon glow, gradient text | Decoration substituting for hierarchy |
| Centered hero + badge + slogan | Marketing-site skeleton inside a product |
| Weightless copy ("Bring your ideas to life") | No domain knowledge in the words |

Sources: smoothui.dev/blog/ai-design-slop, 925studios.co/blog/ai-slop-design-tells, vibecodekit.dev/ai-slop-design, uxskill.laithjunaidy.com/what-is-ai-slop, alexlavaee.me/blog/lessons-learned-designing-with-ai, axe-web.com/insights/ai-website-design-sameness, managed-code.com/blog-post/ai-slop-in-design.

Two fixes are recommended consistently: **commit to one aesthetic in writing**, and **use real product patterns instead of landing-page patterns**. Both are in `DESIGN.md` (direction: *Studio Instrument*).

## 2. What replaced what

| Area | Before | Now |
| --- | --- | --- |
| Palette | Graphite + iris/violet accent | Graphite + single amber signal `#d9822b`; state colours only for state |
| Gradients | Gradient logo, glow, gradient fills | Flat fills; amber timeline bands capped at 12–20% opacity |
| Radii | 12–18px on everything | 0 for panels, 2px controls, 3px overlays |
| Depth | Soft shadow on every surface | Shadow only for menus, dialogs, toasts, update notice |
| Type | Inter at several scales, letter-spaced captions | Inter Variable kept as the UI face with tabular numerals; 10px labels, 11px base, 12px row titles, 15–18px dialog titles |
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

## 6. Verification after the redesign

CI: **Studio quality run 38351954814 success**; **Build desktop installers run 38351870129 success** — Windows, macOS and Linux packages, packaged Linux desktop acceptance, and `verify-artifacts.mjs` passed twice (verify job and pre-staging job).

Published 2026-10-13 at the owner's request: release **v1.0.0** (id 411317444), marked **Latest**, 16 assets — Windows x64 exe, Linux AppImage + deb, macOS arm64/x64 dmg + zip with blockmaps, `SHA256SUMS.txt`, `studio-v1.yml`, `studio-v1-mac.yml`, `studio-v1-linux.yml`. No `latest.yml`, so the legacy feed is untouched. Every asset carries a GitHub-computed sha256 digest. The superseded draft was deleted before staging, so the published release always matches the redesigned interface. Branch HEAD differs from the tag only in documentation, which the build does not consume.

## 7. Limits

Packaged-installer and physical-tablet verification happen in CI and on real hardware, not in this workspace. Windows and unsigned macOS builds show the usual SmartScreen/Gatekeeper warnings; macOS and DEB updates are manual because they are unsigned. The licence draft and provider-permission items in `docs/RELEASE.md` still need the owner's review before any company or commercial distribution.
