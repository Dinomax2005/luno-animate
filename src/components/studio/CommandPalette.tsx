import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDown, CornerDownLeft, Search } from 'lucide-react';
import { Modal } from '../Modal';
import { useEditor } from '../../store/editor';
import { useWorkspace } from '../../store/workspace';
import { appCommands, executeCommand, shortcutLabel, type AppActions, type AppCommand } from './commands';

export function CommandPalette(actions: AppActions) {
  const [query, setQuery] = useState(''), [active, setActive] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null), inputRef = useRef<HTMLInputElement>(null), listId = useId();
  useEditor(s => s.project); useEditor(s => s.selectedIds); useEditor(s => s.preferences);
  useEditor(s => s.history.length); useEditor(s => s.future.length); useEditor(s => s.selectedAudio);
  useEditor(s => s.selectedCamera); useEditor(s => s.keySelection); useEditor(s => s.keyClipboard);
  useWorkspace(s => s.workspace);
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = appCommands(actions).filter(c => words.every(word => `${c.label} ${c.menu} ${c.description ?? ''} ${c.shortcut ?? ''}`.toLowerCase().includes(word)));
  const enabled = matches.flatMap((c, n) => c.enabled?.() === false ? [] : [n]);
  const signature = enabled.join(',');
  const close = () => useEditor.getState().setDialog(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActive(signature ? Number(signature.split(',')[0]) : -1); }, [query, signature]);
  useEffect(() => { listRef.current?.querySelector(`[data-command-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);
  const move = (direction: number) => setActive(current => {
    if (!enabled.length) return -1;
    const position = enabled.indexOf(current);
    return enabled[(position + direction + enabled.length) % enabled.length];
  });
  const run = (command?: AppCommand) => { if (!command || command.enabled?.() === false) return; close(); void executeCommand(command); };
  return <Modal title="Command search" className="command-palette" onClose={close}>
    <div className="command-search-field"><Search size={19} /><input ref={inputRef} role="combobox" aria-label="Search commands" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined} placeholder="Search commands, panels, and actions…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => {
      if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'ArrowDown') move(1);
      if (e.key === 'ArrowUp') move(-1);
      if (e.key === 'Enter') run(matches[active]);
    }} /><kbd>Esc</kbd></div>
    <div id={listId} className="command-results" ref={listRef} role="listbox" aria-label="Available commands">
      {matches.map((command, n) => <button id={`${listId}-${n}`} key={command.id} role="option" aria-selected={active === n} aria-disabled={command.enabled?.() === false} disabled={command.enabled?.() === false} className={`command-result ${active === n ? 'active' : ''}`} data-command-index={n} onPointerMove={() => setActive(n)} onClick={() => run(command)}>
        <command.icon size={16} /><span><strong>{command.label}</strong><small>{command.menu}{command.description ? ` / ${command.description}` : ''}</small></span><kbd>{shortcutLabel(command.shortcut)}</kbd>{active === n && <CornerDownLeft size={14} />}
      </button>)}
      {!matches.length && <div className="command-no-results">No commands match “{query}”.</div>}
    </div>
    <div className="command-footer"><span><ArrowDown size={11} /> Navigate</span><span><CornerDownLeft size={11} /> Run command</span><span>{matches.length} commands</span></div>
  </Modal>;
}
