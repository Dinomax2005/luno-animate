import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Expand, Minus, Plus, MousePointer2, MoveUpRight, Sparkles } from 'lucide-react';
import { useEditor } from '../store/editor';
import { sampleProject } from '../engine/animation';
import { createItem, createShape } from '../engine/project';
import { forwardKinematics, poseJoint, radians } from '../engine/rig';
import type { Point, Rig, SceneItem } from '../engine/types';
import { ItemGraphic, itemTransform } from './SceneGraphics';

interface Gesture {
  kind: 'move' | 'bone' | 'pan' | 'draw';
  start: Point;
  item?: SceneItem;
  boneId?: string;
  rig?: Rig;
  pan?: Point;
  checkpointed?: boolean;
}
export function Stage() {
  const project = useEditor(s => s.project);
  const frame = useEditor(s => s.frame);
  const selectedId = useEditor(s => s.selectedId);
  const selectedBone = useEditor(s => s.selectedBone);
  const playing = useEditor(s => s.playing);
  const tool = useEditor(s => s.tool);
  const zoom = useEditor(s => s.zoom);
  const pan = useEditor(s => s.pan);
  const preferences = useEditor(s => s.preferences);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [size, setSize] = useState({ width: 760, height: 530 });
  const [draft, setDraft] = useState<Point[]>([]);
  const items = sampleProject(project, frame);
  const selected = items.find(i => i.id === selectedId);
  const fit = Math.max(0.1, Math.min((size.width - 92) / project.width, (size.height - 112) / project.height));
  const scale = fit * zoom / 100;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => { const rect = entries[0].contentRect; setSize({ width: rect.width, height: rect.height }); });
    observer.observe(containerRef.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        useEditor.getState().setZoom(useEditor.getState().zoom * (event.deltaY > 0 ? 0.9 : 1.1));
      }
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);

  const point = (event: PointerEvent): Point => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: p.x, y: p.y };
  };
  const localPoint = (p: Point, item: SceneItem): Point => {
    const dx = p.x - item.x, dy = p.y - item.y;
    const r = radians(-item.rotation);
    return { x: (dx * Math.cos(r) - dy * Math.sin(r)) / item.scaleX, y: (dx * Math.sin(r) + dy * Math.cos(r)) / item.scaleY };
  };
  const capture = (event: PointerEvent) => { svgRef.current?.setPointerCapture(event.pointerId); event.preventDefault(); };
  const onItemDown = (event: PointerEvent, item: SceneItem) => {
    if (!['select', 'rig'].includes(tool) || event.button !== 0) return;
    event.stopPropagation();
    const s = useEditor.getState(); s.select(item.id); s.setPlaying(false);
    if (item.locked) { s.notify('This layer is locked. Unlock it in the Layers panel.', 'info'); return; }
    capture(event);
    gesture.current = { kind: 'move', start: point(event), item };
  };
  const onBoneDown = (event: PointerEvent, item: SceneItem, boneId: string) => {
    if (item.locked || playing) return;
    event.stopPropagation(); capture(event);
    const s = useEditor.getState(); s.selectBone(boneId);
    gesture.current = { kind: 'bone', start: point(event), item, boneId, rig: item.rig };
  };
  const onDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    capture(event); const s = useEditor.getState(); s.setPlaying(false);
    const p = point(event);
    if (tool === 'hand' || event.button === 1) {
      gesture.current = { kind: 'pan', start: { x: event.clientX, y: event.clientY }, pan };
    } else if (['pen', 'rectangle', 'ellipse'].includes(tool)) {
      gesture.current = { kind: 'draw', start: p }; setDraft([p, p]);
    } else { s.select(null); }
  };
  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current; if (!g) return;
    const s = useEditor.getState(); const p = point(event);
    if ((g.kind === 'move' || g.kind === 'bone') && !g.checkpointed) {
      if (Math.hypot(p.x - g.start.x, p.y - g.start.y) < 1) return;
      s.checkpoint(); g.checkpointed = true;
    }
    if (g.kind === 'move' && g.item) {
      s.editItem(g.item.id, { x: Math.round(g.item.x + p.x - g.start.x), y: Math.round(g.item.y + p.y - g.start.y) }, false);
    } else if (g.kind === 'bone' && g.item && g.rig && g.boneId) {
      const angles = poseJoint(g.rig, g.boneId, localPoint(p, g.item), !event.shiftKey);
      s.editBone(g.item.id, angles, false);
    } else if (g.kind === 'pan' && g.pan) {
      s.setPan({ x: g.pan.x + event.clientX - g.start.x, y: g.pan.y + event.clientY - g.start.y });
    } else if (g.kind === 'draw') {
      if (tool === 'pen') setDraft(previous => Math.hypot(p.x - previous.at(-1)!.x, p.y - previous.at(-1)!.y) > 3 ? [...previous, p] : previous);
      else setDraft([g.start, p]);
    }
  };
  const onUp = (event: PointerEvent<SVGSVGElement>) => {
    if (gesture.current?.kind === 'draw' && draft.length >= 2) {
      const xs = draft.map(p => p.x), ys = draft.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const w = Math.max(2, maxX - minX), h = Math.max(2, maxY - minY);
      if (w > 3 || h > 3) {
        const x = (minX + maxX) / 2, y = (minY + maxY) / 2;
        const item = tool === 'pen'
          ? createItem('path', { name: 'Drawing', x, y, width: w, height: h, points: draft.map(p => ({ x: p.x - x, y: p.y - y })), stroke: '#496853', strokeWidth: 5 })
          : { ...createShape(tool === 'ellipse' ? 'ellipse' : 'rectangle', x, y), width: w, height: h };
        useEditor.getState().addItem(item);
      }
    }
    gesture.current = null; setDraft([]);
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
  };
  const bounds = selected?.type === 'character' ? { x: -126, y: -152, w: 264, h: 370 } : { x: -(selected?.width ?? 0) / 2, y: -(selected?.height ?? 0) / 2, w: selected?.width ?? 0, h: selected?.height ?? 0 };
  const draftFirst = draft[0], draftLast = draft.at(-1);
  return <section className={`stage-area tool-${tool}`} ref={containerRef} aria-label="Animation canvas">
    <div className="stage-meta"><span className="scene-badge"><span className="green-dot" /> Scene 01 <span className="meta-divider" /> Main scene</span><span className="artboard-dimensions">{project.width} × {project.height}</span></div>
    <div className="stage-board" style={{ width: project.width * scale, height: project.height * scale, transform: `translate(${pan.x}px, ${pan.y}px)` }}>
      <svg ref={svgRef} data-testid="stage" viewBox={`0 0 ${project.width} ${project.height}`} className="stage-svg" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} role="img" aria-label={`${project.name}, frame ${frame + 1}`}>
        <defs><pattern id="canvas-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#a0afa4" strokeWidth="0.6" opacity="0.3" /></pattern></defs>
        <rect width={project.width} height={project.height} fill={project.background} />
        {preferences.showGrid && <rect width={project.width} height={project.height} fill="url(#canvas-grid)" pointerEvents="none" />}
        {items.map(item => <g key={item.id} transform={itemTransform(item)} opacity={item.opacity} onPointerDown={event => onItemDown(event, item)} className={item.locked ? 'art-item locked' : 'art-item'}><ItemGraphic item={item} /></g>)}
        {selected && !playing && <g transform={itemTransform(selected)} className="selection-overlay" pointerEvents="none">
          <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill="none" stroke="#6e9b75" strokeWidth={1 / scale} strokeDasharray={`${4 / scale} ${4 / scale}`} opacity="0.65" />
          {[[bounds.x, bounds.y], [bounds.x + bounds.w, bounds.y], [bounds.x, bounds.y + bounds.h], [bounds.x + bounds.w, bounds.y + bounds.h]].map(([x, y], i) => <rect key={i} x={x - 3 / scale} y={y - 3 / scale} width={6 / scale} height={6 / scale} fill="#fffdf7" stroke="#6e9b75" strokeWidth={1 / scale} />)}
        </g>}
        {selected?.rig && preferences.showBones && !playing && <g transform={itemTransform(selected)} className="rig-overlay">
          {forwardKinematics(selected.rig).filter(b => !['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip', 'root'].includes(b.id)).map(b => <g key={b.id}>
            <path d={`M${b.start.x} ${b.start.y}L${b.end.x} ${b.end.y}`} stroke={selectedBone === b.id ? '#337a46' : '#5a8a5e'} strokeWidth={1.8 / scale} strokeDasharray={`${3 / scale} ${3 / scale}`} opacity="0.7" pointerEvents="none" />
            <circle cx={b.end.x} cy={b.end.y} r={13 / scale} fill="transparent" onPointerDown={event => onBoneDown(event, selected, b.id)} className="bone-hit" data-bone={b.id} aria-label={`Pose ${b.name}`} />
            <circle cx={b.end.x} cy={b.end.y} r={(selectedBone === b.id ? 5 : 3.8) / scale} fill={selectedBone === b.id ? '#daf4a6' : '#fffdf7'} stroke="#4f8155" strokeWidth={1.5 / scale} pointerEvents="none" />
          </g>)}
        </g>}
        {draft.length > 0 && <g pointerEvents="none">
          {tool === 'pen' ? <path d={draft.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} fill="none" stroke="#496853" strokeWidth="5" strokeLinecap="round" /> : draftFirst && draftLast && (tool === 'ellipse' ? <ellipse cx={(draftFirst.x + draftLast.x) / 2} cy={(draftFirst.y + draftLast.y) / 2} rx={Math.abs(draftLast.x - draftFirst.x) / 2} ry={Math.abs(draftLast.y - draftFirst.y) / 2} fill="#f0b88e" opacity="0.75" /> : <rect x={Math.min(draftFirst.x, draftLast.x)} y={Math.min(draftFirst.y, draftLast.y)} width={Math.abs(draftLast.x - draftFirst.x)} height={Math.abs(draftLast.y - draftFirst.y)} rx="8" fill="#c5b1ed" opacity="0.75" />)}
        </g>}
      </svg>
      <div className="artboard-label">{project.name} <span>01</span></div>
    </div>
    {!project.items.length && <div className="empty-canvas"><Sparkles size={28} /><h3>A blank canvas. A fresh start.</h3><p>Draw something, import your art, or add a character.</p><button className="button primary" onClick={() => useEditor.getState().addCharacter()}>Add your first character <MoveUpRight size={15} /></button></div>}
    <div className="stage-bottom"><div className="stage-hint"><MousePointer2 size={13} /><span>{tool === 'rig' ? 'Drag a joint to pose · Shift for free rotation' : tool === 'pen' ? 'Click and drag to draw a stroke' : tool === 'hand' ? 'Drag to move around your canvas' : ['rectangle', 'ellipse'].includes(tool) ? 'Click and drag to draw a shape' : selected?.rig && preferences.showBones ? 'A little drag. A little magic. Try a joint.' : 'Select an object to make it your own'}</span></div><div className="zoom-controls"><button className="icon-button" aria-label="Zoom out" onClick={() => useEditor.getState().setZoom(zoom - 10)}><Minus size={14} /></button><button className="zoom-value" onClick={() => { useEditor.getState().setZoom(100); useEditor.getState().setPan({ x: 0, y: 0 }); }} title="Reset zoom">{Math.round(zoom)}%</button><button className="icon-button" aria-label="Zoom in" onClick={() => useEditor.getState().setZoom(zoom + 10)}><Plus size={14} /></button><span className="zoom-divider" /><button className="icon-button" aria-label="Fit canvas" onClick={() => { useEditor.getState().setZoom(100); useEditor.getState().setPan({ x: 0, y: 0 }); }}><Expand size={14} /></button></div></div>
    <div className="workspace-mark">YOUR IDEAS, IN MOTION.</div>
  </section>;
}
