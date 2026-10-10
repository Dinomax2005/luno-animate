import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Home, RefreshCw, Check, ChevronDown, Download, CloudOff, Clock3, FilePlus2, FolderOpen, HelpCircle, Redo2, Save, Settings2, Sparkles, Undo2, X } from 'lucide-react';
import { goHome } from '../services/library';
import { useEditor } from '../store/editor';

export interface FileActions { onOpen: () => void; onSave: () => void; onImport: () => void }
export function Header({ onOpen, onSave }: FileActions) {
  const project = useEditor(s => s.project);
  const history = useEditor(s => s.history);
  const future = useEditor(s => s.future);
  const saveStatus = useEditor(s => s.saveStatus);
  const busy = useEditor(s => s.busy);
  const [menu, setMenu] = useState(false);
  const [name, setName] = useState(project.name);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => setName(project.name), [project.name]);
  useEffect(() => {
    if (!menu) return;
    const click = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', click); return () => document.removeEventListener('mousedown', click);
  }, [menu]);
  const action = (fn: () => void) => { fn(); setMenu(false); };
  return <header className="app-header" inert={busy}>
    <a className="brand" href="#" onClick={e => { e.preventDefault(); void goHome(); }} aria-label="Project home"><img src="./favicon.svg" alt="" /><span>luno<span className="brand-dot">.</span></span><span className="brand-caption">ANIMATE</span></a>
    <div className="header-divider" /><button className="icon-button home-button" aria-label="Back to all projects" title="Your project library" onClick={() => void goHome()}><Home size={17} /></button>
    <div className="file-menu" ref={menuRef}><button className={`text-button file-menu-trigger ${menu ? 'active' : ''}`} onClick={() => setMenu(!menu)} aria-expanded={menu}>File <ChevronDown size={12} /></button>{menu && <div className="dropdown file-dropdown">
      <div className="dropdown-title">YOUR PROJECT</div>
      <button onClick={() => action(() => useEditor.getState().setDialog('new'))}><FilePlus2 size={16} /><span>New project</span><kbd>⌘ N</kbd></button>
      <button onClick={() => action(onOpen)}><FolderOpen size={16} /><span>Open project…</span><kbd>⌘ O</kbd></button>
      <button onClick={() => action(onSave)}><Save size={16} /><span>Export .lam project…</span><kbd>⌘ S</kbd></button>
      <div className="dropdown-separator" /><button onClick={() => action(() => useEditor.getState().setDialog('updates'))}><RefreshCw size={16} /><span>Updates & backups</span></button>
      <button onClick={() => action(() => useEditor.getState().setDialog('download'))}><Download size={16} /><span>Get the desktop app</span><ArrowUpRight size={13} /></button>
      <button onClick={() => action(() => useEditor.getState().setDialog('settings'))}><Settings2 size={16} /><span>Project settings</span></button>
    </div>}</div>
    <div className="history-controls"><button className="icon-button" aria-label="Undo" title="Undo · Ctrl/⌘ Z" disabled={!history.length} onClick={() => useEditor.getState().undo()}><Undo2 size={16} /></button><button className="icon-button" aria-label="Redo" title="Redo · Ctrl/⌘ Shift Z" disabled={!future.length} onClick={() => useEditor.getState().redo()}><Redo2 size={16} /></button></div>
    <div className="project-name-wrap"><input aria-label="Project name" className="project-name" value={name} onChange={e => setName(e.target.value)} onBlur={() => { if (name.trim() && name !== project.name) useEditor.getState().setName(name); else setName(project.name); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setName(project.name); e.currentTarget.blur(); } }} maxLength={100} style={{ width: `${Math.min(26, Math.max(12, name.length + 2))}ch` }} /><button className={`saved-indicator ${saveStatus}`} title={saveStatus === 'error' ? 'Local save failed. Save a .lam copy to keep your work.' : 'Your working project is automatically saved on this device'} onClick={onSave}>{saveStatus === 'saving' ? <Clock3 size={12} /> : saveStatus === 'error' ? <CloudOff size={12} /> : <Check size={12} />}{saveStatus === 'saving' ? 'Saving locally…' : saveStatus === 'error' ? 'Save a copy' : 'Saved locally'}</button></div>
    <div className="header-actions"><button className="button setup-button" onClick={() => useEditor.getState().setDialog('setup')}><Sparkles size={15} /> Quick setup</button><button className="icon-button help-button" aria-label="Help and keyboard shortcuts" onClick={() => useEditor.getState().setDialog('help')}><HelpCircle size={18} /></button><button className="button primary export-button" onClick={() => useEditor.getState().setDialog('export')}>Export <ArrowUpRight size={15} /></button></div>
  </header>;
}
export function Toast() {
  const toast = useEditor(s => s.toast), dialog = useEditor(s => s.dialog);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => useEditor.getState().clearToast(), toast.tone === 'error' ? 8000 : 4200); return () => clearTimeout(timer);
  }, [toast]);
  if (!toast) return null;
  return <div className={`toast ${toast.tone} ${dialog ? 'with-dialog' : ''}`} role={toast.tone === 'error' ? 'alert' : 'status'}><span className="toast-icon">{toast.tone === 'success' ? <Check size={15} /> : <Sparkles size={15} />}</span><span>{toast.message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => useEditor.getState().clearToast()}><X size={14} /></button></div>;
}
