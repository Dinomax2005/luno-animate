import { lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import { Check, CloudOff, Command, Heart, ShieldCheck } from 'lucide-react';
import { Header, Toast } from './components/Header';
import { ToolRail } from './components/ToolRail';
import { Library } from './components/Library';
import { Stage } from './components/Stage';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';
const Dialogs = lazy(() => import('./components/Dialogs').then(module => ({ default: module.Dialogs })));
import { useEditor, STORAGE_KEY, PREFS_KEY } from './store/editor';
import { createItem, parseProject, serializeProject } from './engine/project';
import { imageFromFile, saveProject } from './engine/files';
import type { Tool } from './engine/types';

export default function App() {
  const project = useEditor(s => s.project);
  const preferences = useEditor(s => s.preferences);
  const playing = useEditor(s => s.playing);
  const dialog = useEditor(s => s.dialog);
  const inputProject = useRef<HTMLInputElement>(null);
  const inputImage = useRef<HTMLInputElement>(null);
  const onSave = useCallback(async () => {
    try { if (await saveProject(useEditor.getState().project)) useEditor.getState().notify('Your editable .luno project is saved.'); }
    catch (err) { useEditor.getState().notify(err instanceof Error ? err.message : 'Could not save the project.', 'error'); }
  }, []);
  const loadProject = useCallback((raw: string) => {
    try { const parsed = parseProject(raw); useEditor.getState().replaceProject(parsed); useEditor.getState().notify(`Welcome back to “${parsed.name}”.`); }
    catch (err) { useEditor.getState().notify(err instanceof Error ? err.message : 'Could not read this project.', 'error'); }
  }, []);
  const onOpen = useCallback(async () => {
    if (window.luno) {
      try { const raw = await window.luno.openProject(); if (raw) loadProject(raw); }
      catch { useEditor.getState().notify('Could not open the project file.', 'error'); }
    } else inputProject.current?.click();
  }, [loadProject]);
  const onImport = useCallback(() => inputImage.current?.click(), []);
  const importFile = useCallback(async (file: File) => {
    if (file.name.endsWith('.luno') || file.name.endsWith('.json')) { loadProject(await file.text()); return; }
    try {
      const image = await imageFromFile(file); const p = useEditor.getState().project;
      const scale = Math.min(1, p.width * 0.5 / image.width, p.height * 0.6 / image.height);
      useEditor.getState().addItem(createItem('image', { name: file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Artwork', x: p.width / 2, y: p.height / 2, width: image.width, height: image.height, scaleX: scale, scaleY: scale, imageData: image.data }));
      useEditor.getState().notify('Your artwork is here. Let’s bring it to life.');
    } catch (err) { useEditor.getState().notify(err instanceof Error ? err.message : 'Could not import this image.', 'error'); }
  }, [loadProject]);

  useEffect(() => {
    useEditor.getState().setSaveStatus('saving');
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, serializeProject(project)); useEditor.getState().markSaved(); }
      catch { useEditor.getState().setSaveStatus('error'); useEditor.getState().notify('Local storage is full or unavailable. Save a .luno file to keep your changes.', 'error'); }
    }, 500);
    return () => clearTimeout(timer);
  }, [project]);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(preferences)); } catch { /* Project save errors are surfaced separately. */ }
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences]);
  useEffect(() => {
    const flush = (event?: BeforeUnloadEvent) => {
      try { localStorage.setItem(STORAGE_KEY, serializeProject(useEditor.getState().project)); }
      catch { if (event && window.luno) { event.preventDefault(); event.returnValue = ''; } }
    };
    window.addEventListener('beforeunload', flush);
    const visibility = () => { if (document.visibilityState === 'hidden') { flush(); useEditor.getState().setPlaying(false); } };
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('beforeunload', flush); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const state = useEditor.getState(); const startFrame = state.frame;
    let startTime: number | null = null; let request = 0;
    const animate = (time: number) => {
      if (startTime === null) startTime = time;
      const current = useEditor.getState();
      const next = startFrame + Math.floor((time - startTime) / 1000 * current.project.fps);
      if (next >= current.project.duration && !current.preferences.loop) { current.setFrame(current.project.duration - 1); current.setPlaying(false); return; }
      const nextFrame = next % current.project.duration;
      if (current.frame !== nextFrame) current.setFrame(nextFrame);
      request = requestAnimationFrame(animate);
    };
    request = requestAnimationFrame(animate); return () => cancelAnimationFrame(request);
  }, [playing]);
  useEffect(() => {
    const unsubscribe = window.luno?.onProjectFile(loadProject);
    void window.luno?.ready().catch(() => useEditor.getState().notify('The desktop file connection needs a restart.', 'error'));
    return () => unsubscribe?.();
  }, [loadProject]);
  useEffect(() => {
    const command = (value: string) => {
      const s = useEditor.getState();
      if (s.dialog) return;
      if (value === 'save') void onSave(); else if (value === 'open') void onOpen(); else if (value === 'new') s.setDialog('new'); else if (value === 'export') s.setDialog('export'); else if (value === 'undo') s.undo(); else if (value === 'redo') s.redo(); else if (value === 'setup') s.setDialog('setup'); else if (value === 'help') s.setDialog('help');
    };
    const unsubscribe = window.luno?.onCommand(command);
    const keys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.defaultPrevented || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable || useEditor.getState().dialog) return;
      const s = useEditor.getState(), key = event.key.toLowerCase();
      if (event.metaKey || event.ctrlKey) {
        if (['s', 'o', 'n', 'z', 'y', 'd'].includes(key)) event.preventDefault();
        if (key === 's') void onSave(); else if (key === 'o') void onOpen(); else if (key === 'n') s.setDialog('new'); else if (key === 'z') event.shiftKey ? s.redo() : s.undo(); else if (key === 'y') s.redo(); else if (key === 'd') s.duplicateSelected();
        return;
      }
      const tools: Record<string, Tool> = { v: 'select', h: 'hand', b: 'pen', r: 'rectangle', o: 'ellipse', g: 'rig' };
      if (tools[key]) { s.setTool(tools[key]); if (key === 'g') s.setPreference('showBones', true); }
      if (key === ' ') { event.preventDefault(); s.setPlaying(!s.playing); }
      if (key === 'k') s.addKeyframe();
      if (key === 'delete' || key === 'backspace') { event.preventDefault(); s.deleteSelected(); }
      if (key === 'arrowleft' || key === 'arrowright') { event.preventDefault(); s.setPlaying(false); s.setFrame(s.frame + (key === 'arrowleft' ? -1 : 1) * (event.shiftKey ? 12 : 1)); }
      if (key === 'escape') s.select(null);
      if (key === '?' || key === 'f1') { event.preventDefault(); s.setDialog('help'); }
    };
    window.addEventListener('keydown', keys); return () => { window.removeEventListener('keydown', keys); unsubscribe?.(); };
  }, [onOpen, onSave]);

  return <div className="app-shell" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && !useEditor.getState().dialog) void importFile(file); }}>
    <Header onOpen={() => void onOpen()} onSave={() => void onSave()} onImport={onImport} />
    <div className="studio"><ToolRail onImport={onImport} /><main className="editor-main"><div className="workspace"><Library onImport={onImport} /><Stage /><Inspector /></div><Timeline /></main></div>
    <footer className="app-footer"><span className="footer-studio-label"><span className="green-dot" /> YOUR LOCAL STUDIO <span className="footer-version">v0.1</span></span><span className="footer-message"><Heart size={10} /> A little less complicated. A lot more animated.</span><div><span><CloudOff size={11} /> Offline-ready</span><span><ShieldCheck size={11} /> Private by design</span><button onClick={() => useEditor.getState().setDialog('help')}><Command size={11} /> Shortcuts</button><Check size={11} /></div></footer>
    <Toast /><Suspense fallback={<div className="dialog-loading" role="status">Preparing a little space…</div>}>{dialog && <Dialogs />}</Suspense>
    <input ref={inputProject} type="file" className="visually-hidden" aria-label="Open Luno project file" accept=".luno,.json" onChange={async e => { const file = e.target.files?.[0]; if (file) { try { loadProject(await file.text()); } catch { useEditor.getState().notify('Could not read the file.', 'error'); } } e.target.value = ''; }} />
    <input ref={inputImage} type="file" className="visually-hidden" aria-label="Import image file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={async e => { const file = e.target.files?.[0]; if (file) await importFile(file); e.target.value = ''; }} />
  </div>;
}
