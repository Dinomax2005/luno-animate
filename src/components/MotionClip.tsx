import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { clipRange, snapClipEdit, type DragClipEdit } from '../engine/clips';
import { isLayerLocked } from '../engine/geometry';
import { useEditor } from '../store/editor';
import { useWorkspace } from '../store/workspace';
import type { Project, SceneItem } from '../engine/types';
export function MotionClip({ item, project }: { item: SceneItem; project: Project }) {
  const range = clipRange(item, project.duration), [preview, setPreview] = useState<ReturnType<typeof snapClipEdit> | null>(null);
  const drag = useRef<{ kind: DragClipEdit; pointer: number; initial: number; at: number } | null>(null);
  const snapEnabled = useWorkspace(s => s.timelineSnap), locked = isLayerLocked(project.items, item.id);
  const position = (n: number) => n / (project.duration - 1) * 100, visible = preview?.range ?? range;
  const frameAt = (e: PointerEvent) => { const r = e.currentTarget.closest('.timeline-track')!.getBoundingClientRect(); return (e.clientX - r.left) / r.width * (project.duration - 1); };
  useEffect(() => () => { if (drag.current) useEditor.getState().setInteracting(false); }, []);
  const start = (e: PointerEvent<HTMLButtonElement>, kind: DragClipEdit) => {
    e.stopPropagation(); const s = useEditor.getState();
    if (e.button !== 0 || locked || item.type === 'group' || s.busy || s.blockReason) return;
    e.currentTarget.setPointerCapture(e.pointerId); s.select(item.id); s.setPlaying(false); s.setInteracting(true);
    // A click on either handle is a no-op, not an accidental one-frame trim.
    const initial = kind === 'trim-out' ? range.end - 1 : range.start;
    drag.current = { kind, pointer: frameAt(e), initial, at: initial };
    setPreview({ at: initial, range, snap: null });
  };
  const finish = (e: PointerEvent<HTMLButtonElement>, commit: boolean) => {
    const current = drag.current; drag.current = null; setPreview(null); useEditor.getState().setInteracting(false);
    if (commit && current && current.at !== current.initial) useEditor.getState().editClip(item.id, current.kind, current.at);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const update = (e: PointerEvent) => {
    e.stopPropagation(); const current = drag.current; if (!current) return;
    const r = e.currentTarget.closest('.timeline-track')!.getBoundingClientRect();
    const tolerance = snapEnabled && !e.altKey ? Math.min(8, 7 / Math.max(1, r.width / (project.duration - 1))) : 0;
    const delta = frameAt(e) - current.pointer;
    if (Math.abs(delta) < 0.001) { current.at = current.initial; setPreview({ at: current.initial, range, snap: null }); return; }
    const result = snapClipEdit(project, item, current.kind, current.initial + delta, useEditor.getState().frame, tolerance);
    current.at = result.at; setPreview(result);
  };
  const keyboard = (e: import('react').KeyboardEvent, kind: DragClipEdit) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.stopPropagation(); e.preventDefault();
    const s = useEditor.getState(); if (locked || s.busy || s.blockReason) return; s.select(item.id); s.setPlaying(false);
    s.editClip(item.id, kind, (kind === 'trim-out' ? range.end - 1 : range.start) + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1));
  };
  const bindings = { onPointerMove: update, onPointerUp: (e: PointerEvent<HTMLButtonElement>) => finish(e, true), onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => finish(e, false), onLostPointerCapture: (e: PointerEvent<HTMLButtonElement>) => { if (drag.current) finish(e, false); } };
  const asset = project.media.find(m => m.id === item.videoAssetId), sourceStart = (item.sourceStart ?? 0) + (drag.current?.kind === 'trim-in' ? (visible.start - range.start) / project.fps : 0);
  return <><div className={`motion-clip ${item.type} ${drag.current ? 'dragging' : ''}`} style={{ left: `${position(visible.start)}%`, width: `${Math.max(0.2, Math.min(100 - position(visible.start), position(visible.end - visible.start)))}%` }}>
    <button className="clip-edge left" disabled={locked || item.type === 'group'} aria-label={`Trim start of ${item.name}`} title="Drag to trim or restore source handles · Alt bypasses snapping" onKeyDown={e => keyboard(e, 'trim-in')} onPointerDown={e => start(e, 'trim-in')} {...bindings} />
    <button className="clip-body" disabled={locked || item.type === 'group'} aria-label={`Move ${item.name} clip`} title="Drag to move · Edges trim or restore · Alt bypasses snapping · Ctrl/⌘ Shift D splits" onClick={e => { e.stopPropagation(); useEditor.getState().select(item.id); }} onKeyDown={e => keyboard(e, 'move')} onPointerDown={e => start(e, 'move')} {...bindings}>
      {asset && <span className="clip-thumbnails" aria-hidden="true">{[0, .5, .95].map((t, n) => <img key={n} src={asset.frames[Math.max(0, Math.min(asset.frames.length - 1, Math.floor((sourceStart + t * (visible.end - visible.start) / project.fps) * asset.fps)))]} alt="" />)}</span>}<span>{item.type === 'character' ? 'Pose & motion' : item.name}</span>
    </button><button className="clip-edge right" disabled={locked || item.type === 'group'} aria-label={`Trim end of ${item.name}`} title="Drag to trim or restore source handles · Alt bypasses snapping" onKeyDown={e => keyboard(e, 'trim-out')} onPointerDown={e => start(e, 'trim-out')} {...bindings} />
  </div>{preview?.snap && <div className={`timeline-snap-guide ${preview.snap.frame > project.duration * .75 ? 'near-end' : ''}`} style={{ left: `${Math.min(100, position(preview.snap.frame))}%` }}><span role="status">{preview.snap.label} · {String(preview.snap.frame + 1).padStart(3, '0')}</span></div>}</>;
}
