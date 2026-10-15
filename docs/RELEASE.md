# Pegbar Studio release notes

## 2.0.0

The studio is now **Pegbar Studio**. The earlier name collided with an unrelated financial brand, so the package, app id, executable, installer names, window titles and file signature carry the new identity. This is an identity change, not a format break:

- Projects saved by 1.0 open in 2.0, upgrade in memory and re-save under the new signature. Nothing is deleted or rewritten silently.
- Verified backups created by 1.0 still restore, interface preferences carry over once, and the desktop build adopts the existing library folder by rename on first start, so your projects, revisions and backups stay where you left them.
- The abandoned pre-1.0 container is still refused without touching the file.

### New in 2.0

- **In-betweens.** Add in-between keys between the poses in your work area, with even spacing, favour-first, favour-last or ease-both rhythm. Every inserted key holds the pose the curve already passes through at that frame, so drawings you have already made stay exactly where they are. Ctrl B adds three evenly spaced in-betweens to the selection.
- **Motion audit.** A timing readout for the scene, in the spirit of an exposure sheet: long gaps between poses, single-frame pops, dead holds that repeat one pose, constant-speed ramps and linear keys that start and stop instantly. Each finding offers the fix that matches it — space the in-betweens, favour a pose, smooth every key, or remove repeated keys. It reads the keys already in the document and runs on your computer; there is no account, no connection and nothing to pay.
- **Motion paths.** A selected keyed layer now draws its path across the scene, with a dot on every key and a marker at the playhead, so you can see the arc before you watch it play.
- **Mirror drawing.** Press M to mirror every stroke across the canvas centreline, the way a light-table mirror doubles a drawing. Erasing mirrors too; fills are left alone because they are positional.
- **Sprite sheets.** Export every frame as one PNG grid plus a JSON atlas of the cells, for game engines and web players. Choose the column count, the resolution and the range.
- **WebM.** Export VP9 with Opus audio next to MP4 — the container browsers and web players take directly.

- Fixed: the updater accepts the whole release line again, including 2.x. Earlier builds only accepted 1.x versions and would have ignored this release.

## 1.0.3

- Fixed: the window no longer shows a menu strip above the editor. The application bar is now a single row, and the library screen has no bar at all.
- General UI changes: commands live behind one application menu button in the top bar, so the editor keeps one row of chrome instead of two.
- The application now draws its own pointer everywhere, not only on the canvas: arrow, text caret and panel resize cursors follow the pointer by hand, so it stays visible with a stylus, on a touch screen and in full-screen or streamed sessions.
- Small alignment and spacing fixes in the library header and document tab.

## 1.0.2

- Bug fixes: the canvas now draws a pointer for every tool. Brush and eraser keep a ring sized to the tip, the selection arrow is anchored at its exact hotspot, and hand, type, shape, rig, fill and eyedropper each show a suitable pointer.
- Bug fixes: the pointer no longer jumps to the corner of the canvas after the pointer leaves and re-enters the drawing area.
- Bug fixes: fixed a development-server stall that could interrupt the first media import.

## 1.0.1

- Bug fixes: drawing and erasing no longer require guessing where the next mark lands. The canvas shows a ring sized to the active brush tip, scaled with zoom, with a crosshair and centre dot.
- Bug fixes: the ring switches to a dashed outline when the brush is smaller than the smallest ring, and the eraser has its own dashed ring.
- General UI changes: the pointer over the canvas follows the tool for hand, selection and type as well.

## 1.0.0

First Studio release: new scene engine, renderer, desktop shell, brand, project format and test suite. Graphite surfaces, hairline borders and a single amber accent, described in `DESIGN.md`. Earlier Pegbar Animate versions and their project files are out of date and are not opened or converted by this release.

### Draw

- Eight pressure-aware brushes with stabilization, flow, spacing, pixel painting and pen pressure.
- Non-destructive erasing on the active cel, bounded fill, eyedropper, manual cels, held exposures, onion skins.

### Motion

- Editable shapes and type, transform and property keys, custom easing curves, grouping.
- 2D armature with constrained inverse kinematics, bone editing and attachments.

### Edit

- Embedded image, audio and video media with waveforms, bounded decoded video proxies, linked audio, trim and split controls, animated overlays.
- Scene ordering, work-area playback, reference boards with notes, command search, resizable docks, focus mode, light and dark surfaces, and a local project library.
- Linked overwrite save, save as, external conflict protection, revisions and desktop library backups.
- H.264 MP4 with audio where the device supports it, transparent PNG, PNG sequences in one zip, flattened raster SVG snapshots, and compressed, integrity-checked `.lam` documents.

## Free to use

No subscriptions, no account, no trials and no watermarks. Every tool is available in every build. The application licence covers the software itself; the work you make with Pegbar Studio belongs to you and is not claimed by us.

## Legacy versions

Every earlier Pegbar Animate release and its project files are unsupported. Keep your old files and export media from an older build if you still need them. Studio 1.0 uses its own identity, its own update channel and its own `.lam` format, so an old updater or old project reader will not become compatible with it.

## Working limits

Projects up to 64 MB. 1,800 frames per scene, 32 scenes, 256 layers, up to 4,096 px canvases. Video imports up to 100 MB and 30 seconds become a 960 px, 20 fps proxy rather than a full copy of the source. MP4 jobs up to 1,800 frames or 120 seconds; PNG sequence jobs up to 300 frames or 100 MB. Audio encoding depends on the device. SVG export is a flattened snapshot; editable vector data stays in the `.lam` document. Armatures are 2D and are not mesh deformation or 3D.

Unsigned macOS and DEB builds update manually. Installer builds do not by themselves prove anything about a specific machine, tablet or older upgrading copy.

## Licence

Free proprietary licence. Redistribution, rebranding and resale of the application need written permission, where such rights can be granted. The licence text in `LICENSE` is a draft and is kept under review.
