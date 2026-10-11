import { useRef, useState, type PointerEvent } from 'react';
import { clipRange, type ClipEdit } from '../engine/clips';
import { isLayerLocked } from '../engine/geometry';
import { useEditor } from '../store/editor';
import type { Project, SceneItem } from '../engine/types';
export function MotionClip({ item, project }: { item: SceneItem; project: Project }) {
  const range = clipRange(item, project.duration), [preview, setPreview] = useState<typeof range | null>(null);
  const drag = useRef<{ kind: ClipEdit; pointer: number; at: number } | null>(null), locked = isLayerLocked(project.items, item.id);
  const position = (n: number) => n / (project.duration - 1) * 100;
  const visible = preview ?? range;
  const frameAt = (e: PointerEvent) => { const r = e.currentTarget.closest('.timeline-track')!.getBoundingClientRect(); return Math.round((e.clientX - r.left) / r.width * (project.duration - 1)); };
  const start = (e: PointerEvent<HTMLButtonElement>, kind: ClipEdit) => { e.stopPropagation(); if (locked || item.type === 'group') return; e.currentTarget.setPointerCapture(e.pointerId); const s = useEditor.getState(); s.select(item.id); s.setPlaying(false); s.setInteracting(true); drag.current = { kind, pointer: frameAt(e), at: range.start }; };
  const finish = (e: PointerEvent<HTMLButtonElement>, commit: boolean) => { const current = drag.current; drag.current = null; setPreview(null); useEditor.getState().setInteracting(false); if (commit && current) useEditor.getState().editClip(item.id, current.kind, current.at); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); };
  const update = (e: PointerEvent) => { e.stopPropagation(); const current = drag.current; if (!current) return; const at = frameAt(e); if (current.kind === 'move') { const delta = Math.max(-range.start, Math.min(1800 - range.end, at - current.pointer)); current.at = range.start + delta; setPreview({ start: current.at, end: range.end + delta }); } else if (current.kind === 'trim-in') { current.at = Math.max(range.start, Math.min(range.end - 1, at)); setPreview({ start: current.at, end: range.end }); } else { current.at = Math.max(range.start, Math.min(range.end - 1, at)); setPreview({ start: range.start, end: current.at + 1 }); } };
  const bindings = { onPointerMove: update, onPointerUp: (e: PointerEvent<HTMLButtonElement>) => finish(e, true), onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => finish(e, false), onLostPointerCapture: (e: PointerEvent<HTMLButtonElement>) => { if (drag.current) finish(e, false); } };
  const asset = project.media.find(m => m.id === item.videoAssetId);
  return <div className={`motion-clip ${item.type} ${drag.current ? 'dragging' : ''}`} style={{ left: `${position(visible.start)}%`, width: `${Math.max(0.2, Math.min(100 - position(visible.start), position(visible.end - visible.start)))}%` }}>
    <button className="clip-edge left" disabled={locked || item.type === 'group'} aria-label={`Trim start of ${item.name}`} onPointerDown={e => start(e, 'trim-in')} {...bindings} />
    <button className="clip-body" disabled={locked || item.type === 'group'} aria-label={`Move ${item.name} clip`} title="Drag to move the clip; edges trim it. Use Timing to split and add fades." onClick={e => { e.stopPropagation(); useEditor.getState().select(item.id); }} onPointerDown={e => start(e, 'move')} {...bindings}>
      {asset && <span className="clip-thumbnails" aria-hidden="true">{[0, 0.5, 0.95].map((t, n) => <img key={n} src={asset.frames[Math.min(asset.frames.length - 1, Math.floor(((item.sourceStart ?? 0) + t * (range.end - range.start) / project.fps) * asset.fps))]} alt="" />)}</span>}<span>{item.type === 'video' ? item.name : item.type === 'character' ? 'Pose & motion' : item.name}</span>
    </button><button className="clip-edge right" disabled={locked || item.type === 'group'} aria-label={`Trim end of ${item.name}`} onPointerDown={e => start(e, 'trim-out')} {...bindings} />
  </div>;
}
