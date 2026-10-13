# Luno Studio interface direction — locked tokens

Committed direction: **Studio Instrument**. A control surface for people who make things, in the lineage of professional animation and compositing tools. Not a marketing site, not a product landing page.

## Anti-default decisions (deliberate, not defaults)

Generated-looking interfaces share a cluster of defaults: violet→indigo gradients, three equal feature cards, one typeface at display scale, uniform large radii and soft shadows on every surface, centered hero with a badge, glowing borders, and uplift copy. Each of these was rejected explicitly:

| Rejected default | This app |
| --- | --- |
| Violet/indigo gradient accent | Single signal **amber** `#d9822b`; state colors used only for state |
| Three feature cards in a row | Tool list, document table, property rows |
| Glow, glass, gradient text | Flat fills, hairline 1px borders, one flat scrim |
| 12–18px uniform soft radii | 0 for panels, **2px** for controls, 3px overlays only |
| Diffuse shadow on every card | Shadow reserved for floating overlays (menus, dialogs, toasts) |
| Centered marketing hero | Toolbar → table → detail: an application, not a pitch |
| Letter-spaced 6–8px caption type | 10px minimum labels, 11px base, 12px row names |
| Uplift copy ("Bring it to life") | Terse, specific labels: "Duplicate next cel", "Work area", "Export" |

## Where this comes from

2026 design writing on the sameness of template-made interfaces converges on the same list. Two consequences for this project: a single aesthetic has to be chosen and written down, and marketing-site patterns do not belong inside a production tool.

## Tokens

Dark (default) / light:

```
--bg      #1c1d1f / #dcdedd      window
--chrome  #232528 / #e6e7e5      title bars, toolbars
--panel   #26282b / #eef0ee      docked panels
--panel-2 #2b2d31 / #e4e6e4      raised rows, buttons
--field   #161718 / #ffffff      inputs, wells
--line    #34363a / #c6c8c5      1px hairlines
--line-2  #4a4d53 / #a9aca8      stronger separation, focus rings
--text    #e8e8ea / #24262a
--dim     #a2a4aa / #4e5157
--mute    #787b82 / #74777c
--accent  #d9822b / #a8621a      the only decorative color
--ok #6aa877  --warn #c9a227  --err #c9635a
```

Radius: `--r-panel: 0; --r-control: 2px; --r-overlay: 3px`. Depth: `--shadow-overlay: 0 10px 24px rgb(0 0 0 / .45)`.

Type: Inter Variable for UI (functional, not decorative), tabular numerals for all numbers, 10px labels, 11px base, 12px row titles, 15–18px dialog titles. Uppercase section headers stay at 10px with 0.04em tracking — never micro-type.

Density: 26–30px control heights, 22–24px table rows, 4–8px gaps. Controls sit on hairlines; hover raises fill, not size.

Motion: 120ms background/border transitions only. No bounce, no elastic, no parallax. `prefers-reduced-motion` removes transitions.

## Rules for future work

1. No new accent colors. Amber is the single signal color; red/amber/green appear only for state.
2. No gradient fills except the timeline work-area/selection bands, which must remain under 20% opacity.
3. Every radius comes from a token. Panels stay square.
4. Shadow means "floats above the canvas". Nothing docked gets a shadow.
5. New surfaces must justify their density: prefer a row, a table, or a toolbar over a card.
6. Copy names the object or the action. No uplift, no "empower", no metaphors.
