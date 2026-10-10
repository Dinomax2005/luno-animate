import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, CloudOff, Download, FolderOpen, Home, LoaderCircle, PanelTop, RotateCcw, Search, Undo2, Redo2, X } from 'lucide-react';
import { APP_VERSION } from '../config/version';
import { useEditor } from '../store/editor';
import { useWorkspace } from '../store/workspace';
import { goHome } from '../services/library';
import { appCommands, applyWorkspace, executeCommand, menuNames, shortcutLabel, type AppActions, type MenuName } from './studio/commands';

export type FileActions = AppActions;
export function Header(actions: FileActions) {
  const project = useEditor(s => s.project), preferences = useEditor(s => s.preferences), saveStatus = useEditor(s => s.saveStatus), busy = useEditor(s => s.busy);
  const workspace = useWorkspace(s => s.workspace);
  // Menus need selection/history updates, not the animation's frame-by-frame render loop.
  useEditor(s => s.selectedIds); useEditor(s => s.keySelection); useEditor(s => s.history.length); useEditor(s => s.future.length); useEditor(s => s.keyClipboard.length);
  useWorkspace(s => s.showLayers); useWorkspace(s => s.showProperties); useWorkspace(s => s.showTimeline); useWorkspace(s => s.showRulers); useWorkspace(s => s.focused); useWorkspace(s => s.popout);
  const [menu, setMenu] = useState<MenuName | null>(null), [name, setName] = useState(project.name);
  const menusRef = useRef<HTMLElement>(null), popupRef = useRef<HTMLDivElement>(null), triggerRefs = useRef<Partial<Record<MenuName, HTMLButtonElement>>>({});
  useEffect(() => setName(project.name), [project.name]);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => { if (!menusRef.current?.contains(e.target as Node)) setMenu(null); };
    document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside);
  }, [menu]);
  const commands = appCommands(actions);
  const focusMenu = (next: MenuName) => { setMenu(next); requestAnimationFrame(() => popupRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()); };
  const menuKeys = (e: React.KeyboardEvent, current: MenuName) => {
    if (e.key === 'Tab') { setMenu(null); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMenu(null); triggerRefs.current[current]?.focus(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); const next = menuNames[(menuNames.indexOf(current) + (e.key === 'ArrowRight' ? 1 : menuNames.length - 1)) % menuNames.length]; focusMenu(next); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault(); e.stopPropagation(); const buttons = [...(popupRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
      if (!menu) { focusMenu(current); return; }
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const index = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (at + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
      buttons[index]?.focus();
    }
  };
  const commitName = () => { const trimmed = name.trim(); if (trimmed && trimmed !== project.name) useEditor.getState().setName(trimmed); else setName(project.name); };
  return <header className="pro-header" inert={busy}>
    <div className="application-menubar">
      <button className="application-mark" aria-label="Project home" title="Luno Animate · All projects" onClick={() => void goHome()}>Lu</button>
      <nav className="application-menus" ref={menusRef} role="menubar" aria-label="Application menus">
        {menuNames.map(label => <div className="application-menu" key={label}>
          <button ref={el => { if (el) triggerRefs.current[label] = el; }} role="menuitem" aria-haspopup="menu" aria-expanded={menu === label} className={`menu-trigger ${menu === label ? 'active' : ''}`} onClick={() => setMenu(menu === label ? null : label)} onPointerEnter={() => { if (menu) setMenu(label); }} onKeyDown={e => menuKeys(e, label)}>{label}</button>
          {menu === label && <div className="application-menu-popup" ref={popupRef} role="menu" aria-label={`${label} commands`} onKeyDown={e => menuKeys(e, label)}>
            {commands.filter(c => c.menu === label).map(command => <div className={command.separator ? 'menu-separated' : ''} key={command.id}><button role={command.checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-label={command.label} aria-checked={command.checked} disabled={command.enabled?.() === false} onClick={() => { setMenu(null); void executeCommand(command); }}><span className="menu-command-icon">{command.checked === true ? <Check size={13} /> : <command.icon size={13} />}</span><span>{command.label}</span><kbd>{shortcutLabel(command.shortcut)}</kbd></button></div>)}
          </div>}
        </div>)}
      </nav>
      <span className="application-name">LUNO ANIMATE</span><span className="application-version">{APP_VERSION}</span>
      <button className="menubar-search icon-button" aria-label="Search commands" title="Search commands · Ctrl/⌘ Shift P" onClick={() => useEditor.getState().setDialog('commands')}><Search size={14} /></button>
    </div>
    <div className="document-toolbar">
      <button className="icon-button document-home" aria-label="Back to all projects" title="All projects · Ctrl/⌘ Home" onClick={() => void goHome()}><Home size={15} /></button>
      <div className="document-tab" title="Rename this document"><span className="document-type">LAM</span><input aria-label="Project name" value={name} onChange={e => setName(e.target.value)} onBlur={commitName} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setName(project.name); e.currentTarget.blur(); } }} maxLength={100} style={{ width: `${Math.min(27, Math.max(12, name.length + 2))}ch` }} /><span className={`document-save-dot ${saveStatus}`} title={saveStatus === 'saved' ? 'Document saved locally' : saveStatus === 'error' ? 'Local save failed' : 'Saving changes'} /></div>
      <button className={`saved-indicator ${saveStatus}`} onClick={actions.onSave} title="Export an editable .lam copy · Ctrl/⌘ S">{saveStatus === 'saving' ? <LoaderCircle size={12} className="spin" /> : saveStatus === 'error' ? <CloudOff size={12} /> : <Check size={12} />}{saveStatus === 'saving' ? 'Saving locally…' : saveStatus === 'error' ? 'Save a copy' : 'Saved locally'}</button>
      <span className="control-divider" /><button className="icon-button document-undo" aria-label="Undo" title="Undo · Ctrl/⌘ Z" disabled={!useEditor.getState().history.length} onClick={() => useEditor.getState().undo()}><Undo2 size={14} /></button><button className="icon-button document-redo" aria-label="Redo" title="Redo · Ctrl/⌘ Shift Z" disabled={!useEditor.getState().future.length} onClick={() => useEditor.getState().redo()}><Redo2 size={14} /></button><div className="document-toolbar-spacer" />
      <button className="icon-button document-open" aria-label="Open project file" title="Open project · Ctrl/⌘ O" onClick={actions.onOpen}><FolderOpen size={15} /></button>
      <div className="workspace-control"><PanelTop size={13} /><select aria-label="Workspace" value={workspace} onChange={e => applyWorkspace(e.target.value as typeof workspace)}><option>Animation</option><option>Drawing</option><option>Rigging</option></select><ChevronDown size={11} /></div>
      <button className="icon-button reset-workspace" aria-label="Reset workspace" title="Reset panel layout" onClick={() => useWorkspace.getState().reset()}><RotateCcw size={13} /></button>
      <button className="button primary export-button" onClick={() => useEditor.getState().setDialog('export')}>Export <Download size={13} /></button>
      <span className="toolbar-theme-marker" data-theme={preferences.theme} />
    </div>
  </header>;
}
export function Toast() {
  const toast = useEditor(s => s.toast), dialog = useEditor(s => s.dialog);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => useEditor.getState().clearToast(), toast.tone === 'error' ? 8000 : 4200); return () => clearTimeout(timer);
  }, [toast]);
  if (!toast) return null;
  return <div className={`toast ${toast.tone} ${dialog ? 'with-dialog' : ''}`} role={toast.tone === 'error' ? 'alert' : 'status'}><span className="toast-icon">{toast.tone === 'success' ? <Check size={14} /> : <PanelTop size={14} />}</span><span>{toast.message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => useEditor.getState().clearToast()}><X size={14} /></button></div>;
}
