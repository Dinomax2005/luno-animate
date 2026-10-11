# Starting and saving documents

**Start** is a compact production launcher: New document, Open, and up to five recent library documents. Choose Hand-drawn, Rig / motion, or Video editing to enter the technical New dialog. The startup checkbox is persistent; Help can reopen Start at any time. What’s New appears once per application version (including upgrades), before Start on a normal launch. Native file associations finish opening first and suppress Start; the optional setup wizard is not an automatic launch interruption.

| Action | Shortcut | Behavior |
| --- | --- | --- |
| Save | Ctrl/⌘ S | Overwrites the opened, approved `.lam`; a new/unlinked document requests a destination. |
| Save As… | Ctrl/⌘ Shift S | Chooses a new file; later Save uses it only after the write succeeds. |
| Export .lam copy… | File menu | Writes/downloads a portable copy without changing the current Save destination. |
| Open | Ctrl/⌘ O | Native picker or compatible browser handle; ordinary input fallback is read-only. |

The document tab’s `*` indicates modified external-file content. The status bar names the linked file; **Saved locally** describes the library only. Save errors remain in a dismissible header banner with Save As, not merely a timed toast. Cancel leaves the destination unchanged. Changed/missing/read-only files are not silently recreated or clobbered; reopen or choose Save As. File permissions are session-only: library snapshots after a restart need Open/Save As to link an external file again. Important external files also deserve independent backups.

## Animation document types

- **Hand-drawn:** selected drawing layer, pen/cel drawing, onion skin on, automatic transform keys off, single-frame cels. Frame 1 starts blank; the initial two-frame scene grows as needed. **F7 / Blank frame** advances and creates an empty cel; **F6 / Duplicate frame** advances with an independent copy. An existing destination cel is kept. Empty/uncreated frames render blank during playback/export. Frame arrows and the timeline can also select a frame directly for drawing. Drawing workspaces and defaults are restored when reopening this type.
- **Video editing:** footage layers with embedded proxy frames, linked sound, trim/split/move/fades, and animated artwork/title overlays. See the video limits below.
- **Rig / motion:** vector selection, characters/cutouts, drag/pose editing, manual or automatic keyframes, interpolation, and FK/IK. Existing documents without a stored type default to this workflow. Legacy cel tools in this type keep their original current-frame insertion/held-exposure semantics.

# Production workspace

Luno Animate uses a dense, desktop-oriented 2D animation workbench: application menus, a document toolbar, Layers/Library, a stage, a frame timeline, Properties, and a live status bar. The interface borrows familiar animation-software conventions, not Adobe branding or assets. This is not Adobe Animate feature parity.

## Workspace layouts

Use the **Workspace** selector or **Window** menu:

- **Animation:** selection tool; standard Layers, Properties, and timeline docks.
- **Drawing:** brush tool, frame-by-frame drawing mode, onion skin, and a taller timeline.
- **Motion:** timed artwork layers, property diamonds, Effects/Timing, and larger Properties/timeline docks.
- **Video editing:** footage-first timeline with Layers hidden initially; Window can restore it.
- **Rigging:** bone/IK tool, visible rig overlays, connected limb IK, and a wider Properties dock.

A layout does not change artwork or create an undo checkpoint. Drag the separators to resize docks. Focus a separator and use its arrow keys for 8-pixel changes, or Shift-arrow for 32-pixel changes. Double-click a separator to restore its default dimension. **Window → Reset workspace layout** restores the contextual defaults for the active workspace only; other customized workspaces stay intact.

**Tab**, while the stage is focused, temporarily hides the docks. Press Tab again or click **Restore panels** to return. It does not change saved panel visibility choices. The Window menu can show or hide individual docks. On compact screens the footer's Layers and Properties buttons open dismissible panel overlays, rather than squeezing the canvas into an unusable width.

Dock geometry, timeline zoom, layout name, panel visibility, and rulers are stored separately under `luno.workspace.pro.v1`. Individual mode profiles live under `luno.workspace.pro.profiles.v1`; switching modes restores their own dimensions, visibility, timeline zoom, and snapping. Older active layouts are retained on upgrade. Cursor coordinates, focus mode, and temporary overlays are not persisted. These preferences are neither document contents nor additions to the native backup/settings schema. A layout storage failure never blocks document saves.

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

