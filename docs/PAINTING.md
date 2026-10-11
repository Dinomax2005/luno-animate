# Brushes & Paint · v0.4.0

## Workspace and tools

Open **Paint → Brush Studio**, **Ctrl/Cmd+Shift+B**, or select a painting tool. The Properties dock has a **Paint** tab with **Brush library** and **Color studio**. On small windows the menu/shortcut opens the Properties overlay. Brush configuration changes new marks; earlier marks retain their captured settings.

| Shortcut | Action |
| --- | --- |
| B | Brush (the existing Draw tool) |
| E | Non-destructive active-cel eraser |
| F | Connected-area fill on the active cel |
| I | Composited-stage eyedropper; returns to the previous paint tool |
| Alt + brush click | Temporary composited-stage sampling |
| X / D | Swap foreground/background / reset to ink and white |
| [ / ] with brush or eraser | Brush size, 1–256 document pixels |
| Ctrl/Cmd+Shift+B | Brush Studio |
| F6 / F7 | Duplicate / blank manual drawing frame |
| U | Onion skins |
| Escape during a stroke | Cancel without an Undo entry |

`[` / `]` still set work-area boundaries with non-paint tools. Rigging, timeline, clip, camera, export and file shortcuts are retained. A captured gesture records its frame, project, target, color, size and brush; changing the destination cannot accidentally commit it elsewhere. Symmetry produces two or four marks in a single Undo step.

## Brush engines

| Family | Character |
| --- | --- |
| Studio Round | Smooth round paint, optional softness and pressure |
| Smooth Ink | Stabilized, pressure-sensitive ink with taper |
| Soft Airbrush | Soft filtered paint with lower flow |
| Graphite | Seeded fine texture |
| Dry Bristle | Broken rectangular pigment marks |
| Chalk | Granular, irregular round texture |
| Felt Marker | Broad, translucent smooth strokes |
| Calligraphy | Angled rectangular tip with adjustable roundness and spacing |
| Pixel Square | Grid-aligned, crisp, connected cells |
| Scatter Spray | Seeded scattered droplets |
| Stipple | Spaced, scattered dots |
| Neon Glow | Soft halo and bright core |

The scratchpad is a **scaled preview**, not document artwork. Brush previews, the stage, onion skins, thumbnails and SVG/PNG/GIF/MP4 rendering share `PaintStroke`/`CelPaint`; texture seeds are saved, so repainting or exporting does not randomize an existing stroke.

Size, opacity and flow affect all brushes. Relevant family-specific dynamics are shown: smoothing/softness for smooth brushes, spacing for stamped brushes, angle/roundness for Calligraphy, scatter for Spray/Stipple, grain for textured brushes, and cell size for Pixel Square. Pixel strokes intentionally do not smooth or taper.

Supported pens supply pressure; mice use full pressure. Size pressure varies along the stroke. Opacity pressure uses the **stroke-average pressure**, not physical pigment simulation. Separate overlapping marks build paint according to their flow/opacity. Coalesced pointer samples and stabilization reduce jagged input; device-specific tablet drivers and physical pen hardware have not all been tested.

## Colors and presets

Color Studio provides a saturation/value plane, keyboard-editable HSV sliders, a hue strip, validated six-digit HEX entry and the native color picker. Studio, Earth, Pastel and Pixel 16 palettes are included, plus 16 recent colors and 32 saved swatches. Saved swatches can be removed with Delete/Backspace or right-click. The toolbar's paired color controls edit foreground/background; X swaps them.

Save up to **24 custom presets** with a name and the current brush/size. **Export pack** saves `.lunobrush` JSON containing custom presets and saved swatches; with no custom preset it packages the current preset. Import is additive, generates fresh preset IDs, and validates the format, version, limits and each parameter. No code, external image URL or filesystem resource is accepted. Input is limited to 100 KB. Removing or resetting a preset does not modify saved artwork.

Tool settings—including foreground color and size—are persisted locally and in library settings/backups. A monotonic modification timestamp prevents a delayed library snapshot from overriding newer local presets at normal startup. An explicit library restore restores that snapshot's painting settings.

## Layers, cels and editing

**Add paint layer** creates a selected drawing layer and switches to cel painting in any document mode. Frame-by-frame documents always paint cels; the Drawing mode control remains visible but is disabled. Rig/motion and video documents can alternatively create brush-styled vector strokes, which remain transformable and animatable.

Select a drawing layer to inspect its active **Stroke stack** (the newest 32 entries are shown). Recolor, apply the current brush/size, or delete a mark; each action is undoable. Fill geometry can be recolored/deleted but is not restyled into a brush path. Eraser order remains unchanged. Editing a held exposure forks it into a new cel rather than changing the earlier source frame.

F6/F7 remain explicit, manual cel operations. Luno does not invent in-between drawings. Onion skins render the same saved brush/eraser geometry. Locks on a drawing or its parent prevent painting/editing; hidden active drawings cannot be painted accidentally.

### Eraser

The cel eraser creates a mask, not destructive edits to source points. It removes **earlier paint on the same cel only**. Later strokes remain visible, and lower layers, vector objects, imported images and other frames remain untouched. Undo removes the eraser mark. Select/add a drawing layer for brush-and-eraser workflows.

### Fill

Fill rasterizes the **active cel in local drawing coordinates**, at no more than 1024 pixels on its longest side, and uses four-connected flood fill with tolerance. Pixel brushes use their cell grid. Transparent areas and enclosed regions are eligible; other composited layers do not form fill boundaries. Geometry is retained as validated compact horizontal runs, so a fill is editable and portable rather than an external bitmap.

Sampling/fill outside the supported target is refused; a failed, cancelled or stale operation makes no artwork/history change. Canvas decoding has a 12-second timeout. Fills on layers larger than the working resolution are approximate at that resolution, not a full-resolution paint-bucket promise.

### Eyedropper

I or Alt+brush samples the rendered composited stage, including the document background, transformed layers and enabled effects. It does not select a layer or create an Undo entry. Rasterization is capped at 2048 pixels on the longest side; large-document samples have that working resolution. Colors are RGB/HEX, not a calibrated ICC/CMYK workflow.

## LAM compatibility and safety

The existing schema-2 project and version-1 LAM container are retained. Legacy path/cel strokes keep their old rendering. Optional pressure, brush, paint/erase mode and fill-run data are validated and saved with the project.

LAM's compressed flag is `1`; advanced painting also sets feature flag `2`, producing flags `3`. Any scene with advanced paint requires **v0.4.0 or later**. Older readers reject these files rather than silently stripping unsupported artwork. Projects without advanced paint continue using flags `1`.

Limits include 20,000 raw points per stroke, 2,048 procedural samples, 768 textured samples, 8,192 pixel cells, 50,000 fill runs, 500 marks per cel, a 160,000 per-cel work budget and a conservative 640,000 per-scene painting-work budget. Painting commits check the 64 MB project limit **before** modifying history/artwork. These protect rendering and portable save; when reached, simplify paint or split work into another scene. This is bounded procedural painting, not a full Photoshop raster engine.
