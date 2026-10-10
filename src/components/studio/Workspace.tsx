import { useShallow } from 'zustand/react/shallow';
import { useRef, useEffect, type CSSProperties, type PointerEvent } from 'react';
import { Check, Circle, Command, Crosshair, FileCheck2, MousePointer2, PanelLeft, PanelRight, Play, X } from 'lucide-react';
import { Library } from '../Library';
import { Inspector } from '../Inspector';
import { Stage } from '../Stage';
import { Timeline } from '../Timeline';
import { ToolRail } from '../ToolRail';
import { useWorkspace, type WorkspaceLayout } from '../../store/workspace';
import { useDocumentFiles, fileIsDirty } from '../../services/document-files';
import { useEditor } from '../../store/editor';

function ResizeHandle({ side }: { side: 'layers' | 'properties' | 'timeline' }) {
  const key = side === 'layers' ? 'leftWidth' : side === 'properties' ? 'rightWidth' : 'timelineHeight';
  const value = useWorkspace(s => s[key]);
  const dragging = useRef<{ pointer: number; value: number } | null>(null);
  useEffect(() => () => { if (dragging.current) useEditor.getState().setInteracting(false); }, []);
  const vertical = side !== 'timeline', min = side === 'layers' ? 176 : side === 'properties' ? 240 : 140, max = side === 'layers' ? 380 : side === 'properties' ? 460 : 560;
  const set = (number: number) => useWorkspace.getState().setLayout({ [key]: number } as Partial<WorkspaceLayout>);
  const end = (event: PointerEvent<HTMLDivElement>) => { dragging.current = null; useEditor.getState().setInteracting(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  return <div className={`panel-resizer ${vertical ? 'vertical' : 'horizontal'} resizer-${side}`} role="separator" aria-label={`Resize ${side} panel`} aria-orientation={vertical ? 'vertical' : 'horizontal'} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} tabIndex={0} onDoubleClick={() => set(side === 'layers' ? 218 : side === 'properties' ? 282 : 258)} onPointerDown={e => {
    if (e.button !== 0 || useEditor.getState().busy) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); useEditor.getState().setInteracting(true); dragging.current = { pointer: vertical ? e.clientX : e.clientY, value };
  }} onPointerMove={e => {
    if (!dragging.current) return;
    const delta = (vertical ? e.clientX : e.clientY) - dragging.current.pointer;
    set(dragging.current.value + delta * (side === 'layers' ? 1 : -1));
  }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={() => { if (dragging.current) { dragging.current = null; useEditor.getState().setInteracting(false); } }} onKeyDown={e => {
    const positive = vertical ? 'ArrowRight' : 'ArrowDown', negative = vertical ? 'ArrowLeft' : 'ArrowUp';
    if ([positive, negative].includes(e.key)) { e.preventDefault(); e.stopPropagation(); set(value + (e.key === positive ? 1 : -1) * (side === 'layers' ? 1 : -1) * (e.shiftKey ? 32 : 8)); }
  }} />;
}
export function StudioWorkspace({ onImport, onImportAudio }: { onImport: () => void; onImportAudio: () => void }) {
  const layout = useWorkspace(useShallow(s => ({ leftWidth: s.leftWidth, rightWidth: s.rightWidth, timelineHeight: s.timelineHeight, showLayers: s.showLayers, showProperties: s.showProperties, showTimeline: s.showTimeline, focused: s.focused, popout: s.popout }))), busy = useEditor(s => s.busy);
  const layers = layout.showLayers && !layout.focused, properties = layout.showProperties && !layout.focused, timeline = layout.showTimeline && !layout.focused;
  const style = { '--layers-width': `${layout.leftWidth}px`, '--properties-width': `${layout.rightWidth}px`, '--timeline-height': `${layout.timelineHeight}px` } as CSSProperties;
  return <div className="studio pro-studio" inert={busy} style={style} data-focus={layout.focused} data-popout={layout.popout ?? ''}>
    <ToolRail onImport={onImport} />
    <div className={`pro-workbench ${properties ? '' : 'without-properties'}`}>
      <main className="editor-main pro-main">
        <div className={`workspace ${layers ? '' : 'without-layers'}`}>
          {layers && <><Library onImport={onImport} /><ResizeHandle side="layers" /></>}<Stage />
        </div>
        {timeline && <><ResizeHandle side="timeline" /><Timeline onImportAudio={onImportAudio} /></>}
      </main>
      {properties && <><ResizeHandle side="properties" /><Inspector /></>}
    </div>
    {layout.popout && <><button className="panel-popout-dismiss" aria-label="Dismiss panel overlay" onClick={() => useWorkspace.getState().closePopout()} /><button className={`panel-popout-close ${layout.popout}`} aria-label="Close panel overlay" onClick={() => useWorkspace.getState().closePopout()}><X size={13} /></button></>}
    {layout.focused && <div className="focus-mode-badge"><Crosshair size={12} /> Focus stage <button onClick={() => useWorkspace.getState().toggleFocus()}>Restore panels <kbd>Tab</kbd></button></div>}
  </div>;
}
export function StudioStatus() {
  const project = useEditor(s => s.project), selectedIds = useEditor(s => s.selectedIds), tool = useEditor(s => s.tool), frame = useEditor(s => s.frame), save = useEditor(s => s.saveStatus), playing = useEditor(s => s.playing);
  const fileLink = useDocumentFiles(s => s.links[project.id]);
  const fileDirty = fileIsDirty(project, fileLink);
  const protectedOperation = useEditor(s => s.busy || !!s.blockReason || s.interacting);
  const cursor = useWorkspace(s => s.cursor), focused = useWorkspace(s => s.focused);
  const toolNames = { select: 'Selection', hand: 'Hand', pen: 'Brush', rectangle: 'Rectangle', ellipse: 'Ellipse', text: 'Text', camera: 'Camera', rig: 'Bone / IK' };
  return <footer className="app-footer pro-statusbar" inert={protectedOperation} aria-label="Workspace status">
    <span className="status-tool"><MousePointer2 size={11} />{toolNames[tool]}<span className="status-divider" />{selectedIds.length ? `${selectedIds.length} selected` : 'No selection'}</span>
    <span className="status-coordinate"><Crosshair size={10} /> X <strong>{cursor?.x ?? '—'}</strong> Y <strong>{cursor?.y ?? '—'}</strong></span>
    <span className="status-document">{project.width} × {project.height} px<span className="status-divider" />{project.fps} fps<span className="status-divider" />Frame {String(frame + 1).padStart(3, '0')} / {project.duration}</span>
    <span className={`status-file ${fileDirty ? 'dirty' : ''}`} title={fileLink?.kind === 'native' ? fileLink.target.displayPath : fileLink?.target.name ?? 'Not linked to an external file. Library autosave is separate.'}>{fileLink ? `${fileDirty ? 'Modified · ' : 'File · '}${fileLink.target.name}` : 'Library document · Save As for .lam'}</span><span className={`status-storage ${save}`}>{playing ? <Play size={10} /> : save === 'saved' ? <FileCheck2 size={11} /> : <Circle size={10} />}{playing ? 'Playing' : save === 'saved' ? 'Local save complete' : save === 'error' ? 'Save failed — export a copy' : 'Saving'}</span>
    <button className="status-dock-button layers" aria-label="Toggle Layers panel" title="Layers / Library" onClick={() => useWorkspace.getState().togglePanel('layers')}><PanelLeft size={12} /></button><button className="status-dock-button properties" aria-label="Toggle Properties panel" title="Properties" onClick={() => useWorkspace.getState().togglePanel('properties')}><PanelRight size={12} /></button><button className="status-panel-button" aria-label="Toggle workspace panels" title="Toggle panels · Tab" onClick={() => useWorkspace.getState().toggleFocus()}>{focused ? <PanelRight size={12} /> : <PanelLeft size={12} />}</button>
    <button className="status-reference" aria-label="Open command search" onClick={() => useEditor.getState().setDialog('commands')} title="Command search · Ctrl/⌘ Shift P"><Command size={11} /><Check size={10} /></button>
  </footer>;
}
