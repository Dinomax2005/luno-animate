import { useState } from 'react';
import { ArrowUpRight, Bone, Brush, ChevronRight, Clock3, File, FolderOpen, Plus, Save } from 'lucide-react';
import { APP_VERSION } from '../config/version';
import { whatsNew } from '../config/whats-new';
import { useEditor } from '../store/editor';
import { useLaunch } from '../services/launch';
import { openLibraryProject } from '../services/library';
import type { AnimationMode } from '../engine/types';
import { Modal } from './Modal';

export function AnimationTypePicker({ value, onChange, disabled = false }: { value: AnimationMode; onChange: (value: AnimationMode) => void; disabled?: boolean }) {
  return <div className="animation-type-picker" role="group" aria-label="Animation type">
    <button type="button" disabled={disabled} aria-pressed={value === 'frame-by-frame'} onClick={() => onChange('frame-by-frame')}><Brush size={19} /><span><strong>Hand-drawn</strong><small>Individual cels · manual frames</small></span><span className="type-radio" /></button>
    <button type="button" disabled={disabled} aria-pressed={value === 'rigged'} onClick={() => onChange('rigged')}><Bone size={19} /><span><strong>Rig / motion</strong><small>Drag · pose · keyframe animation</small></span><span className="type-radio" /></button>
  </div>;
}
export function StartDialog({ onOpen }: { onOpen: () => void | Promise<void> }) {
  const projects = useEditor(s => s.projects), busy = useEditor(s => s.busy || !!s.blockReason), showStart = useLaunch(s => s.showStart);
  const [opening, setOpening] = useState<string | null>(null), [error, setError] = useState('');
  const recent = projects.filter(p => !p.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const close = () => { if (!busy && !opening) useEditor.getState().setDialog(null); };
  const create = (mode?: AnimationMode) => { if (mode) useLaunch.getState().setNewMode(mode); useEditor.getState().setDialog('new'); };
  const openRecent = async (id: string) => {
    setOpening(id); setError('');
    try { await openLibraryProject(id); useEditor.getState().setDialog(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open this recent document.'); }
    finally { setOpening(null); }
  };
  return <Modal title="Luno Animate — Start" onClose={close} className="start-modal">
    <aside className="start-sidebar"><span className="start-brand">Lu</span><strong>Luno Animate</strong><span className="start-version">VERSION {APP_VERSION}</span><div className="start-nav-current"><Clock3 size={14} /> Recent</div><button className="button primary" disabled={busy || !!opening} onClick={() => create()}><Plus size={14} /> New document</button><button className="button secondary" disabled={busy || !!opening} onClick={() => void onOpen()}><FolderOpen size={14} /> Open…</button><div className="start-sidebar-bottom"><span>LOCAL WORKSPACE</span><small>Your library stays on this device.</small><button className="text-link" disabled={busy || !!opening} onClick={() => useLaunch.getState().openNews()}>What’s New <ArrowUpRight size={12} /></button></div></aside>
    <div className="start-main"><div className="start-heading"><span className="eyebrow">DOCUMENT WORKSPACE</span><h1>Start a document</h1><p>Choose an animation type or continue a recent project.</p></div>
      <div className="start-type-cards">
        <button disabled={busy || !!opening} onClick={() => create('frame-by-frame')}><div className="start-type-preview drawn" aria-hidden="true"><svg viewBox="0 0 230 85"><path className="draw-ghost" d="M67 64C43 56 45 22 66 17c28-6 47 5 48 22s-24 35-44 23m-8-3 65-36 24 42" /><path d="M88 62C64 53 65 20 89 16c27-5 44 7 43 24s-23 33-43 22m-3-5 58-31 27 41" /><path className="draw-detail" d="m91 26 23 15-19 8m51-4 13 17" /></svg><span>01 / DRAW</span></div><div className="start-type-label"><Brush size={17} /><span><strong>Hand-drawn</strong><small>Frame-by-frame drawing</small></span><ChevronRight size={16} /></div></button>
        <button disabled={busy || !!opening} onClick={() => create('rigged')}><div className="start-type-preview rigged" aria-hidden="true"><svg viewBox="0 0 230 85"><path d="m120 22-1 27m0-11-26 3-18-17m44 13 23 8 23-16m-46 21-24 18m24-18 27 20" /><circle cx="120" cy="17" r="9" />{[[120, 37], [119, 49], [93, 41], [142, 45], [95, 68], [146, 69]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.6" className="rig-joint" />)}<path className="rig-path" d="M33 68c21-44 46-44 69-3s58 33 89-38" /></svg><span>02 / ANIMATE</span></div><div className="start-type-label"><Bone size={17} /><span><strong>Rig / motion</strong><small>Vectors, poses & keyframes</small></span><ChevronRight size={16} /></div></button>
      </div>
      <div className="start-recent-heading"><h2>Recent documents</h2><span>PROJECT LIBRARY</span></div>
      {recent.length ? <div className="start-recent-list">{recent.map(p => <button key={p.id} disabled={busy || !!opening} onClick={() => void openRecent(p.id)} aria-label={`Open recent ${p.name}`}><span className="start-recent-icon"><File size={18} /></span><span className="start-recent-name"><strong>{p.name}</strong><small>{p.width} × {p.height} · {p.fps} fps · {p.kind}</small></span><time dateTime={new Date(p.updatedAt).toISOString()}>{opening === p.id ? 'Opening…' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(p.updatedAt)}</time><ChevronRight size={13} /></button>)}</div> : <div className="start-recent-empty"><File size={20} /><span>No recent documents.<small>New and opened documents will appear here.</small></span></div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="start-footer"><label className="checkbox-label"><input type="checkbox" checked={showStart} onChange={e => useLaunch.getState().setShowStart(e.target.checked)} /><span>Show this window at startup</span></label><button className="text-link" disabled={busy || !!opening} onClick={close}>All projects <ChevronRight size={12} /></button></div>
    </div>
  </Modal>;
}
export function WhatsNewDialog() {
  const close = () => useLaunch.getState().acknowledgeNews();
  const icons = [Save, Brush, Bone, FolderOpen];
  return <Modal title="What’s New" onClose={close} className="whats-new-modal"><div className="news-titlebar"><span className="start-brand">Lu</span><span>LUNO ANIMATE <small>RELEASE NOTES</small></span><span className="news-version">{whatsNew.version}</span></div><div className="dialog-heading"><span className="eyebrow">WHAT’S NEW</span><h1>{whatsNew.title}</h1></div><div className="news-changes">{whatsNew.changes.map((change, i) => { const Icon = icons[i]; return <section key={change.title}><span className="news-feature-icon"><Icon size={18} /></span><div><h2>{change.title}</h2><p>{change.text}</p></div></section>; })}</div><p className="news-note">{whatsNew.note}</p><div className="dialog-footer"><span className="muted-text">Shown once for each version.</span><button className="button primary" onClick={close}>Continue <ChevronRight size={14} /></button></div></Modal>;
}
