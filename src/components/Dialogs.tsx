import { useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Bone, Check, ChevronRight, Code2, Download, FileJson, Film, FolderOpen, Heart, Image, Laptop, LockKeyhole, Monitor, MousePointer2, Play, Plus, Save, Settings2, ShieldCheck, Sparkles, SquarePen } from 'lucide-react';
import { useEditor } from '../store/editor';
import { createPreset } from '../engine/animation';
import { adaptCanvas, createProject } from '../engine/project';
import { saveExport, saveProject } from '../engine/files';
import { SceneArtwork } from './SceneGraphics';
import { Modal } from './Modal';
import { SetupWizard } from './SetupWizard';
import desktopBuild from '../config/desktop-build.json';
import thirdPartyNotices from '../config/third-party-notices.txt?raw';

const close = () => useEditor.getState().setDialog(null);
export function Dialogs() {
  const dialog = useEditor(s => s.dialog);
  if (dialog === 'setup') return <SetupWizard />;
  if (dialog === 'export') return <ExportDialog />;
  if (dialog === 'new') return <NewProjectDialog />;
  if (dialog === 'settings') return <SettingsDialog />;
  if (dialog === 'help') return <HelpDialog />;
  if (dialog === 'download') return <DownloadDialog />;
  return null;
}
function ExportDialog() {
  const project = useEditor(s => s.project);
  const frame = useEditor(s => s.frame);
  const [format, setFormat] = useState<'gif' | 'png' | 'svg' | 'luno'>('gif');
  const [scale, setScale] = useState(1);
  const [transparent, setTransparent] = useState(false);
  const [name, setName] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const requestClose = () => { if (busy) abort.current?.abort(); else close(); };
  const runExport = async () => {
    setBusy(true); setError(''); setProgress(0); abort.current = new AbortController();
    try {
      let saved: boolean;
      if (format === 'luno') saved = await saveProject({ ...project, name: name.trim() || project.name });
      else {
        const { exportGif, exportPng, exportSvg } = await import('../engine/export');
        const blob = format === 'gif' ? await exportGif(project, setProgress, abort.current.signal) : format === 'png' ? await exportPng(project, frame, scale, transparent) : exportSvg(project, frame, transparent);
        abort.current.signal.throwIfAborted(); setProgress(1);
        saved = await saveExport(blob, name.trim() || project.name, format);
      }
      if (saved) { useEditor.getState().notify(format === 'gif' ? 'A little magic, ready to share. Your animated GIF is saved.' : `Your ${format === 'luno' ? 'editable project' : format.toUpperCase()} is saved.`); close(); }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') { useEditor.getState().notify('Export cancelled. Your project is safe.', 'info'); close(); }
      else setError(err instanceof Error ? err.message : 'Something went wrong with the export. Try again.');
    } finally { setBusy(false); }
  };
  const gifScale = Math.min(1, 960 / Math.max(project.width, project.height));
  return <Modal title="Export your animation" onClose={requestClose} className="export-modal"><div className="dialog-heading"><span className="dialog-icon"><ArrowUpRight size={21} /></span><span className="eyebrow">FROM YOUR CANVAS TO THE WORLD</span><h1>Share a little magic.</h1><p>Your idea, ready for its next adventure.</p></div><div className="export-layout"><div className="export-preview"><SceneArtwork project={project} frame={frame} transparent={transparent && format !== 'gif'} /><span className="export-preview-caption">{format === 'gif' ? `${project.duration} frames · ${(project.duration / project.fps).toFixed(1)} seconds · looping` : `Current pose · frame ${frame + 1}`}</span><span className="preview-label">YOUR LITTLE CREATION</span></div><div className="export-options"><div className="form-label">Export as</div><div className="format-grid">{[{ id: 'gif', label: 'GIF', caption: 'In motion', icon: Film }, { id: 'png', label: 'PNG', caption: 'A still moment', icon: Image }, { id: 'svg', label: 'SVG', caption: 'Crisp vectors', icon: Code2 }, { id: 'luno', label: 'Project', caption: 'Keep creating', icon: FileJson }].map(({ id, label, caption, icon: Icon }) => <button key={id} className={`format-button ${format === id ? 'active' : ''}`} disabled={busy} onClick={() => { setFormat(id as typeof format); setError(''); }}><Icon size={19} /><strong>{label}</strong><span>{caption}</span>{format === id && <Check size={11} />}</button>)}</div><label className="form-label">File name<div className="filename-field"><input value={name} maxLength={100} disabled={busy} onChange={e => setName(e.target.value)} /><span>.{format}</span></div></label>{format === 'png' && <label className="form-label">Resolution<select disabled={busy} value={scale} onChange={e => setScale(Number(e.target.value))}><option value={1}>1× · {project.width} × {project.height}</option><option value={2}>2× · {project.width * 2} × {project.height * 2}</option></select></label>}{format === 'gif' && <div className="export-info"><Film size={14} /><span>{Math.round(project.width * gifScale)} × {Math.round(project.height * gifScale)} · {project.fps} fps<br /><small>Full animation. No bones or editor guides.</small></span></div>}{(format === 'png' || format === 'svg') && <label className="checkbox-label"><input type="checkbox" checked={transparent} disabled={busy} onChange={e => setTransparent(e.target.checked)} /><span>Transparent background</span></label>}{format === 'luno' && <div className="export-info"><FolderOpen size={14} /><span>Artwork, rigs, and keyframes.<br /><small>Open it in Luno and pick up where you left off.</small></span></div>}</div></div>{error && <div className="form-error" role="alert">{error}</div>}{busy && <div className="export-progress"><span>{format === 'gif' ? 'Making every little frame count…' : 'Preparing your file…'} <strong>{Math.round(progress * 100)}%</strong></span><progress max={1} value={progress} /></div>}<div className="dialog-footer"><span className="local-note"><ShieldCheck size={14} /> Exported right on your device</span><button className="button secondary" onClick={requestClose}>{busy ? 'Stop export' : 'Cancel'}</button><button className="button primary" disabled={busy} onClick={runExport}>{busy ? 'Exporting…' : `Export ${format === 'luno' ? 'project' : format.toUpperCase()}`}<ArrowDownToLine size={15} /></button></div></Modal>;
}
function NewProjectDialog() {
  const [template, setTemplate] = useState<'character' | 'shapes' | 'blank'>('character');
  const [name, setName] = useState('My little animation');
  const create = () => {
    const project = createProject(template); project.name = name.trim() || 'My little animation';
    const item = project.items.find(i => i.type === 'character' || (i.shape === 'ellipse' && !i.locked));
    if (item) project.keyframes[item.id] = createPreset(item, template === 'character' ? 'wave' : 'bounce', project.duration);
    useEditor.getState().replaceProject(project); close(); useEditor.getState().notify('A fresh canvas. All the possibilities.');
  };
  return <Modal title="Create a new project" onClose={close} className="new-project-modal"><div className="dialog-heading"><span className="dialog-icon"><Plus size={22} /></span><span className="eyebrow">A FRESH START</span><h1>What’s your next little idea?</h1><p>Start with something good, or start from scratch.</p></div><label className="form-label">Project name<input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={100} /></label><div className="new-template-grid">{[{ id: 'character', title: 'Character', caption: 'A rigged Milo & a wave', icon: Bone }, { id: 'shapes', title: 'Motion & shapes', caption: 'A bouncy little ball', icon: Sparkles }, { id: 'blank', title: 'Blank canvas', caption: 'Anything you imagine', icon: SquarePen }].map(({ id, title, caption, icon: Icon }) => <button key={id} className={template === id ? 'selected' : ''} onClick={() => setTemplate(id as typeof template)}><span><Icon size={25} /></span><strong>{title}</strong><small>{caption}</small>{template === id && <Check size={13} />}</button>)}</div><div className="privacy-note"><Save size={16} /><p><strong>Keep your little creations.</strong>Save a .luno copy of your current project before starting. You can also return to it with Undo.</p></div><div className="dialog-footer"><button className="text-button" onClick={close}>Back to the canvas</button><button className="button primary" onClick={create}>Create project <ArrowRight size={15} /></button></div></Modal>;
}
function SettingsDialog() {
  const project = useEditor(s => s.project);
  const preferences = useEditor(s => s.preferences);
  const [width, setWidth] = useState(project.width);
  const [height, setHeight] = useState(project.height);
  const [fps, setFps] = useState(project.fps);
  const [seconds, setSeconds] = useState(project.duration / project.fps);
  const [background, setBackground] = useState(project.background);
  const [error, setError] = useState('');
  const apply = () => {
    const duration = Math.round(seconds * fps);
    if (![width, height, fps, duration].every(Number.isInteger) || width < 64 || height < 64 || width > 4096 || height > 4096 || fps < 1 || fps > 60 || duration < 2 || duration > 1800) { setError('Canvas: 64–4096 px. Frame rate: 1–60 fps. Duration: 2–1800 frames.'); return; }
    const p = adaptCanvas(project, width, height); p.fps = fps; p.duration = duration; p.background = background;
    p.keyframes = Object.fromEntries(Object.entries(p.keyframes).map(([id, keys]) => [id, keys.filter(k => k.frame < duration)]));
    useEditor.getState().replaceProject(p); close(); useEditor.getState().notify('Your studio, just the way you like it.');
  };
  return <Modal title="Project and studio settings" onClose={close} className="settings-modal"><div className="dialog-heading"><span className="dialog-icon"><Settings2 size={21} /></span><span className="eyebrow">MAKE YOURSELF AT HOME</span><h1>Your studio. Your way.</h1><p>A few little settings. A lot of possibility.</p></div><h3 className="settings-section-label">Your canvas</h3><div className="form-grid"><label className="form-label">Width<input aria-label="Canvas width" type="number" value={width} min={64} max={4096} onChange={e => setWidth(Number(e.target.value))} /></label><label className="form-label">Height<input aria-label="Canvas height" type="number" value={height} min={64} max={4096} onChange={e => setHeight(Number(e.target.value))} /></label><label className="form-label">Frame rate<input aria-label="Project frame rate" type="number" value={fps} min={1} max={60} onChange={e => setFps(Number(e.target.value))} /></label><label className="form-label">Duration (seconds)<input aria-label="Project duration" type="number" step="0.1" value={Math.round(seconds * 100) / 100} min={0.1} max={1800 / fps} onChange={e => setSeconds(Number(e.target.value))} /></label></div><label className="background-picker"><span>Canvas background</span><input type="color" aria-label="Canvas background" value={background} onChange={e => setBackground(e.target.value)} /><span>{background.toUpperCase()}</span></label><h3 className="settings-section-label">Your workspace</h3><div className="settings-toggles"><label><span><strong>Show character bones</strong><small>See the joints that make it all move.</small></span><input type="checkbox" role="switch" checked={preferences.showBones} onChange={e => useEditor.getState().setPreference('showBones', e.target.checked)} /></label><label><span><strong>Show canvas grid</strong><small>A little structure for your ideas.</small></span><input type="checkbox" role="switch" checked={preferences.showGrid} onChange={e => useEditor.getState().setPreference('showGrid', e.target.checked)} /></label><label><span><strong>A darker studio</strong><small>Less light. Just as much possibility.</small></span><input type="checkbox" role="switch" checked={preferences.theme === 'dark'} onChange={e => useEditor.getState().setPreference('theme', e.target.checked ? 'dark' : 'light')} /></label></div><p className="settings-hint">Changing canvas size also scales your artwork. Shortening duration removes keys outside the new range (Undo to restore).</p>{error && <div className="form-error" role="alert">{error}</div>}<div className="dialog-footer"><button className="text-button" onClick={close}>Back to creating</button><button className="button primary" onClick={apply}>Save settings <Check size={15} /></button></div></Modal>;
}
function HelpDialog() {
  const [tab, setTab] = useState<'basics' | 'shortcuts' | 'about' | 'notices'>('basics');
  return <Modal title="A little help with Luno" onClose={close} className="help-modal"><div className="dialog-heading"><span className="dialog-icon"><Heart size={21} /></span><span className="eyebrow">A LITTLE HELP GOES A LONG WAY</span><h1>Let’s make things move.</h1><p>Less figuring things out. More bringing ideas to life.</p></div><div className="help-tabs">{(['basics', 'shortcuts', 'about', 'notices'] as const).map(value => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value === 'basics' ? 'Basics' : value === 'shortcuts' ? 'Shortcuts' : value === 'about' ? 'About Luno' : 'Third-party notices'}</button>)}</div>{tab === 'basics' && <div className="help-basics"><div><span><MousePointer2 size={22} /></span><div><h3>Make it your own</h3><p>Select an object to move it. Draw with the pen, rectangle, or circle tools. Add a character from Assets, or import your own image.</p></div></div><div><span><Bone size={22} /></span><div><h3>A character, not a complication</h3><p>Milo comes with a connected 15-bone rig. Drag a hand or foot: the limb follows with inverse kinematics. Hold Shift for direct joint rotation. Add your own bones with the inspector.</p></div></div><div><span><Play size={22} /></span><div><h3>One moment. Then another.</h3><p>Move the playhead to a new frame and pose your character. Auto-key saves the pose. Press K to add a key manually. Choose a motion starter for an instant head start.</p></div></div><div><span><Download size={22} /></span><div><h3>Keep it. Share it. Come back to it.</h3><p>Save a .luno file to keep your editable project. Export an animated GIF to share your motion, or a PNG/SVG for a still. Imported images animate as whole objects; automatic image mesh skinning isn’t included in this version.</p></div></div></div>}{tab === 'shortcuts' && <div className="shortcut-grid">{[['Select tool', 'V'], ['Pan canvas', 'H'], ['Draw a stroke', 'B'], ['Rectangle', 'R'], ['Ellipse', 'O'], ['Pose a rig', 'G'], ['Play / pause', 'Space'], ['Add a keyframe', 'K'], ['Step a frame', '← / →'], ['Undo', 'Ctrl / ⌘ Z'], ['Redo', 'Ctrl / ⌘ Shift Z'], ['Save project', 'Ctrl / ⌘ S'], ['Open project', 'Ctrl / ⌘ O'], ['New project', 'Ctrl / ⌘ N'], ['Duplicate object', 'Ctrl / ⌘ D'], ['Delete object', 'Delete']].map(([label, key]) => <div key={label}><span>{label}</span><kbd>{key}</kbd></div>)}</div>}{tab === 'about' && <div className="about-content"><img src="./favicon.svg" alt="Luno logo" /><h2>luno animate.</h2><span className="version-tag">EARLY STUDIO · v0.1.0</span><p>An independent, local-first 2D animation studio.<br />A little less complicated. A lot more you.</p><div><span><LockKeyhole size={15} /> No account. No cloud.</span><span><Heart size={15} /> Your ideas stay yours.</span></div><a href="https://github.com/Dinomax2005/luno-animate" target="_blank" rel="noopener noreferrer" className="button secondary">Explore the source <ArrowUpRight size={14} /></a><small>Desktop packaging: Windows setup, macOS DMG, Linux AppImage/DEB. This is an early editor, not full Adobe Animate feature parity.</small></div>}{tab === 'notices' && <pre className="license-notices">{thirdPartyNotices}</pre>}<div className="dialog-footer"><button className="text-button" onClick={() => useEditor.getState().setDialog('setup')}><Sparkles size={14} /> Take the quick setup tour</button><button className="button primary" onClick={close}>Back to the good stuff <ChevronRight size={14} /></button></div></Modal>;
}
function DownloadDialog() {
  const workflowUrl = 'https://github.com/Dinomax2005/luno-animate/actions/workflows/installers.yml';
  const expired = Date.now() > new Date(`${desktopBuild.expiresAt}T00:00:00Z`).getTime();
  return <Modal title="Get Luno Animate for desktop" onClose={close} className="download-modal"><div className="dialog-heading"><span className="dialog-icon"><Laptop size={23} /></span><span className="eyebrow">A LITTLE SPACE OF YOUR OWN</span><h1>Your studio. On your desktop.</h1><p>Install once. Create whenever. Everything stays local.</p></div><div className="desktop-platforms">{[{ name: 'Windows', file: 'Setup wizard · .exe', icon: Monitor }, { name: 'macOS', file: 'Intel & Apple silicon · .dmg', icon: Laptop }, { name: 'Linux', file: 'AppImage & .deb', icon: Code2 }].map(({ name, file, icon: Icon }) => {
    const installer = !expired ? desktopBuild.installers.find(i => i.platform === name) : undefined;
    return <div key={name}><Icon size={27} /><strong>{name}</strong><span>{file}</span>{installer ? <a className="button platform-download" href={installer.url} target="_blank" rel="noopener noreferrer"><Download size={12} /> Download build</a> : <a className="button platform-download" href={workflowUrl} target="_blank" rel="noopener noreferrer">See builds <ArrowUpRight size={12} /></a>}<span className="platform-ready">{installer ? <><Check size={11} /> {installer.sizeMB} MB · ZIP artifact</> : 'Packaging configured'}</span></div>;
  })}</div><div className="privacy-note"><ShieldCheck size={19} /><p><strong>An early studio. A real installer.</strong>Download your platform’s ZIP artifact, extract it, and open the installer inside. GitHub sign-in is required for artifact downloads. These development builds are unsigned; macOS needs signing and notarization for normal public installation. {expired ? 'This build has expired. Choose a newer successful build.' : `These downloads are kept until ${desktopBuild.expiresAt}.`}</p></div><div className="install-steps"><span><span>1</span> Download and extract your platform’s ZIP</span><span><span>2</span> Install and open Luno Animate</span><span><span>3</span> Let the quick setup wizard guide you</span></div><div className="dialog-footer"><button className="text-button" onClick={close}>Keep creating here</button><a className="button secondary" href="https://github.com/Dinomax2005/luno-animate/releases" target="_blank" rel="noopener noreferrer">Public releases <ArrowUpRight size={14} /></a><a className="button primary" href={workflowUrl} target="_blank" rel="noopener noreferrer">All installer builds <ArrowUpRight size={15} /></a></div></Modal>;
}
