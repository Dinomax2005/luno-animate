import { lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Header, Toast } from './components/Header';
import { StudioWorkspace, StudioStatus } from './components/studio/Workspace';
import { CommandPalette } from './components/studio/CommandPalette';
import { useWorkspace } from './store/workspace';
import { ProjectHome } from './components/home/ProjectHome';
import { UpdateBanner } from './components/Updates';
import { useEditor, PREFS_KEY } from './store/editor';
import { createItem, createProject } from './engine/project';
import { readProjectData, MAX_LAM_BYTES } from './engine/lam';
import { imageFromFile, saveProject } from './engine/files';
import { flushProject, goHome, hasUnsavedProject, initializeLibrary, openDocument } from './services/library';
import { AudioPlayback, audioFromFile } from './services/audio';
import type { Tool } from './engine/types';
const Dialogs = lazy(() => import('./components/Dialogs').then(module => ({ default: module.Dialogs })));

export default function App() {
  const project = useEditor(s => s.project), preferences = useEditor(s => s.preferences), playing = useEditor(s => s.playing);
  const busy = useEditor(s => s.busy);
  const dialog = useEditor(s => s.dialog), view = useEditor(s => s.view), ready = useEditor(s => s.libraryReady), blocked = useEditor(s => s.blockReason);
  const inputProject = useRef<HTMLInputElement>(null), inputImage = useRef<HTMLInputElement>(null), inputAudio = useRef<HTMLInputElement>(null);
  const lastActivity = useRef(Date.now());
  const onSave = useCallback(async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const s = useEditor.getState(); s.setBusy(true);
    try { await flushProject(); if (await saveProject(useEditor.getState().project)) s.notify('Your portable .lam project is saved, including every scene, rig, drawing, and sound.'); }
    catch (error) { s.notify(error instanceof Error ? error.message : 'Could not save the project.', 'error'); }
    finally { s.setBusy(false); }
  }, []);
  const loadProject = useCallback(async (raw: string | Uint8Array | ArrayBuffer, ownsBusyOperation = false) => {
    const state = useEditor.getState(); if (state.blockReason || state.interacting || state.busy && !ownsBusyOperation) { state.notify('Finish the current operation before opening another project. Your file is unchanged.', 'info'); return; }
    try { const parsed = readProjectData(raw); await openDocument(parsed, true); useEditor.getState().notify(`“${parsed.name}” is in your project library. The original file is unchanged.`); }
    catch (error) { useEditor.getState().notify(error instanceof Error ? error.message : 'Could not read this project.', 'error'); }
  }, []);
  const onOpen = useCallback(async () => {
    if (window.luno) {
      const s = useEditor.getState(); s.setBusy(true);
      try { const raw = await window.luno.openProject(); if (raw) await loadProject(raw, true); }
      catch (error) { s.notify(error instanceof Error ? error.message : 'Could not open the project file.', 'error'); }
      finally { s.setBusy(false); }
    } else inputProject.current?.click();
  }, [loadProject]);
  const onImport = useCallback(() => inputImage.current?.click(), []), onImportAudio = useCallback(() => inputAudio.current?.click(), []);
  const importFile = useCallback(async (file: File) => {
    const s = useEditor.getState();
    if (s.busy || s.blockReason || s.interacting) { s.notify('Finish the current operation before importing. Your original file is unchanged.', 'info'); return; }
    (document.activeElement as HTMLElement | null)?.blur?.();
    s.setBusy(true);
    try {
      if (/\.(lam|luno|json)$/i.test(file.name)) {
        if (file.size > MAX_LAM_BYTES) { s.notify('Choose a project smaller than 64 MB.', 'error'); return; }
        await loadProject(await file.arrayBuffer(), true); return;
      }
      if (s.view === 'home') await openDocument(createProject('blank'));
      if (/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)) {
        const clip = await audioFromFile(file, useEditor.getState().frame); useEditor.getState().addAudio(clip); s.notify('Sound added. Press play to hear it with your animation.'); return;
      }
      const image = await imageFromFile(file), p = useEditor.getState().project;
      const scale = Math.min(1, p.width * 0.5 / image.width, p.height * 0.6 / image.height);
      s.addItem(createItem('image', { name: file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Artwork', x: p.width / 2, y: p.height / 2, width: image.width, height: image.height, scaleX: scale, scaleY: scale, imageData: image.data }));
      s.notify('Artwork imported. Animate it directly, or attach it to a rig joint in the inspector.');
    } catch (error) { s.notify(error instanceof Error ? error.message : 'Could not import this file.', 'error'); }
    finally { s.setBusy(false); }
  }, [loadProject]);

  useEffect(() => { void initializeLibrary().catch(() => {}); }, []);
  useEffect(() => {
    if (!ready || view !== 'editor') return;
    useEditor.getState().setSaveStatus('saving');
    const timer = setTimeout(() => { void flushProject().catch(error => useEditor.getState().notify(`${error.message || 'Local storage is unavailable.'} Export a .lam copy to keep your changes.`, 'error')); }, 700);
    return () => clearTimeout(timer);
  }, [project, ready, view]);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(preferences)); } catch { /* Preferences also live in the durable library. */ }
    document.documentElement.dataset.theme = preferences.theme;
    if (ready) { const timer = setTimeout(() => { void flushProject().catch(() => {}); }, 300); return () => clearTimeout(timer); }
  }, [preferences, ready]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { const s = useEditor.getState(); if (!window.luno && (hasUnsavedProject() || s.saveStatus === 'error' || !!s.blockReason || s.busy || s.interacting)) { event.preventDefault(); event.returnValue = ''; } };
    const visibility = () => { if (document.visibilityState === 'hidden') { useEditor.getState().setPlaying(false); if (useEditor.getState().libraryReady) void flushProject().catch(() => {}); } };
    window.addEventListener('beforeunload', unload); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (!playing || view !== 'editor') return;
    const s = useEditor.getState(), area = s.project.workArea; const startFrame = s.frame < area.start || s.frame > area.end ? area.start : s.frame;
    let startTime: number | null = null, request = 0;
    const animate = (time: number) => {
      if (startTime === null) startTime = time; const current = useEditor.getState();
      const next = startFrame + Math.floor((time - startTime) / 1000 * current.project.fps), work = current.project.workArea;
      if (next > work.end && !current.preferences.loop) { current.setFrame(work.end); current.setPlaying(false); return; }
      const nextFrame = next > work.end ? work.start + (next - work.start) % (work.end - work.start + 1) : next;
      if (current.frame !== nextFrame) current.setFrame(nextFrame); request = requestAnimationFrame(animate);
    };
    request = requestAnimationFrame(animate); return () => cancelAnimationFrame(request);
  }, [playing, view]);
  useEffect(() => {
    const api = window.luno; if (!api) return;
    const unsubFile = api.onProjectFile(raw => { void loadProject(raw); });
    const unsubPrepare = api.onPrepare(async request => {
      const s = useEditor.getState();
      if (s.busy || s.interacting || (request.reason === 'update' && (s.playing || !!document.querySelector('[role=dialog]:not(.updates-modal)'))) || s.blockReason) { api.preparationResult(request.id, false, 'Finish your current operation before restarting.'); return; }
      (document.activeElement as HTMLElement | null)?.blur?.();
      s.setBlocked(request.reason === 'update' ? 'Saving your library before the update…' : 'Saving your latest changes…');
      try { await flushProject(true); api.preparationResult(request.id, true); }
      catch (error) { api.preparationResult(request.id, false, error instanceof Error ? error.message : 'Your durable save did not finish.'); s.setBlocked(null); }
    });
    const unsubResume = api.onResume(() => useEditor.getState().setBlocked(null));
    void initializeLibrary().then(() => api.ready()).catch(() => {});
    return () => { unsubFile(); unsubPrepare(); unsubResume(); };
  }, [loadProject]);
  useEffect(() => {
    const api = window.luno;
    const send = () => { const s = useEditor.getState(); api?.updater.activity({ busy: s.busy || !s.libraryReady || !!s.blockReason || !!document.querySelector('[role=dialog]:not(.updates-modal)'), playing: s.playing, interacting: s.interacting, dirty: hasUnsavedProject() || s.saveStatus === 'error', lastActivity: lastActivity.current }); };
    const activity = () => { lastActivity.current = Date.now(); send(); };
    const pointerActivity = () => { if (Date.now() - lastActivity.current > 1000) activity(); };
    document.addEventListener('pointermove', pointerActivity, true); document.addEventListener('wheel', activity, true);
    document.addEventListener('pointerdown', activity, true); document.addEventListener('keydown', activity, true); document.addEventListener('input', activity, true);
    const timer = setInterval(send, 1000); const unsubscribe = useEditor.subscribe(send); send();
    return () => { clearInterval(timer); unsubscribe(); document.removeEventListener('pointermove', pointerActivity, true); document.removeEventListener('wheel', activity, true); document.removeEventListener('pointerdown', activity, true); document.removeEventListener('keydown', activity, true); document.removeEventListener('input', activity, true); };
  }, []);
  useEffect(() => { void window.luno?.updater.setAutomatic(preferences.automaticUpdates).catch(() => {}); }, [preferences.automaticUpdates]);
  useEffect(() => {
    const command = (value: string) => {
      const s = useEditor.getState(); if (s.blockReason || s.busy || s.dialog) return;
      if (['open', 'new', 'setup', 'export', 'save'].includes(value)) (document.activeElement as HTMLElement | null)?.blur?.();
      if (value === 'open') void onOpen(); else if (value === 'new') s.setDialog('new'); else if (value === 'setup') s.setDialog('setup'); else if (value === 'help') s.setDialog('help'); else if (value === 'updates') s.setDialog('updates');
      else if (s.view === 'editor') { if (value === 'save') void onSave(); else if (value === 'export') s.setDialog('export'); else if (value === 'undo') s.undo(); else if (value === 'redo') s.redo(); }
    };
    const unsubscribe = window.luno?.onCommand(command);
    const keys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement, s = useEditor.getState();
      if (event.defaultPrevented || s.dialog || s.blockReason || s.busy || s.interacting) return;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'p') { event.preventDefault(); (document.activeElement as HTMLElement | null)?.blur?.(); s.setDialog('commands'); return; }
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
        if ((event.metaKey || event.ctrlKey) && key === 's' && s.view === 'editor') { event.preventDefault(); void onSave(); }
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        if (['s', 'o', 'n', 'z', 'y', 'd', 'e', 'g', 'a', 'c', 'v', 'home', '0', '+', '=', '-', '[', ']', ','].includes(key)) event.preventDefault();
        if (key === 'o') void onOpen(); else if (key === 'n') event.shiftKey && s.view === 'editor' ? s.addScene() : s.setDialog('new');
        else if (s.view === 'editor') {
          if (key === 's') void onSave(); else if (key === 'e') s.setDialog('export'); else if (key === 'z') event.shiftKey ? s.redo() : s.undo(); else if (key === 'y') s.redo(); else if (key === 'd') s.duplicateSelected();
          else if (key === 'g') event.shiftKey ? s.ungroupSelected() : s.groupSelected(); else if (key === 'a') s.selectAll(); else if (key === 'c') s.copyKeys(); else if (key === 'v') s.pasteKeys(); else if (key === 'home') void goHome();
          else if (key === '0') { s.setZoom(100); s.setPan({ x: 0, y: 0 }); }
          else if (key === '+' || key === '=') s.setZoom(s.zoom * 1.25); else if (key === '-') s.setZoom(s.zoom / 1.25);
          else if (key === ',') s.setDialog('settings'); else if ((key === '[' || key === ']') && s.selectedId) s.moveLayer(s.selectedId, key === ']' ? 'up' : 'down');
        }
        return;
      }
      if (key === '?' || key === 'f1') { event.preventDefault(); s.setDialog('help'); }
      if (s.view !== 'editor') return;
      const tools: Record<string, Tool> = { v: 'select', h: 'hand', b: 'pen', r: 'rectangle', o: 'ellipse', g: 'rig', t: 'text', c: 'camera' };
      if (tools[key]) { s.setTool(tools[key]); if (key === 'g') s.setPreference('showBones', true); }
      if (key === 'tab' && (target === document.body || !!target.closest('.stage-area'))) { event.preventDefault(); useWorkspace.getState().toggleFocus(); }
      if (key === '<' || key === '>' || key === ',' || key === '.') { event.preventDefault(); s.setPlaying(false); s.setFrame(s.frame + (key === '<' || key === ',' ? -1 : 1)); }
      if (key === ' ') { event.preventDefault(); s.setPlaying(!s.playing); }
      if (key === 'k') s.addKeyframe(); if (key === 'u') s.setPreference('onionSkin', !s.preferences.onionSkin);
      if (key === 'f6') { event.preventDefault(); s.duplicateCel(); } if (key === 'f7') { event.preventDefault(); s.blankCel(); }
      if (key === 'delete' || key === 'backspace') { event.preventDefault(); s.keySelection.length ? s.deleteKeys() : s.deleteSelected(); }
      if (key === 'arrowleft' || key === 'arrowright') { event.preventDefault(); s.setPlaying(false); s.setFrame(s.frame + (key === 'arrowleft' ? -1 : 1) * (event.shiftKey ? 12 : 1)); }
      if (key === '[') s.setWorkArea(s.frame, Math.max(s.frame, s.project.workArea.end)); if (key === ']') s.setWorkArea(Math.min(s.frame, s.project.workArea.start), s.frame);
      if (key === 'escape') { s.select(null); useEditor.setState({ keySelection: [] }); }
    };
    window.addEventListener('keydown', keys); return () => { window.removeEventListener('keydown', keys); unsubscribe?.(); };
  }, [onOpen, onSave]);

  return <><SoundPlayback /><div className={`app-shell ${view === 'home' ? 'home-mode' : ''}`} inert={!!blocked} aria-busy={busy || !!blocked} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && !useEditor.getState().dialog && !useEditor.getState().blockReason && !useEditor.getState().busy && !useEditor.getState().interacting) void importFile(file); }}>
    {view === 'home' ? <ProjectHome onOpen={() => void onOpen()} /> : <>
      <Header onOpen={() => void onOpen()} onSave={() => void onSave()} onImport={onImport} onImportAudio={onImportAudio} />
      <StudioWorkspace onImport={onImport} onImportAudio={onImportAudio} /><StudioStatus />
    </>}
    <Toast /><UpdateBanner />
    {dialog === 'commands' ? <CommandPalette onOpen={() => void onOpen()} onSave={() => void onSave()} onImport={onImport} onImportAudio={onImportAudio} /> : <Suspense fallback={<div className="dialog-loading" role="status">Loading panel…</div>}>{dialog && <Dialogs />}</Suspense>}

    <input ref={inputProject} type="file" className="visually-hidden" aria-label="Open Luno project file" accept=".lam,.luno,.json" onChange={async e => { const file = e.target.files?.[0]; if (file) await importFile(file); e.target.value = ''; }} />
    <input ref={inputImage} type="file" className="visually-hidden" aria-label="Import image file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={async e => { const file = e.target.files?.[0]; if (file) await importFile(file); e.target.value = ''; }} />
    <input ref={inputAudio} type="file" className="visually-hidden" aria-label="Import audio file" accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,.webm" onChange={async e => { const file = e.target.files?.[0]; if (file) await importFile(file); e.target.value = ''; }} />
  </div>{blocked && <div className="safe-operation-overlay" role="status" aria-live="polite"><div><span><RefreshCw size={25} className="spin" /></span><h2>{blocked}</h2><p>Do not close Luno until this operation completes.</p></div></div>}</>;
}

function SoundPlayback() {
  const project = useEditor(s => s.project), frame = useEditor(s => s.frame), playing = useEditor(s => s.playing), view = useEditor(s => s.view);
  const audio = useRef<AudioPlayback | null>(null);
  useEffect(() => { audio.current ??= new AudioPlayback(); audio.current.update(project, frame, playing && view === 'editor', () => useEditor.getState().notify('Your browser blocked sound playback. Click Play again, or use the desktop app.', 'info')); }, [project, frame, playing, view]);
  useEffect(() => () => audio.current?.dispose(), []);
  return null;
}