The document manager defaults to a list; Templates are an explicit section. File → New opens compact document source, width/height, and FPS fields and defaults to an empty white stage for Rig / motion or a blank drawing layer for Hand-drawn. Motion presets are collapsed under the Motion tab, not shown as object-property cards. Workspace setup is a configuration form without a mascot or pose tutorial.

The document manager remains a persistent local library—not example/mock projects. Returning home durably saves before navigation. Autosave status distinguishes saving, saved, and errors. Export `.lam` for portable editable copies, and use the export dialog for MP4, GIF, PNG, SVG, or sprite atlases.

The professional workspace does not change `.lam` format/schema, media encoding, native library locations, installation setup, or guarded update logic. Desktop installation and stable update-feed availability are described in [INSTALLATION.md](INSTALLATION.md).

## Motion and Video workspaces (v0.3.6)

Rig / motion opens the Motion preset, with larger Properties/timeline docks and timed layer bars. Video editing opens the Video preset with a footage-first timeline; Layers remains available through Window. Animation/Drawing/Rigging presets and saved custom layouts remain supported. The document type is separate from the panel layout.

Select a layer and use **Object** for its transform/rig, **Motion** for interpolation, **Effects** for Gaussian blur/brightness/saturation, or **Timing** for lifetime edits. Property diamonds add/remove only their own channel at the current frame. Editing an already-animated property adds that property's key even with Auto-key off. The Bézier graph has draggable handles; arrow keys move a focused handle in 0.05 increments (Shift: 0.01). Input fields remain available. Effects render in the stage and all rendered output. Apply effects/timing to artwork layers, not groups.

Drag a layer clip to move it; move preserves its animation/cels, shifts linked sound, and extends the scene within the 1,800-frame limit. Drag an edge to shorten it or restore available source handles; video and linked sound remain aligned. Timing also has precise **Clip in / Clip out** fields. Snapping aligns to the playhead, neighboring clip/sound boundaries, scene, and work area. The timeline magnet toggles it; **Alt** bypasses it during a drag. Arrow keys on a clip/edge nudge that timing by one frame (Shift: ten). **Timing → Trim start/end to playhead**, **Split at playhead** (**Ctrl/⌘ Shift D**), and **Fade in/out** are undoable. Split retains globally timed animation and shared source media. Fades add opacity keys without deleting position/rig channels. Empty/out-of-range clips do not render. The Out number is the final included, one-based frame; the file stores an exclusive zero-based end.

**Import video** accepts a decodable MP4/WebM/MOV/M4V, up to 150 MB/30 seconds. A cancellable progress screen locks editing until every required video/audio chunk is prepared and the bounded project validates. Footage is converted into embedded JPEG proxies (960px maximum) and linked PCM sound. No external source is changed; no half-imported layers are added. Select the sound waveform for volume/mute; independently changing its start/trim breaks linkage and prevents later video edits from unexpectedly re-timing it. Add vector/text/image/drawing layers for animated overlays. Proxy quality and the portable 64 MB limit are intentionally disclosed in Import/What’s New and README.

The small blue native startup popup is separate from Start: the main studio stays hidden while the library and associated file initialize, then the popup closes before the main app opens. Its bridge has only status/retry/quit, not editor or file access. The browser fallback is a compact card, not a full-window loading page. The workspace is inert during boot and media import. What’s New remains once per version; Start is still optional and remembered.

## Property lanes and precision controls (v0.3.7)

Expand the chevron next to an animated timeline layer to see only its authored **Position X/Y, Scale X/Y, Rotation, Opacity, Rig pose, Blur, Brightness, and Saturation** tracks. A lane diamond moves/deletes/copies only that channel; other values and rig poses at the same physical key are preserved. Shift-click selects several lane keys. Copy groups selected values at the same frame; paste retains relative timing and merges with unrelated destination values. Overlapping values are replaced, with one undo transaction. The layer-level diamond still represents the complete key.

Focused diamonds support ←/→ timing nudges (Shift: ten frames), Enter/Space selection, and ordinary Copy/Paste/Delete. The timeline ruler supports Home/End, ←/→ (Shift: ten), and Page Up/Down (one second). Opacity drags now edit the sampled animated channel as one undo gesture; effect reset writes values at the playhead rather than invisibly changing an animated base value.

**LAM v2 stores one easing curve per physical keyframe.** Channels remain independently keyed/sampled, but easing is shared when they coincide at a frame. Moving/pasting into a key with unrelated channels preserves that destination key’s easing. Editing its curve changes all coincident channels. Per-channel easing metadata is not claimed.
