import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Bone, ChevronDown, ChevronUp, CircleDot, DiamondPlus, Film, Pause, Play, Repeat2, SkipBack, SkipForward } from 'lucide-react';
import { useEditor } from '../store/editor';
import { clamp } from '../engine/rig';
import { LayerIcon } from './Library';

const timecode = (frame: number, fps: number) => `${String(Math.floor(frame / fps / 60)).padStart(2, '0')}:${String(Math.floor(frame / fps) % 60).padStart(2, '0')}:${String(frame % fps).padStart(2, '0')}`;
export function Timeline() {
  const project = useEditor(s => s.project);
  const frame = useEditor(s => s.frame);
  const playing = useEditor(s => s.playing);
  const selectedId = useEditor(s => s.selectedId);
  const preferences = useEditor(s => s.preferences);
  const [collapsed, setCollapsed] = useState(false);
  const [drag, setDrag] = useState<{ itemId: string; from: number; to: number } | null>(null);
  const dragRef = useRef<typeof drag>(null);
  const position = (value: number) => `${value / (project.duration - 1) * 100}%`;
  const frameAt = (event: PointerEvent, element: Element) => { const rect = element.getBoundingClientRect(); return clamp(Math.round((event.clientX - rect.left) / rect.width * (project.duration - 1)), 0, project.duration - 1); };
  const scrub = (event: PointerEvent) => { const s = useEditor.getState(); s.setPlaying(false); s.setFrame(frameAt(event, event.currentTarget)); };
  const nextKey = (direction: number) => {
    const keys = (selectedId ? project.keyframes[selectedId] ?? [] : Object.values(project.keyframes).flat()).map(k => k.frame).sort((a, b) => a - b);
    useEditor.getState().setPlaying(false);
    useEditor.getState().setFrame(direction > 0 ? keys.find(f => f > frame) ?? project.duration - 1 : keys.filter(f => f < frame).at(-1) ?? 0);
  };
  const tickCount = Math.min(9, Math.ceil(project.duration / 12) + 1);
  const ticks = Array.from({ length: tickCount }, (_, index) => Math.round(index / (tickCount - 1) * (project.duration - 1)));
  return <section className={`timeline ${collapsed ? 'collapsed' : ''}`} aria-label="Animation timeline">
    <div className="timeline-toolbar"><div className="timeline-title"><button className="icon-button small" aria-label={collapsed ? 'Expand timeline' : 'Collapse timeline'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button><Film size={15} /><strong>Timeline</strong><span className="scene-number">01</span><span className="timeline-duration" onClick={() => useEditor.getState().setDialog('settings')} title="Project duration">{(project.duration / project.fps).toFixed(1)}s</span></div>
      <div className="playback-controls"><button className="icon-button" aria-label="Previous keyframe" onClick={() => nextKey(-1)}><SkipBack size={14} /></button><button className={`play-button ${playing ? 'playing' : ''}`} aria-label={playing ? 'Pause animation' : 'Play animation'} onClick={() => useEditor.getState().setPlaying(!playing)}>{playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button><button className="icon-button" aria-label="Next keyframe" onClick={() => nextKey(1)}><SkipForward size={14} /></button><span className="timecode">{timecode(frame, project.fps)}</span><span className="control-divider" /><button className={`icon-button loop-button ${preferences.loop ? 'active' : ''}`} aria-label="Loop playback" aria-pressed={preferences.loop} onClick={() => useEditor.getState().setPreference('loop', !preferences.loop)}><Repeat2 size={16} /></button></div>
      <div className="timeline-actions"><button className={`auto-key-button ${preferences.autoKey ? 'active' : ''}`} aria-label="Automatic keyframes" aria-pressed={preferences.autoKey} title={preferences.autoKey ? 'Pose changes automatically create keyframes on animated layers' : 'Rest-pose mode: edits change the base object; existing keys are unchanged'} onClick={() => { useEditor.getState().setPreference('autoKey', !preferences.autoKey); if (preferences.autoKey) useEditor.getState().notify('Rest-pose mode. Existing animation keys stay unchanged.', 'info'); }}><CircleDot size={13} /><span>Auto-key</span></button><button className="button keyframe-button" onClick={() => useEditor.getState().addKeyframe()}><DiamondPlus size={14} /> Add keyframe <kbd>K</kbd></button><select className="fps-select" aria-label="Frame rate" value={project.fps} onChange={e => useEditor.getState().resizeProject({ fps: Number(e.target.value) })}>{[12, 15, 24, 25, 30, 60].map(fps => <option key={fps} value={fps}>{fps} fps</option>)}{![12, 15, 24, 25, 30, 60].includes(project.fps) && <option value={project.fps}>{project.fps} fps</option>}</select></div>
    </div>
    {!collapsed && <div className="timeline-scroll"><div className="timeline-ruler-row"><div className="timeline-layer-heading"><span>OBJECTS</span><span>{project.items.length} layers</span></div><div className="timeline-ruler" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); scrub(e); }} onPointerMove={e => { if (e.buttons === 1) scrub(e); }} onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }} role="slider" aria-label="Timeline playhead" aria-valuemin={1} aria-valuemax={project.duration} aria-valuenow={frame + 1} tabIndex={0} onKeyDown={e => { if (e.key === 'ArrowLeft') { e.stopPropagation(); useEditor.getState().setFrame(frame - 1); } if (e.key === 'ArrowRight') { e.stopPropagation(); useEditor.getState().setFrame(frame + 1); } }}>{ticks.map(tick => <span className="timeline-tick" key={tick} style={{ left: position(tick) }}><span>{String(tick + 1).padStart(2, '0')}</span></span>)}<span className="playhead-handle" style={{ left: position(frame) }} /></div></div>
      <div className="timeline-rows">{[...project.items].reverse().map(item => {
        const keys = project.keyframes[item.id] ?? [];
        return <div className={`timeline-row ${selectedId === item.id ? 'selected' : ''} ${!item.visible ? 'muted' : ''}`} key={item.id}><button className="timeline-layer-label" onClick={() => useEditor.getState().select(item.id)}><LayerIcon item={item} size={13} /><span>{item.name}</span>{item.type === 'character' && <span className="timeline-rig-label"><Bone size={10} /> RIG</span>}</button><div className="timeline-track" onPointerDown={e => { useEditor.getState().select(item.id); e.currentTarget.setPointerCapture(e.pointerId); scrub(e); }} onPointerMove={e => { if (e.buttons === 1 && !dragRef.current) scrub(e); }} onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}>
          {keys.length > 0 ? <div className={`animation-clip ${item.type === 'character' ? 'character-clip' : 'shape-clip'}`} style={{ left: position(keys[0].frame), width: `${(keys.at(-1)!.frame - keys[0].frame) / (project.duration - 1) * 100}%` }}><span>{item.type === 'character' ? 'Pose animation' : 'Transform animation'}</span></div> : <div className="static-clip"><span>Static</span></div>}
          {keys.map(key => <button key={key.id} aria-label={`${item.name} keyframe ${key.frame + 1}`} title={`Frame ${key.frame + 1} · drag to move · double-click to remove`} className={`timeline-key ${key.frame === frame ? 'current' : ''}`} style={{ left: position(drag?.itemId === item.id && drag.from === key.frame ? drag.to : key.frame) }} onClick={e => e.stopPropagation()} onDoubleClick={e => { e.stopPropagation(); useEditor.getState().removeKeyframe(item.id, key.frame); }} onPointerDown={e => {
            e.stopPropagation(); if (item.locked) return;
            e.currentTarget.setPointerCapture(e.pointerId); useEditor.getState().select(item.id); useEditor.getState().setPlaying(false); useEditor.getState().setFrame(key.frame);
            const value = { itemId: item.id, from: key.frame, to: key.frame }; dragRef.current = value; setDrag(value);
          }} onPointerMove={e => {
            e.stopPropagation(); if (!dragRef.current) return;
            const next = { ...dragRef.current, to: frameAt(e, e.currentTarget.parentElement!) }; dragRef.current = next; setDrag(next);
          }} onPointerUp={e => {
            e.stopPropagation(); const value = dragRef.current;
            if (value) { useEditor.getState().moveKeyframe(value.itemId, value.from, value.to); useEditor.getState().setFrame(value.to); }
            dragRef.current = null; setDrag(null); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          }} onPointerCancel={() => { dragRef.current = null; setDrag(null); }} />)}
        </div></div>;
      })}<div className="timeline-playhead-area"><div className="timeline-playhead" style={{ left: position(frame) }} /></div></div>
      {!project.items.length && <div className="timeline-empty">Your animation’s story will unfold here.</div>}
    </div>}
    <div className="timeline-footer"><span><span className="green-dot" /> {playing ? 'Making a little magic' : 'Ready when you are'}</span><span className="timeline-tip">Space to play <span>·</span> K for a keyframe <span>·</span> Drag diamonds to move them</span><span>Frame <strong>{String(frame + 1).padStart(3, '0')}</strong> <span className="muted-text">/ {String(project.duration).padStart(3, '0')}</span></span></div>
  </section>;
}
