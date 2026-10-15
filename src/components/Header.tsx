import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDownToLine, Check, ChevronDown, FolderOpen, Grid2X2, Home, LoaderCircle, Menu, Redo2, RotateCcw, Save, Search, Undo2 } from 'lucide-react';
import { useStudio } from '../state/studio';
import { clamp, pose } from '../core/motion';
import { VERSION, type Workspace } from '../core/model';
import { commands, execute, type Command } from '../services/commands';
import { home } from '../services/library';
import { openFile, saveFile, useFile } from '../services/files';

const groups: Command['group'][] = ['File', 'Edit', 'Layer', 'Animation', 'View', 'Help'];

/** Single application bar. Commands live behind one menu button so the editor keeps
 * a single row of chrome, in the layout professional tools use. */
export function Header({ onImport }: { onImport: () => void }) {
  const s = useStudio();
  const d = s.document!;
  const link = useFile(v => v.links[d.id]);
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<Command['group']>('File');
  const [title, setTitle] = useState(d.title);
  const bar = useRef<HTMLElement>(null);
  const columns = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = commands(onImport);
  const rows = () => [...(columns.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
  useEffect(() => setTitle(d.title), [d.title]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!bar.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);
  const show = (next: Command['group']) => {
    setOpen(true);
    setGroup(next);
    requestAnimationFrame(() => columns.current?.querySelector<HTMLButtonElement>('.menu-commands button')?.focus());
  };
  const keys = (event: React.KeyboardEvent) => {
    const inside = document.activeElement?.closest('.menu-commands') !== null;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      if (inside && open) { setGroup(groups[0]); requestAnimationFrame(() => columns.current?.querySelector<HTMLButtonElement>(`.menu-groups button[data-group="${group}"]`)?.focus()); return; }
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (!open) { show(group); return; }
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    const all = rows();
    const here = all.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowRight' && !inside) { show(group); return; }
    if (event.key === 'ArrowLeft' && inside) { requestAnimationFrame(() => columns.current?.querySelector<HTMLButtonElement>(`.menu-groups button[data-group="${group}"]`)?.focus()); return; }
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? all.length - 1 : (here + (forward ? 1 : all.length - 1)) % Math.max(1, all.length);
    all[next]?.focus();
  };
  return (
    <header className="studio-header top-only" inert={s.busy} ref={bar}>
      <div className="top-bar" onKeyDown={keys}>
        <button className="app-menu-button" aria-label="Application menu" aria-haspopup="menu" aria-expanded={open} ref={trigger} onClick={() => { setOpen(!open); setGroup(group); }} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); show(group); } }}>
          <img src="./mark.svg" alt="" />
          <Menu size={13} />
        </button>
        <button className="icon-button" aria-label="Back to projects" title="Project library" onClick={() => void home()}><Home size={13} /></button>
        <div className="document-tab">
          <span>LAM</span>
          <input aria-label="Document title" value={title} maxLength={100} onChange={event => setTitle(event.target.value)} onBlur={() => { if (title.trim() && title !== d.title) s.commit('Rename document', doc => { doc.title = title.trim(); }); else setTitle(d.title); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
          <small aria-label={link && link.snapshot !== d ? 'Unsaved file changes' : 'External file state'}>{link && link.snapshot !== d ? '●' : ''}</small>
          <ChevronDown size={10} />
        </div>
        <span className={`save-indicator ${s.saveState}`} aria-live="polite">{s.saveState === 'saving' ? <LoaderCircle size={11} className="spin" /> : s.saveState === 'error' ? <AlertTriangle size={11} /> : <Check size={11} />}{s.saveState === 'saved' ? 'Saved' : s.saveState === 'saving' ? 'Saving…' : 'Save failed'}</span>
        <span className="bar-divider" />
        <button className="icon-button" aria-label="Undo" disabled={!s.history.length} onClick={() => s.undo()}><Undo2 size={13} /></button>
        <button className="icon-button" aria-label="Redo" disabled={!s.future.length} onClick={() => s.redo()}><Redo2 size={13} /></button>
        <div className="document-bar-spacer" />
        <div className="workspace-switch" role="tablist" aria-label="Workspaces">
          {(['Draw', 'Motion', 'Edit'] as Workspace[]).map(workspace => (
            <button role="tab" aria-selected={s.workspace === workspace} key={workspace} onClick={() => s.set({ workspace, tool: workspace === 'Draw' ? 'brush' : 'select', playing: false })}>{workspace}</button>
          ))}
        </div>
        <button className="icon-button" aria-label="Search commands" title="Command search · Ctrl Shift P" onClick={() => s.set({ dialog: 'commands' })}><Search size={13} /></button>
        <span className="bar-divider" />
        <button className="icon-button" aria-label="Save project" title={link ? `Overwrite ${link.name}` : 'Choose a .lam destination'} onClick={() => void saveFile()}><Save size={13} /></button>
        <button className="icon-button" aria-label="Open project" onClick={() => void openFile()}><FolderOpen size={13} /></button>
        <button className="button primary" aria-label="Export" onClick={() => s.set({ dialog: 'export' })}>Export<ArrowDownToLine size={13} /></button>
        {open && (
          <div className="app-menu" role="menu" aria-label="Application menu" ref={columns}>
            <div className="menu-groups">
              {groups.map(name => (
                <button role="menuitem" aria-haspopup="menu" aria-expanded={group === name} data-group={name} key={name} className={group === name ? 'active' : ''} onMouseEnter={() => setGroup(name)} onClick={() => show(name)}><span>{name}</span><ChevronDown size={11} className="menu-chevron" /></button>
              ))}
            </div>
            <div className="menu-commands" role="menu" aria-label={`${group} commands`}>
              <span className="menu-heading">{group}</span>
              {list.filter(command => command.group === group).map(command => (
                <button role="menuitem" aria-label={command.label} key={command.id} disabled={command.enabled?.() === false} onClick={() => { setOpen(false); execute(command); }}><span>{command.label}</span><kbd>{command.shortcut}</kbd></button>
              ))}
            </div>
            <span className="menu-foot">Pegbar Studio {VERSION}</span>
          </div>
        )}
      </div>
      <ToolOptions />
    </header>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="option-field"><span>{label}</span>{children}</label>;
}

/** Tool options bar: the settings that belong to the active tool, kept next to the canvas. */
function ToolOptions() {
  const s = useStudio();
  const scene = s.document!.scenes.find(candidate => candidate.id === s.sceneId)!;
  const layer = scene.layers.find(candidate => candidate.id === s.selected[0]);
  const brush = s.preferences.brush;
  const setBrush = (patch: Partial<typeof brush>) => s.pref('brush', { ...brush, ...patch });
  const name = s.tool === 'erase' ? 'Eraser' : s.tool === 'brush' ? 'Brush' : s.tool === 'select' ? 'Selection' : s.tool === 'rig' ? 'Rig pose' : s.tool === 'rect' ? 'Rectangle' : s.tool === 'ellipse' ? 'Ellipse' : s.tool === 'fill' ? 'Fill' : s.tool === 'picker' ? 'Eyedropper' : 'Type';
  return (
    <div className="tool-options" aria-label={`${name} options`}>
      <span className="tool-options-name">{name}</span>
      {(s.tool === 'brush' || s.tool === 'erase') && (
        <>
          <Field label="Tip">
            <select aria-label="Tip type" value={brush.tip} onChange={event => setBrush({ tip: event.target.value as typeof brush.tip })}>
              {['round', 'ink', 'soft', 'pencil', 'marker', 'pixel', 'charcoal', 'spray'].map(tip => <option key={tip} value={tip}>{tip[0].toUpperCase() + tip.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Size"><input aria-label="Tip size" type="number" min={1} max={256} value={brush.size} onChange={event => setBrush({ size: clamp(Math.round(Number(event.target.value) || 1), 1, 256) })} /></Field>
          <Field label="Opacity"><input aria-label="Tip opacity" type="range" min={5} max={100} value={Math.round(brush.opacity * 100)} onChange={event => setBrush({ opacity: Number(event.target.value) / 100 })} /></Field>
          <Field label="Flow"><input aria-label="Tip flow" type="range" min={5} max={100} value={Math.round(brush.flow * 100)} onChange={event => setBrush({ flow: Number(event.target.value) / 100 })} /></Field>
          <Field label="Stabilize"><input aria-label="Brush stabilization" type="range" min={0} max={95} value={Math.round(brush.smoothing * 100)} onChange={event => setBrush({ smoothing: Number(event.target.value) / 100 })} /></Field>
          <Field label="Spacing"><input aria-label="Brush spacing" type="range" min={5} max={100} value={Math.round(brush.spacing * 100)} onChange={event => setBrush({ spacing: Number(event.target.value) / 100 })} /></Field>
          <button className="option-toggle" aria-pressed={brush.pressure} aria-label="Pen pressure" onClick={() => setBrush({ pressure: !brush.pressure })}>Pressure</button>
          {s.tool === 'erase' && <span className="option-hint">Removes the last marks on this cel only. Undo restores them.</span>}
        </>
      )}
      {s.tool === 'fill' && <span className="option-hint">Fills the connected region of the active drawing cel, sampled at up to 1024px. Locked or non-painting layers are refused.</span>}
      {s.tool === 'picker' && <span className="option-hint">Samples the composited canvas, excluding selection handles and guides. Alt while brushing does the same.</span>}
      {s.tool === 'select' && (
        <>
          <button className="option-toggle" aria-pressed={s.preferences.grid} aria-label="Canvas grid" onClick={() => s.pref('grid', !s.preferences.grid)}><Grid2X2 size={11} />Grid</button>
          <button className="option-toggle" aria-pressed={s.preferences.snap} aria-label="Snap to grid" onClick={() => s.pref('snap', !s.preferences.snap)}>Snap</button>
          {layer ? <span className="option-hint">X {Math.round(pose(layer, s.frame).x)} · Y {Math.round(pose(layer, s.frame).y)} · corner handles scale, upper handle rotates</span> : <span className="option-hint">Drag a marquee to select unlocked layers. Shift adds to the selection.</span>}
          <button className="option-toggle" aria-label="Fit canvas" onClick={() => s.set({ zoom: 100, pan: { x: 0, y: 0 } })}><RotateCcw size={11} />Fit {Math.round(s.zoom)}%</button>
        </>
      )}
      {s.tool === 'rig' && (
        <>
          {layer?.kind === 'rig' ? <Field label="Joint"><select aria-label="Options joint" value={s.bone ?? layer.bones?.[0]?.id} onChange={event => s.set({ bone: event.target.value })}>{layer.bones?.map(bone => <option key={bone.id} value={bone.id}>{bone.name}</option>)}</select></Field> : null}
          <span className="option-hint">{layer?.kind === 'rig' ? 'Drag a joint end to solve IK within its limits. Inspector holds bone length, angle limits and attachment.' : 'Insert an armature, then drag joint ends to pose it.'}</span>
        </>
      )}
      {(s.tool === 'rect' || s.tool === 'ellipse') && <span className="option-hint">Drag on the canvas to place a {name.toLowerCase()}. New shapes take the foreground colour and keep editable width, height and stroke in Inspector.</span>}
      {s.tool === 'text' && <span className="option-hint">Click the canvas to place editable type. Set font size, colour and alignment in Inspector; the Text layer keeps its content.</span>}
    </div>
  );
}
