import { Diamond, Scissors, SlidersHorizontal, Sparkles, Timer, WandSparkles } from 'lucide-react';
import { clipRange, clipTrimBounds } from '../engine/clips';
import { useEditor } from '../store/editor';
import type { MotionProperty, SceneItem } from '../engine/types';
import { NumberField } from './NumberField';

const propertyNames: Record<MotionProperty, string> = { x: 'X', y: 'Y', scaleX: 'Scale X', scaleY: 'Scale Y', rotation: 'Rotation', opacity: 'Opacity', blur: 'Blur', brightness: 'Brightness', saturation: 'Saturation' };
export function PropertyKeys({ item, effects = false }: { item: SceneItem; effects?: boolean }) {
  const frame = useEditor(s => s.frame), allKeys = useEditor(s => s.project.keyframes);
  const keys = allKeys[item.id] ?? [];
  const properties: MotionProperty[] = effects ? ['blur', 'brightness', 'saturation'] : ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity'];
  return <div className="property-key-controls" role="group" aria-label="Property keyframes">{properties.map(property => {
    const keyed = keys.some(k => k.frame === frame && k.values[property] !== undefined), animated = keys.some(k => k.values[property] !== undefined);
    return <button key={property} className={`${keyed ? 'keyed' : ''} ${animated ? 'animated' : ''}`} disabled={item.locked || effects && item.type === 'group'} title={`${keyed ? 'Remove' : 'Add'} ${propertyNames[property]} keyframe at frame ${frame + 1}`} aria-label={`${keyed ? 'Remove' : 'Add'} ${propertyNames[property]} keyframe`} aria-pressed={keyed} onClick={() => useEditor.getState().keyProperty(property)}><Diamond size={11} fill={keyed ? 'currentColor' : 'none'} /><span>{propertyNames[property]}</span></button>;
  })}</div>;
}
export function MotionEffects({ item }: { item: SceneItem }) {
  const edit = (p: MotionProperty, value: number) => useEditor.getState().editMotionProperty(p, value);
  return <div className="motion-detail-panel"><section className="inspector-section"><div className="section-heading"><span><Sparkles size={13} /> EFFECTS & COLOR</span></div><p className="inspector-note">Effects are rendered on the canvas and in exports. Use diamonds to animate each effect independently.</p><PropertyKeys item={item} effects />
    <div className="effect-control"><span><SlidersHorizontal size={15} /> Gaussian blur</span><NumberField label="Blur" value={item.blur ?? 0} min={0} max={50} unit="px" disabled={item.locked || item.type === 'group'} onChange={v => edit('blur', v)} /></div>
    <div className="effect-control"><span><WandSparkles size={15} /> Brightness</span><NumberField label="Brightness" value={(item.brightness ?? 1) * 100} min={0} max={300} unit="%" disabled={item.locked || item.type === 'group'} onChange={v => edit('brightness', v / 100)} /></div>
    <div className="effect-control"><span><Sparkles size={15} /> Saturation</span><NumberField label="Saturation" value={(item.saturation ?? 1) * 100} min={0} max={300} unit="%" disabled={item.locked || item.type === 'group'} onChange={v => edit('saturation', v / 100)} /></div>
    {item.type === 'group' && <p className="inspector-note">Apply effects to the group’s artwork layers. Group transforms remain available; edit child layers for timing.</p>}
    <div className="effect-presets"><button disabled={item.locked || item.type === 'group'} onClick={() => edit('saturation', 0)}>Monochrome</button><button disabled={item.locked || item.type === 'group'} onClick={() => { useEditor.getState().checkpoint(); useEditor.getState().editMotionProperty('blur', 0, false); useEditor.getState().editMotionProperty('brightness', 1, false); useEditor.getState().editMotionProperty('saturation', 1, false); }} title="Reset effect values at the playhead">Reset effects</button></div>
  </section></div>;
}
export function MotionTiming({ item }: { item: SceneItem }) {
  const project = useEditor(s => s.project), frame = useEditor(s => s.frame), { start, end } = clipRange(item, project.duration);
  const bounds = clipTrimBounds(project, item);
  const blocked = item.locked || item.type === 'group', split = !blocked && frame > start && frame < end;
  const edit = (kind: 'trim-in' | 'trim-out' | 'move' | 'split', at = frame) => useEditor.getState().editClip(item.id, kind, at);
  const asset = project.media.find(m => m.id === item.videoAssetId);
  return <div className="motion-detail-panel"><section className="inspector-section"><div className="section-heading"><span><Timer size={13} /> CLIP TIMING</span><span>{((end - start) / project.fps).toFixed(2)}s</span></div><div className="clip-range-summary"><span>IN <strong>{String(start + 1).padStart(3, '0')}</strong></span><span>OUT <strong>{String(end).padStart(3, '0')}</strong></span></div><NumberField label="Clip start" value={start + 1} min={1} max={project.duration} disabled={blocked} onChange={v => edit('move', v - 1)} /><div className="field-grid clip-trim-fields"><NumberField label="Clip in" value={start + 1} min={bounds.minStart + 1} max={end} disabled={blocked} onChange={v => edit('trim-in', v - 1)} /><NumberField label="Clip out" value={end} min={start + 1} max={bounds.maxEnd} disabled={blocked} onChange={v => edit('trim-out', v - 1)} /></div><div className="clip-edit-actions"><button className="button secondary" disabled={blocked || frame < bounds.minStart || frame >= end || frame === start} onClick={() => edit('trim-in')}>Trim start to playhead</button><button className="button secondary" disabled={blocked || frame < start || frame >= bounds.maxEnd || frame === end - 1} onClick={() => edit('trim-out')}>Trim end to playhead</button><button className="button secondary" disabled={!split} onClick={() => edit('split')}><Scissors size={13} /> Split at playhead</button></div><p className="inspector-note">Drag a clip to move it; drag its edges to trim or restore available source footage. Snaps align to the playhead and other clips; hold Alt to bypass. Ctrl/⌘ Shift D splits. Trim and split keep the original source; Undo restores the complete edit.</p>
    {asset && <div className="media-information"><span>EMBEDDED VIDEO PROXY</span><strong>{asset.name}</strong><p>{asset.width} × {asset.height} · {asset.fps} fps · {(asset.frames.length / asset.fps).toFixed(2)}s</p><p>Source in: {(item.sourceStart ?? 0).toFixed(2)}s. {item.linkedAudioId ? 'Linked sound follows trim, split, and move.' : 'No linked sound. Independently moved/trimmed sound is unlinked.'}</p></div>}
  </section><section className="inspector-section"><div className="section-heading"><span>OPACITY TRANSITIONS</span></div><div className="clip-transition-actions"><button disabled={blocked || end - start < 2} onClick={() => useEditor.getState().fadeClip(item.id, 'in')}><span>↗</span> Fade in</button><button disabled={blocked || end - start < 2} onClick={() => useEditor.getState().fadeClip(item.id, 'out')}><span>↘</span> Fade out</button></div><p className="inspector-note">Adds a half-second opacity transition, preserving other animated properties.</p></section></div>;
}
