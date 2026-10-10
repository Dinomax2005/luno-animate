# Production workspace

Luno Animate uses a dense, desktop-oriented 2D animation workbench: application menus, a document toolbar, Layers/Library, a stage, a frame timeline, Properties, and a live status bar. The interface borrows familiar animation-software conventions, not Adobe branding or assets. This is not Adobe Animate feature parity.

## Workspace layouts

Use the **Workspace** selector or **Window** menu:

- **Animation:** selection tool; standard Layers, Properties, and timeline docks.
- **Drawing:** brush tool, frame-by-frame drawing mode, onion skin, and a taller timeline.
- **Rigging:** bone/IK tool, visible rig overlays, connected limb IK, and a wider Properties dock.

A layout does not change artwork or create an undo checkpoint. Drag the separators to resize docks. Focus a separator and use its arrow keys for 8-pixel changes, or Shift-arrow for 32-pixel changes. Double-click a separator to restore its default dimension. **Window → Reset workspace layout** restores the complete default layout.

**Tab**, while the stage is focused, temporarily hides the docks. Press Tab again or click **Restore panels** to return. It does not change saved panel visibility choices. The Window menu can show or hide individual docks. On compact screens the footer's Layers and Properties buttons open dismissible panel overlays, rather than squeezing the canvas into an unusable width.

Dock geometry, timeline zoom, layout name, panel visibility, and rulers are stored separately under `luno.workspace.pro.v1`. Cursor coordinates, focus mode, and temporary overlays are not persisted. These preferences are neither document contents nor additions to the native backup/settings schema. A layout storage failure never blocks document saves.

## Menus and command search

**File / Edit / Insert / Object / Animation / View / Window / Help** contain working editor operations. Unavailable operations are disabled—for example Undo without history, drawing exposure operations without a drawing layer, or group operations without a suitable selection.

Press **Ctrl/⌘ Shift P** to search command names, menu categories, shortcuts, and descriptions. Search words can appear in any order. Arrow keys navigate enabled results; Enter runs the command; Escape closes search. Workspace presets are searchable too. The menu bar and stage context menu support arrow navigation, Home/End, Enter, and Escape.

Command execution respects the editor's busy, blocked, and interacting states. It does not bypass export, project-import, update, or recovery protections.

## Stage and selection

- **V:** Selection. Click to select, Shift-click to add or remove a layer, or drag empty stage space for marquee selection.
- **Ctrl/⌘-click:** Select within a group instead of the group's root.
- **Arrow keys with the stage focused:** Nudge the selection by 1 stage pixel. **Shift-arrow:** 10 pixels. This moves artwork, not the playhead.
- **Comma / period:** Step the timeline backward/forward. Arrow keys with the timeline ruler focused also step frames.
- **H:** Hand tool. Drag to pan the editor view.
- **Ctrl/⌘ wheel** or **Ctrl/⌘ + / −:** Zoom the editor view. **Ctrl/⌘ 0:** Fit/reset the stage view.
- Drag selection corners to scale; Shift constrains proportions. Drag the rotation handle to rotate; Shift snaps to 15-degree increments.
- Right-click artwork to select it and open context actions: undo/redo, duplicate/delete, group/ungroup, arrange, insert a keyframe, and fit stage.

Nudging uses the current sampled animation pose and parent transform. Selected descendants are not moved twice when an ancestor is also selected. Inherited locks are honored. One nudge of a multi-selection is one undo transaction. Auto-key behavior is the same as a stage drag or Properties edit.

Rulers show stage-space units relative to the fitted/panned artboard. The footer samples pointer coordinates once per animation frame. The editor zoom and pan are different from an animated scene camera; neither changes the rendered output.

## Properties and timeline

Select a layer to edit its transform, appearance, text, attachment, or rig. Numeric fields commit validated values on Enter or blur. The Motion tab edits keyframe interpolation and custom Bézier easing. With nothing selected, Properties shows document resolution, frame rate, duration, and layer count.

The timeline contains object tracks, drawing exposures, a scene-camera track, and imported audio waveforms. It supports:

- playback of the work area, loop control, frame stepping, and previous/next keys;
- draggable keyframes and cels, Shift-click key selection, key copy/paste/delete;
- work-area in/out fields, **[ / ]** at the playhead, and full-scene reset;
- automatic/manual transform keys, **K** insertion, and independent timeline zoom;
- frame-by-frame drawing: **B**, choose Frame-by-frame, **F7** blank cel, **F6** previous drawing;
- embedded audio import, waveform positioning, and Properties controls for trim, volume, and mute.

**G** activates character posing. Drag a hand or foot for two-bone IK; hold Shift for direct joint rotation. Custom bones, limits, parenting, and joint locks are in Properties. Rigging is FK/IK with joint-attached cutout artwork, not automatic mesh skinning.

## Document safety and delivery

The document manager defaults to a list; Templates are an explicit section. File → New opens compact document source, width/height, and FPS fields and defaults to an empty white stage. Motion presets are collapsed under the Motion tab, not shown as object-property cards. Workspace setup is a configuration form without a mascot or pose tutorial.

The document manager remains a persistent local library—not example/mock projects. Returning home durably saves before navigation. Autosave status distinguishes saving, saved, and errors. Export `.lam` for portable editable copies, and use the export dialog for MP4, GIF, PNG, SVG, or sprite atlases.

The professional workspace does not change `.lam` format/schema, media encoding, native library locations, installation setup, or guarded update logic. Desktop installation and stable update-feed availability are described in [INSTALLATION.md](INSTALLATION.md).
