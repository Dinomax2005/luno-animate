import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Camera as CameraIcon, Copy, Expand, Grid3X3, Magnet, Minus, Plus, Route, SquarePlus, Layers2 } from 'lucide-react';
import { appCommands, executeCommand, shortcutLabel } from './studio/commands';
import { useWorkspace } from '../store/workspace';
import { freshBrush, isPaintTool, usePaint } from '../store/paint';
import { activePresetName } from '../store/paint';
import { inputPressure, mirrorStrokes, stabilizePoint } from '../engine/brushes';
import { CelPaint, PaintStroke } from './PaintGraphic';
import { useEditor } from '../store/editor';
import { sampleCamera, sampleCel } from '../engine/animation';
import { createItem, createShape, createText } from '../engine/project';
import { forwardKinematics, poseJoint, radians, clamp } from '../engine/rig';
import { sceneNodes, matrixString, inverse, transformPoint, itemBounds, parentOf, type RenderNode } from '../engine/geometry';
import type { Camera, Point, Project, Rig, Stroke } from '../engine/types';
import { ItemGraphic, ItemEffects, effectFilter, cameraTransform } from './SceneGraphics';
import { SceneSwitcher } from './studio/SceneSwitcher';

interface Gesture { kind: 'move' | 'bone' | 'pan' | 'draw' | 'paint' | 'box' | 'scale' | 'rotate' | 'camera'; start: Point; node?: RenderNode; nodes?: RenderNode[]; boneId?: string; rig?: Rig; pan?: Point; camera?: Camera; corner?: Point; checkpointed?: boolean; pointerId?: number; paint?: { stroke: Stroke; project: Project; frame: number; tool: 'pen' | 'eraser'; mode: 'cel' | 'vector'; node?: RenderNode; symmetry: 'none' | 'vertical' | 'horizontal' | 'both' } }
export function Stage() {
  const project = useEditor(s => s.project), frame = useEditor(s => s.frame), selectedId = useEditor(s => s.selectedId), selectedIds = useEditor(s => s.selectedIds), selectedBone = useEditor(s => s.selectedBone);
  const playing = useEditor(s => s.playing), tool = useEditor(s => s.tool), zoom = useEditor(s => s.zoom), pan = useEditor(s => s.pan), preferences = useEditor(s => s.preferences);
  const containerRef = useRef<HTMLDivElement>(null), svgRef = useRef<SVGSVGElement>(null), worldRef = useRef<SVGGElement>(null), gesture = useRef<Gesture | null>(null);
  const [size, setSize] = useState({ width: 760, height: 530 }), [draft, setDraft] = useState<Point[]>([]), [box, setBox] = useState<{ start: Point; end: Point } | null>(null);
  const [paintDraft, setPaintDraft] = useState<Stroke | null>(null), [hover, setHover] = useState<Point | null>(null);
  const paintFrame = useRef<number | null>(null), symmetry = usePaint(s => s.symmetry), currentBrush = usePaint(s => s.brush);
  useEffect(() => { if (tool === 'pen' || tool === 'eraser' || tool === 'bucket') usePaint.getState().setLastTool(tool); }, [tool]);
  const showRulers = useWorkspace(s => s.showRulers), [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const cursorPoint = useRef<Point | null>(null), cursorFrame = useRef<number | null>(null), contextRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => { if (cursorFrame.current !== null) cancelAnimationFrame(cursorFrame.current); if (paintFrame.current !== null) cancelAnimationFrame(paintFrame.current); if (gesture.current) useEditor.getState().setInteracting(false); useWorkspace.getState().setCursor(null); }, []);
  useEffect(() => { if (!context) return; const close = (e: globalThis.PointerEvent) => { if (!contextRef.current?.contains(e.target as Node)) setContext(null); }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close); }, [context]);
  useEffect(() => { if (context) contextRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true }); }, [context]);
  const nodes = sceneNodes(project, frame), selected = nodes.find(n => n.item.id === selectedId);
  const fit = Math.max(0.1, Math.min((size.width - 92) / project.width, (size.height - 134) / project.height)), scale = fit * zoom / 100;
  const camera = sampleCamera(project.camera, frame);
  useEffect(() => { if (!containerRef.current) return; const observer = new ResizeObserver(entries => { const r = entries[0].contentRect; setSize({ width: r.width, height: r.height }); }); observer.observe(containerRef.current); return () => observer.disconnect(); }, []);
  useEffect(() => { const element = containerRef.current; if (!element) return; const wheel = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const s = useEditor.getState(); s.setZoom(s.zoom * (e.deltaY > 0 ? 0.9 : 1.1)); } }; element.addEventListener('wheel', wheel, { passive: false }); return () => element.removeEventListener('wheel', wheel); }, []);
  const point = (event: Pick<PointerEvent, 'clientX' | 'clientY'>, screen = false): Point => { const matrix = (screen ? svgRef.current : worldRef.current)?.getScreenCTM(); if (!matrix) return { x: 0, y: 0 }; const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()); return { x: p.x, y: p.y }; };
  const hasSelectedAncestor = (id: string, ids: string[]) => { let parent = parentOf(project.items.find(i => i.id === id)!); const seen = new Set<string>(); while (parent && !seen.has(parent)) { if (ids.includes(parent)) return true; seen.add(parent); const item = project.items.find(i => i.id === parent); parent = item ? parentOf(item) : null; } return false; };
  const capture = (e: PointerEvent) => { svgRef.current?.setPointerCapture(e.pointerId); e.preventDefault(); useEditor.getState().setInteracting(true); };
  const snap = (v: number) => preferences.snapToGrid ? Math.round(v / preferences.gridSize) * preferences.gridSize : Math.round(v);
  const onItemDown = (event: PointerEvent, original: RenderNode) => {
    if (!['select', 'rig'].includes(tool) || event.button !== 0) return; event.stopPropagation(); const s = useEditor.getState(); s.setPlaying(false); let node = original;
    if (!event.ctrlKey && !event.metaKey) while (node.item.parentId) node = nodes.find(n => n.item.id === node.item.parentId)!;
    if (event.shiftKey) { s.toggleSelect(node.item.id); return; }
    const ids = selectedIds.includes(node.item.id) ? selectedIds : [node.item.id]; if (!selectedIds.includes(node.item.id)) s.select(node.item.id);
    if (node.locked) { s.notify('This layer or its parent is locked. Unlock it in Layers.', 'info'); return; }
    svgRef.current?.focus({ preventScroll: true }); capture(event); gesture.current = { kind: 'move', start: point(event), node, nodes: nodes.filter(n => ids.includes(n.item.id) && !n.locked && !hasSelectedAncestor(n.item.id, ids)) };
  };
  const onBoneDown = (event: PointerEvent, node: RenderNode, boneId: string) => {
    if (!['select', 'rig'].includes(tool) || node.locked || playing || node.item.rig?.bones.find(b => b.id === boneId)?.locked) return; event.stopPropagation(); capture(event);
    const s = useEditor.getState(); if (s.selectedId !== node.item.id) s.select(node.item.id); s.selectBone(boneId); s.setTool('rig');
    gesture.current = { kind: 'bone', start: point(event), node, boneId, rig: node.item.rig };
  };
  const onHandleDown = (event: PointerEvent, kind: 'scale' | 'rotate', corner?: Point) => { if (!['select', 'rig'].includes(tool) || !selected || selected.locked) return; event.stopPropagation(); capture(event); gesture.current = { kind, start: point(event), node: selected, corner }; };
  const paintTarget = () => {
    const state = useEditor.getState(), available = sceneNodes(state.project, state.frame), selectedDrawing = available.find(n => n.item.id === state.selectedId && n.item.type === 'drawing');
    return selectedDrawing ?? [...available].reverse().find(n => n.item.type === 'drawing' && !n.locked && n.visible);
  };
  const sampleColor = async (event: PointerEvent<SVGSVGElement>) => {
    event.preventDefault(); const state = useEditor.getState(), at = point(event, true), snapshot = state.project, frame = state.frame;
    state.setPlaying(false); state.setBusy(true);
    try { const { pickStageColor } = await import('../services/painting'); const color = await pickStageColor(snapshot, frame, at);
      if (useEditor.getState().project !== snapshot || useEditor.getState().frame !== frame) return;
      if (color) { useEditor.getState().setPreference('brushColor', color); usePaint.getState().rememberColor(color); if (tool === 'eyedropper') useEditor.getState().setTool(usePaint.getState().lastTool); }
      else state.notify('No painted color at this point. Your brush color is unchanged.', 'info');
    } catch (error) { state.notify(error instanceof Error ? error.message : 'Could not sample the canvas.', 'error'); }
    finally { state.setBusy(false); }
  };
  const fillCel = async (event: PointerEvent<SVGSVGElement>) => {
    event.preventDefault(); const state = useEditor.getState(), target = paintTarget();
    if (!target || target.locked || !target.visible) { state.notify('Select an unlocked, visible paint layer for the bucket. Use + in Brush Studio to add one.', 'info'); return; }
    const snapshot = state.project, at = transformPoint(inverse(target.matrix), point(event)), frame = state.frame, paint = usePaint.getState(), color = state.preferences.brushColor;
    state.setPlaying(false); state.setBusy(true);
    try { const { bucketStroke } = await import('../services/painting'); const stroke = await bucketStroke(target.item, frame, at, color, freshBrush(), paint.fillTolerance);
      state.setBusy(false);
      if (stroke && useEditor.getState().paintStrokeBatch([stroke], { targetId: target.item.id, mode: 'cel', space: 'local', expectedProject: snapshot, frame })) paint.rememberColor(color);
    } catch (error) { state.notify(error instanceof Error ? error.message : 'Could not fill this cel.', 'error'); }
    finally { state.setBusy(false); }
  };
  const clearPaint = () => {
    if (paintFrame.current !== null) cancelAnimationFrame(paintFrame.current); paintFrame.current = null;
    const pointer = gesture.current?.pointerId; gesture.current = null; setPaintDraft(null); setDraft([]); setBox(null); useEditor.getState().setInteracting(false);
    if (pointer !== undefined && svgRef.current?.hasPointerCapture(pointer)) svgRef.current.releasePointerCapture(pointer);
  };
  const onDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.button !== 1 || useEditor.getState().busy || useEditor.getState().blockReason) return; setContext(null); svgRef.current?.focus({ preventScroll: true });
    if (event.button === 0 && (tool === 'eyedropper' || event.altKey && ['pen', 'eraser'].includes(tool))) { void sampleColor(event); return; }
    if (event.button === 0 && tool === 'bucket') { void fillCel(event); return; }
    capture(event); const s = useEditor.getState(); s.setPlaying(false); const p = point(event);
    if (tool === 'hand' || event.button === 1) gesture.current = { kind: 'pan', start: { x: event.clientX, y: event.clientY }, pan };
    else if (tool === 'camera') gesture.current = { kind: 'camera', start: point(event, true), camera };
    else if (tool === 'pen' || tool === 'eraser') {
      const mode = tool === 'eraser' || project.animationMode === 'frame-by-frame' || preferences.drawingMode === 'cel' ? 'cel' : 'vector', target = mode === 'cel' ? paintTarget() : undefined;
      if (target && (target.locked || !target.visible)) { s.notify('Unlock and reveal this drawing layer before painting.', 'info'); clearPaint(); return; }
      if (tool === 'eraser' && !target) { s.notify('The cel eraser needs a paint layer. Add one in Brush Studio.', 'info'); clearPaint(); return; }
      const pressure = inputPressure(event.pointerType, event.pressure), start = { ...p, pressure }, stroke: Stroke = { points: [start, start], color: preferences.brushColor, width: preferences.brushSize, brush: freshBrush(), mode: tool === 'eraser' ? 'erase' : 'paint' };
      gesture.current = { kind: 'paint', start: p, pointerId: event.pointerId, paint: { stroke, project: s.project, frame: s.frame, tool, mode, node: target, symmetry } }; setPaintDraft({ ...stroke });
    }
    else if (['rectangle', 'ellipse'].includes(tool)) { gesture.current = { kind: 'draw', start: p }; setDraft([p, p]); }
    else if (tool === 'text') { s.addItem(createText(snap(p.x), snap(p.y), 'Text')); s.setInteracting(false); }
    else { if (!event.shiftKey) s.select(null); gesture.current = { kind: 'box', start: p }; setBox({ start: p, end: p }); }
  };
  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    cursorPoint.current = point(event);
    if (cursorFrame.current === null) cursorFrame.current = requestAnimationFrame(() => { const cursor = cursorPoint.current; if (cursor) { useWorkspace.getState().setCursor({ x: Math.round(cursor.x), y: Math.round(cursor.y) }); setHover(cursor); } cursorFrame.current = null; });
    const g = gesture.current; if (!g) return; const s = useEditor.getState(), p = point(event);
    if (['move', 'bone', 'scale', 'rotate', 'camera'].includes(g.kind) && !g.checkpointed) { const current = g.kind === 'camera' ? point(event, true) : p; if (Math.hypot(current.x - g.start.x, current.y - g.start.y) < 1) return; s.checkpoint(); g.checkpointed = true; }
    if (g.kind === 'move') for (const node of g.nodes ?? []) { const parent = inverse(node.parentMatrix), start = transformPoint(parent, g.start), end = transformPoint(parent, p); s.editItem(node.item.id, { x: snap(node.item.x + end.x - start.x), y: snap(node.item.y + end.y - start.y) }, false); }
    else if (g.kind === 'bone' && g.node && g.rig && g.boneId) s.editBone(g.node.item.id, poseJoint(g.rig, g.boneId, transformPoint(inverse(g.node.matrix), p), preferences.inverseKinematics && !event.shiftKey), false);
    else if (g.kind === 'scale' && g.node && g.corner) {
      const item = g.node.item, local = transformPoint(inverse(g.node.matrix), p); let x = Math.abs(local.x / g.corner.x), y = Math.abs(local.y / g.corner.y);
      if (event.shiftKey || item.type === 'character') x = y = Math.max(x, y);
      s.editItem(item.id, { scaleX: clamp(item.scaleX * x, 0.01, 100), scaleY: clamp(item.scaleY * y, 0.01, 100) }, false);
    } else if (g.kind === 'rotate' && g.node) { const item = g.node.item, start = transformPoint(inverse(g.node.parentMatrix), g.start), end = transformPoint(inverse(g.node.parentMatrix), p); const angle = item.rotation + (Math.atan2(end.y - item.y, end.x - item.x) - Math.atan2(start.y - item.y, start.x - item.x)) * 180 / Math.PI; s.editItem(item.id, { rotation: event.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle) }, false); }
    else if (g.kind === 'camera' && g.camera) { const now = point(event, true), dx = (now.x - g.start.x) / g.camera.zoom, dy = (now.y - g.start.y) / g.camera.zoom, r = radians(g.camera.rotation); s.editCamera({ x: g.camera.x - dx * Math.cos(r) + dy * Math.sin(r), y: g.camera.y - dx * Math.sin(r) - dy * Math.cos(r) }, false); }
    else if (g.kind === 'pan' && g.pan) s.setPan({ x: g.pan.x + event.clientX - g.start.x, y: g.pan.y + event.clientY - g.start.y });
    else if (g.kind === 'box') setBox({ start: g.start, end: p });
    else if (g.kind === 'paint' && g.paint) {
      const native = event.nativeEvent, samples = native.getCoalescedEvents?.() ?? [], stroke = g.paint.stroke;
      for (const sample of samples.length ? samples : [native]) {
        if (stroke.points.length >= 20000) break;
        const next = { ...point(sample), pressure: inputPressure(sample.pointerType || event.pointerType, sample.pressure) }, previous = stroke.points.at(-1)!;
        const smooth = stabilizePoint(previous, next, stroke.brush!.kind === 'pixel' ? 0 : stroke.brush!.smoothing);
        if (Math.hypot(smooth.x - previous.x, smooth.y - previous.y) >= 0.15 || Math.abs((smooth.pressure ?? 1) - (previous.pressure ?? 1)) > 0.03) stroke.points.push(smooth);
      }
      if (paintFrame.current === null) paintFrame.current = requestAnimationFrame(() => { paintFrame.current = null; const current = gesture.current?.paint?.stroke; if (current) setPaintDraft({ ...current, points: [...current.points] }); });
    }
    else if (g.kind === 'draw') setDraft([g.start, p]);
  };
  const onUp = (event: PointerEvent<SVGSVGElement>, cancelled = false) => {
    const s = useEditor.getState();
    if (gesture.current?.kind === 'paint') {
      const paint = gesture.current.paint!;
      if (!cancelled) {
        const last = paint.stroke.points.at(-1)!, end = { ...point(event), pressure: last.pressure ?? 1 };
        if (paint.stroke.points.length < 20000 && Math.hypot(end.x - last.x, end.y - last.y) > 0.15) paint.stroke.points.push(end);
        const strokes = mirrorStrokes(paint.stroke, paint.symmetry, paint.project.width, paint.project.height);
        if (s.paintStrokeBatch(strokes, { mode: paint.mode, targetId: paint.node?.item.id ?? null, expectedProject: paint.project, frame: paint.frame })) usePaint.getState().rememberColor(paint.stroke.color);
      }
      clearPaint(); return;
    }
    if (!cancelled && gesture.current?.kind === 'box' && box && Math.hypot(box.end.x - box.start.x, box.end.y - box.start.y) > 3) {
      const left = Math.min(box.start.x, box.end.x), top = Math.min(box.start.y, box.end.y), right = Math.max(box.start.x, box.end.x), bottom = Math.max(box.start.y, box.end.y);
      const ids = nodes.filter(n => n.visible && !n.locked && !n.item.parentId && n.item.type !== 'group').filter(n => { const b = itemBounds(n.item); const points = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => transformPoint(n.matrix, { x, y })); return Math.min(...points.map(p => p.x)) < right && Math.max(...points.map(p => p.x)) > left && Math.min(...points.map(p => p.y)) < bottom && Math.max(...points.map(p => p.y)) > top; }).map(n => n.item.id);
      useEditor.setState({ selectedIds: event.shiftKey ? [...new Set([...s.selectedIds, ...ids])] : ids, selectedId: ids.at(-1) ?? null, selectedBone: null });
    }
    if (!cancelled && gesture.current?.kind === 'draw' && draft.length >= 2) {
      const xs = draft.map(p => p.x), ys = draft.map(p => p.y), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), w = Math.max(2, maxX - minX), h = Math.max(2, maxY - minY);
      if (w > 3 || h > 3) {
        if (tool === 'pen' && preferences.drawingMode === 'cel') s.addCelStroke(draft);
        else { const x = (minX + maxX) / 2, y = (minY + maxY) / 2; const item = tool === 'pen' ? createItem('path', { name: 'Drawing', x, y, width: w, height: h, points: draft.map(p => ({ x: p.x - x, y: p.y - y })), stroke: preferences.brushColor, strokeWidth: preferences.brushSize }) : { ...createShape(tool === 'ellipse' ? 'ellipse' : 'rectangle', x, y), width: w, height: h, fill: preferences.brushColor }; s.addItem(item); if (tool === 'pen') s.setTool('pen'); }
      }
    }
    gesture.current = null; setDraft([]); setBox(null); s.setInteracting(false); if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
  };
  const previewWorld = paintDraft ? mirrorStrokes(paintDraft, gesture.current?.paint?.symmetry ?? symmetry, project.width, project.height) : [];
  const localPreview = (node: RenderNode) => previewWorld.map(stroke => ({ ...stroke, points: stroke.points.map(p => ({ ...p, ...transformPoint(inverse(node.matrix), p) })) }));
  const drawingCursor = preferences.drawingMode === 'cel' || tool === 'eraser' ? paintTarget() : undefined;
  const cursorLocal = hover && drawingCursor ? transformPoint(inverse(drawingCursor.matrix), hover) : hover;
  const chosen = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [], first = draft[0], last = draft.at(-1);
  const celFrames = [...new Set(project.items.filter(i => i.type === 'drawing').flatMap(i => i.cels?.map(c => c.frame) ?? []))].sort((a, b) => a - b);
  const ghostFrames = celFrames.length ? [...celFrames.filter(f => f < frame).slice(-preferences.onionBefore), ...celFrames.filter(f => f > frame).slice(0, preferences.onionAfter)] : [...Array.from({ length: preferences.onionBefore }, (_, n) => frame - n - 1), ...Array.from({ length: preferences.onionAfter }, (_, n) => frame + n + 1)].filter(f => f >= 0 && f < project.duration);
  const motionFrames = selected && preferences.showMotionPath ? Array.from({ length: Math.min(180, project.duration) }, (_, n) => Math.round(n / (Math.min(180, project.duration) - 1) * (project.duration - 1))) : [];
  const motion = motionFrames.map(f => { const node = sceneNodes(project, f).find(n => n.item.id === selectedId)!; return transformPoint(node.matrix, { x: 0, y: 0 }); });
  const rulerStep = [10, 20, 50, 100, 200, 500, 1000].find(v => v * scale >= 56) ?? 1000;
  const rulerTicks = (length: number, origin: number) => Array.from({ length: Math.min(100, Math.ceil(length / (rulerStep * scale)) + 2) }, (_, n) => { const value = Math.floor(-origin / scale / rulerStep) * rulerStep + n * rulerStep; return { value, at: origin + value * scale }; });
  const contextCommands = appCommands({ onOpen: () => {}, onSave: () => {}, onImport: () => {}, onImportAudio: () => {} }).filter(c => ['edit.undo', 'edit.redo', 'edit.duplicate', 'edit.delete', 'object.group', 'object.ungroup', 'object.front', 'object.back', 'animation.key', 'view.fit'].includes(c.id));
  return <section className={`stage-area tool-${tool} ${showRulers ? 'with-rulers' : ''}`} ref={containerRef} aria-label="Animation canvas" onContextMenu={e => {
      e.preventDefault(); if (useEditor.getState().busy || useEditor.getState().interacting) return;
      const id = (e.target as Element).closest('[data-item-id]')?.getAttribute('data-item-id'); if (id) { let item = project.items.find(i => i.id === id); if (!e.ctrlKey && !e.metaKey) while (item?.parentId) item = project.items.find(i => i.id === item!.parentId); if (item && !useEditor.getState().selectedIds.includes(item.id)) useEditor.getState().select(item.id); }
      const rect = e.currentTarget.getBoundingClientRect(); setContext({ x: Math.max(4, Math.min(e.clientX - rect.left, rect.width - 248)), y: Math.max(4, Math.min(e.clientY - rect.top, rect.height - 330)) });
    }}>
    <div className="stage-meta"><SceneSwitcher /><span className="artboard-dimensions">{project.width} × {project.height}</span></div>
    <div className="stage-tools"><div><button aria-label="Onion skin" title="Onion skin · U" aria-pressed={preferences.onionSkin} className={preferences.onionSkin ? 'active' : ''} onClick={() => useEditor.getState().setPreference('onionSkin', !preferences.onionSkin)}><Layers2 size={14} /><span>Onion skin</span></button><button aria-label="Motion path" title="Show motion path" aria-pressed={preferences.showMotionPath} className={preferences.showMotionPath ? 'active' : ''} onClick={() => useEditor.getState().setPreference('showMotionPath', !preferences.showMotionPath)}><Route size={14} /></button><button aria-label="Canvas grid" aria-pressed={preferences.showGrid} className={preferences.showGrid ? 'active' : ''} onClick={() => useEditor.getState().setPreference('showGrid', !preferences.showGrid)}><Grid3X3 size={13} /></button><button aria-label="Snap to grid" aria-pressed={preferences.snapToGrid} className={preferences.snapToGrid ? 'active' : ''} onClick={() => useEditor.getState().setPreference('snapToGrid', !preferences.snapToGrid)}><Magnet size={13} /></button><button aria-label="Animate camera" title="Camera · C" className={tool === 'camera' ? 'active' : ''} onClick={() => useEditor.getState().selectCamera()}><CameraIcon size={14} /></button></div>{isPaintTool(tool) && <div className="brush-options"><span className="paint-toolbar-name" title={activePresetName()}>{activePresetName()}</span><select aria-label="Drawing mode" disabled={project.animationMode === 'frame-by-frame'} value={preferences.drawingMode} onChange={e => useEditor.getState().setPreference('drawingMode', e.target.value as 'vector' | 'cel')}><option value="vector">Vector stroke</option><option value="cel">Frame-by-frame</option></select><input type="color" aria-label="Brush color" value={preferences.brushColor} onChange={e => useEditor.getState().setPreference('brushColor', e.target.value)} /><input type="number" aria-label="Brush size" min={1} max={256} value={preferences.brushSize} onChange={e => useEditor.getState().setPreference('brushSize', clamp(Number(e.target.value) || 1, 1, 256))} />{preferences.drawingMode === 'cel' && <><button aria-label={project.animationMode === 'frame-by-frame' ? 'Next blank drawing cel' : 'New blank cel'} title={project.animationMode === 'frame-by-frame' ? 'New blank frame · F7' : 'Blank cel · F7'} onClick={() => project.animationMode === 'frame-by-frame' ? useEditor.getState().nextDrawingFrame('blank') : useEditor.getState().blankCel()}><SquarePlus size={13} /></button><button aria-label={project.animationMode === 'frame-by-frame' ? 'Duplicate drawing to next frame' : 'Copy previous cel'} title={project.animationMode === 'frame-by-frame' ? 'Duplicate to next frame · F6' : 'Copy previous cel · F6'} onClick={() => project.animationMode === 'frame-by-frame' ? useEditor.getState().nextDrawingFrame('duplicate') : useEditor.getState().duplicateCel()}><Copy size={13} /></button></>}</div>}</div>
    {showRulers && <div className="stage-rulers" aria-label="Stage rulers" aria-hidden="true"><span className="ruler-origin" />
      <div className="ruler-horizontal">{rulerTicks(size.width, (size.width - project.width * scale) / 2 + pan.x).map(t => <span key={t.value} style={{ left: t.at }}>{t.value}</span>)}</div>
      <div className="ruler-vertical">{rulerTicks(size.height, size.height / 2 + 16 - project.height * scale / 2 + pan.y - 82).map(t => <span key={t.value} style={{ top: t.at }}>{t.value}</span>)}</div>
    </div>}
    <div className="stage-board" style={{ width: project.width * scale, height: project.height * scale, transform: `translate(${pan.x}px, ${pan.y}px)` }}><svg ref={svgRef} data-testid="stage" viewBox={`0 0 ${project.width} ${project.height}`} className="stage-svg" tabIndex={0} onKeyDown={e => {
      if (gesture.current?.kind === 'paint' && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); clearPaint(); return; }
      if (context && e.key === 'Escape') { e.preventDefault(); setContext(null); return; }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && useEditor.getState().selectedIds.length) { e.preventDefault(); e.stopPropagation(); const delta = e.shiftKey ? 10 : 1; useEditor.getState().nudgeSelected(e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0, e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0); }
    }} onPointerLeave={() => { if (!gesture.current) { if (cursorFrame.current !== null) cancelAnimationFrame(cursorFrame.current); cursorFrame.current = null; cursorPoint.current = null; setHover(null); useWorkspace.getState().setCursor(null); } }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={e => onUp(e)} onPointerCancel={e => onUp(e, true)} onLostPointerCapture={e => { if (gesture.current?.kind === 'paint') onUp(e, true); }} role="img" aria-label={`${project.name}, frame ${frame + 1}`}>
      <defs><pattern id="canvas-grid" width={preferences.gridSize} height={preferences.gridSize} patternUnits="userSpaceOnUse"><path d={`M${preferences.gridSize} 0H0V${preferences.gridSize}`} fill="none" stroke="#a0afa4" strokeWidth="0.6" opacity="0.3" /></pattern><filter id="onion-before"><feColorMatrix type="matrix" values="0 0 0 0 0.8 0 0 0 0 0.34 0 0 0 0 0.4 0 0 0 1 0" /></filter><filter id="onion-after"><feColorMatrix type="matrix" values="0 0 0 0 0.25 0 0 0 0 0.58 0 0 0 0 0.85 0 0 0 1 0" /></filter></defs>
      <rect width={project.width} height={project.height} fill={project.background} />
      <g ref={worldRef} transform={cameraTransform(project, frame)}>
        {preferences.showGrid && <rect x={-project.width * 2} y={-project.height * 2} width={project.width * 5} height={project.height * 5} fill="url(#canvas-grid)" pointerEvents="none" />}
        {preferences.onionSkin && !playing && ghostFrames.map(f => <g key={f} data-testid="onion-ghost" opacity={0.2 / Math.max(1, Math.abs(f - frame) ** 0.2)} filter={`url(#onion-${f < frame ? 'before' : 'after'})`} pointerEvents="none">{sceneNodes(project, f).filter(n => n.visible && ((project.keyframes[n.item.id]?.length ?? 0) > 0 || n.item.type === 'drawing')).map(n => <g key={n.item.id} data-item-id={n.item.id} transform={matrixString(n.matrix)} opacity={n.opacity}><ItemGraphic item={{ ...n.item, id: `${n.item.id}-ghost-${f}` }} frame={f} /></g>)}</g>)}
        {motion.length > 0 && !playing && <g pointerEvents="none" data-testid="motion-path"><path d={motion.map((p, n) => `${n ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} fill="none" stroke="#4c9aff" strokeWidth={1.4 / (scale * camera.zoom)} strokeDasharray="5 4" />{motion.filter((_, n) => n % 8 === 0).map((p, n) => <circle key={n} cx={p.x} cy={p.y} r={2 / (scale * camera.zoom)} fill="#6eafff" />)}</g>}
        {nodes.filter(n => n.visible).map(n => <g key={n.item.id} transform={matrixString(n.matrix)} opacity={n.opacity} style={n.item.blendMode && n.item.blendMode !== 'normal' ? { mixBlendMode: n.item.blendMode } : undefined} onPointerDown={event => onItemDown(event, n)} data-item-id={n.item.id} className={n.locked ? 'art-item locked' : 'art-item'}><ItemEffects item={n.item} /><g filter={effectFilter(n.item)}>{paintDraft && gesture.current?.paint?.tool === 'eraser' && gesture.current.paint.node?.item.id === n.item.id ? <CelPaint id={`${n.item.id}-preview-erase`} width={n.item.width} height={n.item.height} strokes={[...(sampleCel(n.item, frame)?.strokes ?? []), ...localPreview(n)]} /> : <ItemGraphic item={n.item} frame={frame} project={project} />}</g>{n.item.characterStyle === 'skeleton' && n.item.id !== selectedId && n.item.rig && <g opacity="0.3">{forwardKinematics(n.item.rig).map(b => <path key={b.id} d={`M${b.start.x} ${b.start.y}L${b.end.x} ${b.end.y}`} fill="none" stroke="#4c9aff" strokeWidth="6" strokeLinecap="round" />)}</g>}</g>)}
        {!playing && ['select', 'rig'].includes(tool) && nodes.filter(n => chosen.includes(n.item.id)).map(n => { const b = itemBounds(n.item); return <g key={n.item.id} transform={matrixString(n.matrix)} className="selection-overlay"><rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="#4c9aff" vectorEffect="non-scaling-stroke" strokeWidth="1" strokeDasharray="4 4" opacity="0.65" pointerEvents="none" />{n.item.id === selectedId && !n.locked && <>{[[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y], i) => <rect key={i} className="scale-handle" data-testid={`scale-handle-${i}`} x={x - 4 / (scale * camera.zoom * n.item.scaleX)} y={y - 4 / (scale * camera.zoom * n.item.scaleY)} width={8 / (scale * camera.zoom * n.item.scaleX)} height={8 / (scale * camera.zoom * n.item.scaleY)} fill="#fffdf7" stroke="#4c9aff" vectorEffect="non-scaling-stroke" onPointerDown={e => onHandleDown(e, 'scale', { x, y })} />)}<path d={`M0 ${b.y}V${b.y - 23 / (scale * camera.zoom * n.item.scaleY)}`} stroke="#4c9aff" vectorEffect="non-scaling-stroke" pointerEvents="none" /><circle data-testid="rotation-handle" className="rotation-handle" cx="0" cy={b.y - 23 / (scale * camera.zoom * n.item.scaleY)} r={4.5 / (scale * camera.zoom * n.item.scaleX)} fill="#fffdf7" stroke="#4c9aff" vectorEffect="non-scaling-stroke" onPointerDown={e => onHandleDown(e, 'rotate')} /></>}</g>; })}
        {selected?.item.rig && preferences.showBones && !playing && <g transform={matrixString(selected.matrix)} className="rig-overlay">{forwardKinematics(selected.item.rig).filter(b => !['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip', 'root'].includes(b.id)).map(b => <g key={b.id}><path d={`M${b.start.x} ${b.start.y}L${b.end.x} ${b.end.y}`} stroke={selectedBone === b.id ? '#1976e8' : '#4c9aff'} vectorEffect="non-scaling-stroke" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" pointerEvents="none" /><circle cx={b.end.x} cy={b.end.y} r={13 / (scale * camera.zoom * selected.item.scaleX)} fill="transparent" onPointerDown={event => onBoneDown(event, selected, b.id)} className="bone-hit" data-bone={b.id} aria-label={`Pose ${b.name}`} /><circle cx={b.end.x} cy={b.end.y} r={(selectedBone === b.id ? 5 : 3.8) / (scale * camera.zoom * selected.item.scaleX)} fill={b.locked ? '#a3aa9b' : selectedBone === b.id ? '#bfdeff' : '#fffdf7'} stroke="#3488f4" vectorEffect="non-scaling-stroke" strokeWidth="1.3" pointerEvents="none" /></g>)}</g>}
        {isPaintTool(tool) && symmetry !== 'none' && <g data-testid="paint-symmetry-guides" pointerEvents="none">{['vertical', 'both'].includes(symmetry) && <path className="paint-symmetry-guide" d={`M${project.width / 2} 0V${project.height}`} />}{['horizontal', 'both'].includes(symmetry) && <path className="paint-symmetry-guide" d={`M0 ${project.height / 2}H${project.width}`} />}</g>}
        {paintDraft && gesture.current?.paint?.tool !== 'eraser' && <g pointerEvents="none" transform={gesture.current?.paint?.node ? matrixString(gesture.current.paint.node.matrix) : undefined}>{(gesture.current?.paint?.node ? localPreview(gesture.current.paint.node) : previewWorld).map((stroke, index) => <PaintStroke key={index} id={`paint-draft-${index}`} stroke={stroke} />)}</g>}
        {cursorLocal && ['pen', 'eraser'].includes(tool) && !playing && <g transform={drawingCursor ? matrixString(drawingCursor.matrix) : undefined} pointerEvents="none" data-testid="paint-cursor">{[false, true].map(light => currentBrush.kind === 'pixel' ? <rect key={String(light)} className={`paint-brush-cursor ${light ? 'paint-brush-cursor-light' : ''}`} x={Math.floor(cursorLocal.x / currentBrush.pixelSize) * currentBrush.pixelSize - preferences.brushSize / 2} y={Math.floor(cursorLocal.y / currentBrush.pixelSize) * currentBrush.pixelSize - preferences.brushSize / 2} width={Math.max(currentBrush.pixelSize, preferences.brushSize)} height={Math.max(currentBrush.pixelSize, preferences.brushSize)} /> : <circle key={String(light)} className={`paint-brush-cursor ${light ? 'paint-brush-cursor-light' : ''}`} cx={cursorLocal.x} cy={cursorLocal.y} r={preferences.brushSize / 2} />)}</g>}
        {draft.length > 0 && <g pointerEvents="none">{tool === 'pen' ? <path d={draft.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} fill="none" stroke={preferences.brushColor} strokeWidth={preferences.brushSize} strokeLinecap="round" /> : first && last && (tool === 'ellipse' ? <ellipse cx={(first.x + last.x) / 2} cy={(first.y + last.y) / 2} rx={Math.abs(last.x - first.x) / 2} ry={Math.abs(last.y - first.y) / 2} fill={preferences.brushColor} opacity="0.75" /> : <rect x={Math.min(first.x, last.x)} y={Math.min(first.y, last.y)} width={Math.abs(last.x - first.x)} height={Math.abs(last.y - first.y)} rx="8" fill={preferences.brushColor} opacity="0.75" />)}</g>}
        {box && <rect x={Math.min(box.start.x, box.end.x)} y={Math.min(box.start.y, box.end.y)} width={Math.abs(box.end.x - box.start.x)} height={Math.abs(box.end.y - box.start.y)} fill="#4c9aff22" stroke="#4c9aff" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
      </g>
    </svg><div className="artboard-label">{project.sceneName} <span>{String(project.sceneOrder.indexOf(project.sceneId) + 1).padStart(2, '0')}</span></div></div>
    <div className="stage-bottom"><div className="stage-hint"><span>{tool === 'eraser' ? 'CEL ERASER' : tool === 'bucket' ? 'CEL FILL' : tool === 'eyedropper' ? 'COLOR SAMPLE' : tool === 'rig' ? 'FK / IK' : tool === 'pen' ? preferences.drawingMode === 'cel' ? 'CEL DRAWING' : 'VECTOR STROKE' : tool === 'hand' ? 'PAN VIEW' : tool === 'camera' ? 'SCENE CAMERA' : tool === 'text' ? 'TEXT' : 'SELECTION'} · {chosen.length} layer{chosen.length === 1 ? '' : 's'}</span></div><div className="zoom-controls"><button className="icon-button" aria-label="Zoom out" onClick={() => useEditor.getState().setZoom(zoom - 10)}><Minus size={14} /></button><button className="zoom-value" onClick={() => { useEditor.getState().setZoom(100); useEditor.getState().setPan({ x: 0, y: 0 }); }} title="Reset editor zoom (not camera)">{Math.round(zoom)}%</button><button className="icon-button" aria-label="Zoom in" onClick={() => useEditor.getState().setZoom(zoom + 10)}><Plus size={14} /></button><span className="zoom-divider" /><button className="icon-button" aria-label="Fit canvas" onClick={() => { useEditor.getState().setZoom(100); useEditor.getState().setPan({ x: 0, y: 0 }); }}><Expand size={14} /></button></div></div>{context && <div ref={contextRef} className="stage-context-menu" role="menu" aria-label="Stage context actions" style={{ left: context.x, top: context.y }} onKeyDown={e => { if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); setContext(null); svgRef.current?.focus(); return; } if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); const buttons = [...(contextRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])], at = buttons.indexOf(document.activeElement as HTMLButtonElement), index = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (at + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length; buttons[index]?.focus(); } }}>
      {contextCommands.map(command => <button role="menuitem" aria-label={command.label} key={command.id} disabled={command.enabled?.() === false} onClick={() => { setContext(null); svgRef.current?.focus(); void executeCommand(command); }}><command.icon size={13} /><span>{command.label}</span><kbd>{shortcutLabel(command.shortcut)}</kbd></button>)}
    </div>}
  </section>;
}
