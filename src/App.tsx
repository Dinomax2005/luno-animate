import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { StartupPopup } from './components/StartupPopup';
import { Header, Toast } from './components/Header';
import { StudioWorkspace, StudioStatus } from './components/studio/Workspace';
import { CommandPalette } from './components/studio/CommandPalette';
import { useWorkspace } from './store/workspace';
import { ProjectHome } from './components/home/ProjectHome';
import { UpdateBanner } from './components/Updates';
import { usePaint } from './store/paint';
import { useEditor, PREFS_KEY } from './store/editor';
import { createItem, createProject } from './engine/project';
import { readProjectData, MAX_LAM_BYTES } from './engine/lam';
import { imageFromFile, saveProject } from './engine/files';
import { flushProject, goHome, hasUnsavedProject, initializeLibrary, openDocument } from './services/library';
import { AudioPlayback, audioFromFile } from './services/audio';
import { browserCanOpenFiles, openBrowserFile, saveDocument, useDocumentFiles, fileIsDirty, type FileSource, type NativeOpenedFile } from './services/document-files';
import { presentLaunch, useLaunch } from './services/launch';
import type { Tool } from './engine/types';
const Dialogs = lazy(() => import('./components/Dialogs').then(module => ({ default: module.Dialogs })));

export default function App() {
  const project = useEditor(s => s.project), preferences = useEditor(s => s.preferences), playing = useEditor(s => s.playing);
  const busy = useEditor(s => s.busy);
  const dialog = useEditor(s => s.dialog), view = useEditor(s => s.view), ready = useEditor(s => s.libraryReady), blocked = useEditor(s => s.blockReason);
  const [bootPhase, setBootPhase] = useState<string | null>('Opening your local project library…'), [bootError, setBootError] = useState<string | null>(null), [bootAttempt, setBootAttempt] = useState(0);
  const booting = useRef(true); booting.current = !!bootPhase;
  const [videoProgress, setVideoProgress] = useState<{ value: number; message: string } | null>(null), videoAbort = useRef<AbortController | null>(null);
  const inputVideo = useRef<HTMLInputElement>(null);
  const inputProject = useRef<HTMLInputElement>(null), inputImage = useRef<HTMLInputElement>(null), inputAudio = useRef<HTMLInputElement>(null);
  const lastActivity = useRef(Date.now());
  const associationTask = useRef<Promise<boolean> | null>(null), associationSeen = useRef(false);
  const performSave = useCallback(async (kind: 'save' | 'save-as' | 'copy') => {
    const s = useEditor.getState(); if (s.view !== 'editor' || s.busy || s.blockReason || s.interacting) return;
    (document.activeElement as HTMLElement | null)?.blur?.(); s.setBusy(true);
    const snapshot = useEditor.getState().project; useDocumentFiles.getState().setSaving(snapshot.id); s.clearToast();
    try {
      if (kind === 'copy') {
        s.notify(await saveProject(snapshot) ? 'Exported a .lam copy. Your linked Save destination is unchanged.' : 'Copy export cancelled. Your original file is unchanged.', 'info');
      } else {
        // An unavailable autosave store must not prevent an explicit portable save of the canvas.
        let localError: unknown; try { await flushProject(); } catch (error) { localError = error; }
        const result = await saveDocument(snapshot, kind === 'save-as');
        if (result.kind === 'saved') s.notify(localError ? `Saved ${result.name}, but library autosave failed. Keep this .lam file and check available storage.` : `Saved ${result.name}.`, localError ? 'error' : 'success');
        else if (result.kind === 'cancelled') s.notify('Save cancelled. The original file is unchanged; your edits remain in the local library.', 'info');
        else s.notify('Downloaded a .lam copy. This browser cannot overwrite the original; use the desktop app or a browser with file-system access.', 'info');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the project.';
      useDocumentFiles.getState().setError(snapshot.id, message); s.notify(message, 'error');
    } finally { useDocumentFiles.getState().setSaving(null); s.setBusy(false); }
  }, []);
  const onSave = useCallback(() => performSave('save'), [performSave]);
  const onSaveAs = useCallback(() => performSave('save-as'), [performSave]);
  const onSaveCopy = useCallback(() => performSave('copy'), [performSave]);
  const loadProject = useCallback(async (raw: string | Uint8Array | ArrayBuffer, ownsBusyOperation = false, source?: FileSource): Promise<boolean> => {
    const state = useEditor.getState();
    if (state.blockReason || state.interacting || state.busy && !ownsBusyOperation || state.dialog && !['start', 'whats-new'].includes(state.dialog)) { state.notify('Finish the current operation before opening another project. Your file is unchanged.', 'info'); return false; }
    try {
      const parsed = readProjectData(raw); await openDocument(parsed, true, !!source);
      if (source) useDocumentFiles.getState().bind(useEditor.getState().project, source);
      useLaunch.setState({ pendingStart: false }); state.setDialog(null);
      state.notify(source ? `Opened ${source.target.name}. Save will update this file.` : `“${parsed.name}” is in your library. Use Save As to choose a writable .lam file.`);
      return true;
    } catch (error) { state.notify(error instanceof Error ? error.message : 'Could not read this project.', 'error'); return false; }
  }, []);
  const loadNativeFile = useCallback((file: NativeOpenedFile | Uint8Array, ownsBusyOperation = false) => file instanceof Uint8Array
    ? loadProject(file, ownsBusyOperation)
    : loadProject(file.data, ownsBusyOperation, file.target ? { kind: 'native', target: file.target } : undefined), [loadProject]);
  const onOpen = useCallback(async () => {
    const s = useEditor.getState(); if (s.busy || s.blockReason || s.interacting) return;
    if (!window.luno && !browserCanOpenFiles()) { inputProject.current?.click(); return; }
    s.setBusy(true);
    try {
      if (window.luno) {
        const file = await (window.luno.documents ? window.luno.documents.open() : window.luno.openProject());
        if (file) await loadNativeFile(file, true);
      } else {
        const file = await openBrowserFile();
        if (file) await loadProject(file.data, true, file.browserTarget ? { kind: 'browser', target: file.browserTarget } : undefined);
      }
    } catch (error) { s.notify(error instanceof Error ? error.message : 'Could not open the project file.', 'error'); }
    finally { s.setBusy(false); }
  }, [loadProject, loadNativeFile]);
  const onImportVideo = useCallback(() => inputVideo.current?.click(), []);
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
      const isVideo = /\.(mp4|mov|m4v)$/i.test(file.name) || /\.webm$/i.test(file.name) && (file.type.startsWith('video/') || s.project.animationMode === 'video-editing');
      if (s.view === 'home') await openDocument(createProject('blank', isVideo ? 'video-editing' : 'rigged'));
      if (isVideo) {
        if (useEditor.getState().project.animationMode === 'frame-by-frame') throw new Error('Import footage into a Video editing or Rig / motion document. Your hand-drawn frames are unchanged.');
        const snapshot = useEditor.getState().project, frame = useEditor.getState().frame;
        videoAbort.current = new AbortController(); setVideoProgress({ value: 0, message: 'Reading footage…' });
        let lastProgress = 0;
        const result = await (await import('./services/video-import')).importVideo(file, snapshot, frame, (value, message) => {
          // Keep decoder throughput independent of full studio redraws.
          const now = performance.now(); if (value === 0 || value >= 0.85 || now - lastProgress >= 100) { lastProgress = now; setVideoProgress({ value, message }); }
        }, videoAbort.current.signal);
        videoAbort.current.signal.throwIfAborted();
        if (useEditor.getState().project !== snapshot) throw new Error('The active document changed during import. Please try again.');
        s.addVideo(result.asset, result.item, result.audio); s.notify('Footage imported as an embedded proxy. Open Timing to trim, split, or add fades.'); return;
      }
      if (/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)) {
        const clip = await audioFromFile(file, useEditor.getState().frame); useEditor.getState().addAudio(clip); s.notify('Sound added. Press play to hear it with your animation.'); return;
      }
      const image = await imageFromFile(file), p = useEditor.getState().project;
      const scale = Math.min(1, p.width * 0.5 / image.width, p.height * 0.6 / image.height);
      s.addItem(createItem('image', { name: file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Artwork', x: p.width / 2, y: p.height / 2, width: image.width, height: image.height, scaleX: scale, scaleY: scale, imageData: image.data }));
      s.notify('Artwork imported. Animate it directly, or attach it to a rig joint in the inspector.');
    } catch (error) { s.notify(videoAbort.current?.signal.aborted ? 'Video import cancelled. No clips were added.' : error instanceof Error ? error.message : 'Could not import this file.', videoAbort.current?.signal.aborted ? 'info' : 'error'); }
    finally { videoAbort.current = null; setVideoProgress(null); s.setBusy(false); }
  }, [loadProject]);

  useEffect(() => {
    let mounted = true; const started = performance.now();
    setBootError(null); setBootPhase('Opening your local project library…');
    void (async () => {
      await initializeLibrary(); if (!mounted) return;
      setBootPhase('Preparing the animation and video workspace…');
      const result = await window.luno?.ready(); if (!mounted) return;
      if (associationTask.current) await associationTask.current;
      // Desktop uses its own small native launcher; the browser has a compact fallback.
      if (!window.luno?.startup) await new Promise(resolve => setTimeout(resolve, Math.max(0, 450 - (performance.now() - started))));
      if (mounted) {
        setBootPhase(null); presentLaunch(associationSeen.current || !!result?.openedFile);
        // The first ready workspace paint is prepared before the launcher closes.
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (mounted) await window.luno?.startup?.complete();
      }
    })().catch(error => { if (mounted) { setBootPhase('Your studio could not open'); setBootError(error instanceof Error ? error.message : 'Could not open the local library. Your files have not been changed.'); } });
    return () => { mounted = false; };
  }, [bootAttempt]);
  useEffect(() => { if (bootPhase) window.luno?.startup?.report({ phase: bootPhase, error: bootError }); }, [bootPhase, bootError]);
  useEffect(() => window.luno?.startup?.onRetry(() => setBootAttempt(n => n + 1)), []);
  useEffect(() => {
    if (!ready || view !== 'editor') return;
    useEditor.getState().setSaveStatus('saving');
    const timer = setTimeout(() => { void flushProject().catch(error => useEditor.getState().notify(`${error.message || 'Local storage is unavailable.'} Export a .lam copy to keep your changes.`, 'error')); }, 700);
    return () => clearTimeout(timer);
  }, [project, ready, view]);
  const paintUpdatedAt = usePaint(s => s.updatedAt);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(preferences)); } catch { /* Preferences also live in the durable library. */ }
    document.documentElement.dataset.theme = preferences.theme;
    if (ready) { const timer = setTimeout(() => { void flushProject().catch(() => {}); }, 300); return () => clearTimeout(timer); }
  }, [preferences, ready, paintUpdatedAt]);
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
    const unsubFile = api.onProjectFile(file => { associationSeen.current = true; associationTask.current = loadNativeFile(file); });
    const unsubPrepare = api.onPrepare(async request => {
      const s = useEditor.getState();
      if (s.busy || s.interacting || (request.reason === 'update' && (s.playing || !!document.querySelector('[role=dialog]:not(.updates-modal)'))) || s.blockReason) { api.preparationResult(request.id, false, 'Finish your current operation before restarting.'); return; }
      (document.activeElement as HTMLElement | null)?.blur?.();
      s.setBlocked(request.reason === 'update' ? 'Saving your library before the update…' : 'Saving your latest changes…');
      try { await flushProject(true); api.preparationResult(request.id, true); }
      catch (error) { api.preparationResult(request.id, false, error instanceof Error ? error.message : 'Your durable save did not finish.'); s.setBlocked(null); }
    });
    const unsubResume = api.onResume(() => useEditor.getState().setBlocked(null));
    return () => { unsubFile(); unsubPrepare(); unsubResume(); };
  }, [loadNativeFile]);
  useEffect(() => {
    const api = window.luno;
    const send = () => { const s = useEditor.getState(); api?.updater.activity({ busy: booting.current || s.busy || !s.libraryReady || !!s.blockReason || !!document.querySelector('[role=dialog]:not(.updates-modal)'), playing: s.playing, interacting: s.interacting, dirty: hasUnsavedProject() || s.saveStatus === 'error' || fileIsDirty(s.project, useDocumentFiles.getState().links[s.project.id]), lastActivity: lastActivity.current }); };
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
      const s = useEditor.getState(); if (bootPhase || s.blockReason || s.busy || s.interacting || s.dialog) return;
      if (['open', 'new', 'setup', 'export', 'save', 'save-as', 'save-copy'].includes(value)) (document.activeElement as HTMLElement | null)?.blur?.();
      if (value === 'open') void onOpen(); else if (value === 'new') s.setDialog('new'); else if (value === 'setup') s.setDialog('setup'); else if (value === 'help') s.setDialog('help'); else if (value === 'start') s.setDialog('start'); else if (value === 'whats-new') useLaunch.getState().openNews(); else if (value === 'updates') s.setDialog('updates');
      else if (s.view === 'editor') { if (value === 'brush-studio') { s.setTool('pen'); useWorkspace.getState().setLayout({ showProperties: true }); useWorkspace.setState({ focused: false, popout: window.matchMedia('(max-width: 800px)').matches ? 'properties' : null }); usePaint.getState().requestStudio(); } else if (value === 'paint-layer') s.addPaintLayer(); else if (value === 'paint-swap') usePaint.getState().swapColors(); else if (['paint-brush', 'paint-eraser', 'paint-fill', 'paint-picker'].includes(value)) s.setTool(({ 'paint-brush': 'pen', 'paint-eraser': 'eraser', 'paint-fill': 'bucket', 'paint-picker': 'eyedropper' } as const)[value as 'paint-brush']); else if (value === 'save') void onSave(); else if (value === 'save-as') void onSaveAs(); else if (value === 'save-copy') void onSaveCopy(); else if (value === 'export') s.setDialog('export'); else if (value === 'undo') s.undo(); else if (value === 'redo') s.redo(); }
    };
    const unsubscribe = window.luno?.onCommand(command);
    const keys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement, s = useEditor.getState();
      if (bootPhase || event.defaultPrevented || s.dialog || s.blockReason || s.busy || s.interacting) return;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'b' && s.view === 'editor') { event.preventDefault(); s.setTool('pen'); useWorkspace.getState().setLayout({ showProperties: true }); useWorkspace.setState({ focused: false, popout: window.matchMedia('(max-width: 800px)').matches ? 'properties' : null }); usePaint.getState().requestStudio(); return; }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'p') { event.preventDefault(); (document.activeElement as HTMLElement | null)?.blur?.(); s.setDialog('commands'); return; }
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
        if ((event.metaKey || event.ctrlKey) && key === 's' && s.view === 'editor') { event.preventDefault(); void (event.shiftKey ? onSaveAs() : onSave()); }
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        if (['s', 'o', 'n', 'z', 'y', 'd', 'e', 'g', 'a', 'c', 'v', 'home', '0', '+', '=', '-', '[', ']', ','].includes(key)) event.preventDefault();
        if (key === 'o') void onOpen(); else if (key === 'n') event.shiftKey && s.view === 'editor' ? s.addScene() : s.setDialog('new');
        else if (s.view === 'editor') {
          if (key === 's') void (event.shiftKey ? onSaveAs() : onSave()); else if (key === 'e') s.setDialog('export'); else if (key === 'z') event.shiftKey ? s.redo() : s.undo(); else if (key === 'y') s.redo(); else if (key === 'd') { if (event.shiftKey && s.selectedId && s.project.animationMode !== 'frame-by-frame') s.editClip(s.selectedId, 'split', s.frame); else if (!event.shiftKey) s.duplicateSelected(); }
          else if (key === 'g') event.shiftKey ? s.ungroupSelected() : s.groupSelected(); else if (key === 'a') s.selectAll(); else if (key === 'c') s.copyKeys(); else if (key === 'v') s.pasteKeys(); else if (key === 'home') void goHome();
          else if (key === '0') { s.setZoom(100); s.setPan({ x: 0, y: 0 }); }
          else if (key === '+' || key === '=') s.setZoom(s.zoom * 1.25); else if (key === '-') s.setZoom(s.zoom / 1.25);
          else if (key === ',') s.setDialog('settings'); else if ((key === '[' || key === ']') && s.selectedId) s.moveLayer(s.selectedId, key === ']' ? 'up' : 'down');
        }
        return;
      }
      if (key === '?' || key === 'f1') { event.preventDefault(); s.setDialog('help'); }
      if (s.view !== 'editor') return;
      const tools: Record<string, Tool> = { v: 'select', h: 'hand', b: 'pen', e: 'eraser', f: 'bucket', i: 'eyedropper', r: 'rectangle', o: 'ellipse', g: 'rig', t: 'text', c: 'camera' };
      if (tools[key]) { s.setTool(tools[key]); if (key === 'g') s.setPreference('showBones', true); }
      if (key === 'tab' && (target === document.body || !!target.closest('.stage-area'))) { event.preventDefault(); useWorkspace.getState().toggleFocus(); }
      if (key === '<' || key === '>' || key === ',' || key === '.') { event.preventDefault(); s.setPlaying(false); s.setFrame(s.frame + (key === '<' || key === ',' ? -1 : 1)); }
      if (key === ' ') { event.preventDefault(); s.setPlaying(!s.playing); }
      if (key === 'k') s.addKeyframe(); if (key === 'u') s.setPreference('onionSkin', !s.preferences.onionSkin);
      if (key === 'f6') { event.preventDefault(); s.project.animationMode === 'frame-by-frame' ? s.nextDrawingFrame('duplicate') : s.duplicateCel(); } if (key === 'f7') { event.preventDefault(); s.project.animationMode === 'frame-by-frame' ? s.nextDrawingFrame('blank') : s.blankCel(); }
      if (key === 'delete' || key === 'backspace') { event.preventDefault(); s.keySelection.length ? s.deleteKeys() : s.deleteSelected(); }
      if (key === 'arrowleft' || key === 'arrowright') { event.preventDefault(); s.setPlaying(false); s.setFrame(s.frame + (key === 'arrowleft' ? -1 : 1) * (event.shiftKey ? 12 : 1)); }
      if (key === 'x') usePaint.getState().swapColors(); if (key === 'd') usePaint.getState().resetColors();
      if ((key === '[' || key === ']') && ['pen', 'eraser'].includes(s.tool)) { event.preventDefault(); const step = s.preferences.brushSize < 10 ? 1 : 5; s.setPreference('brushSize', Math.max(1, Math.min(256, s.preferences.brushSize + (key === '[' ? -step : step)))); return; }
      if (key === '[') s.setWorkArea(s.frame, Math.max(s.frame, s.project.workArea.end)); if (key === ']') s.setWorkArea(Math.min(s.frame, s.project.workArea.start), s.frame);
      if (key === 'escape') { s.select(null); useEditor.setState({ keySelection: [] }); }
    };
    window.addEventListener('keydown', keys); return () => { window.removeEventListener('keydown', keys); unsubscribe?.(); };
  }, [onOpen, onSave, onSaveAs, onSaveCopy, bootPhase]);

  return <><SoundPlayback /><div className={`app-shell ${view === 'home' ? 'home-mode' : ''}`} data-booting={!!bootPhase} inert={!!blocked || !!bootPhase || !!videoProgress} aria-busy={busy || !!blocked || !!bootPhase} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && !useEditor.getState().dialog && !useEditor.getState().blockReason && !useEditor.getState().busy && !useEditor.getState().interacting) void importFile(file); }}>
    {view === 'home' ? <ProjectHome onOpen={() => void onOpen()} /> : <>
      <Header onOpen={() => void onOpen()} onSave={() => void onSave()} onSaveAs={() => void onSaveAs()} onSaveCopy={() => void onSaveCopy()} onImport={onImport} onImportAudio={onImportAudio} onImportVideo={onImportVideo} />
      <StudioWorkspace onImport={onImport} onImportAudio={onImportAudio} onImportVideo={onImportVideo} /><StudioStatus />
    </>}
    <Toast /><UpdateBanner />
    {dialog === 'commands' ? <CommandPalette onOpen={() => void onOpen()} onSave={() => void onSave()} onSaveAs={() => void onSaveAs()} onSaveCopy={() => void onSaveCopy()} onImport={onImport} onImportAudio={onImportAudio} onImportVideo={onImportVideo} /> : <Suspense fallback={<div className="dialog-loading" role="status">Loading panel…</div>}>{dialog && <Dialogs onOpen={() => void onOpen()} />}</Suspense>}

    <input ref={inputProject} type="file" className="visually-hidden" aria-label="Open Luno project file" accept=".lam,.luno,.json" onChange={async e => { const file = e.target.files?.[0]; if (file) await importFile(file); e.target.value = ''; }} />
    <input ref={inputImage} type="file" className="visually-hidden" aria-label="Import image file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={async e => { const file = e.target.files?.[0]; if (file) await importFile(file); e.target.value = ''; }} />
    <input ref={inputVideo} type="file" className="visually-hidden" aria-label="Import video file" accept=".mp4,.webm,.mov,.m4v" onChange={async e => { const file = e.target.files?.[0]; if (file) await importFile(file); e.target.value = ''; }} />
    <input ref={inputAudio} type="file" className="visually-hidden" aria-label="Import audio file" accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,.webm" onChange={async e => { const file = e.target.files?.[0]; if (file) await importFile(file); e.target.value = ''; }} />
  </div>{bootPhase && (!window.luno?.startup || bootError) && <StartupPopup phase={bootPhase} error={bootError} onRetry={() => setBootAttempt(n => n + 1)} />}{videoProgress && <div className="media-import-overlay" role="dialog" aria-modal="true" aria-label="Importing video"><div><img src="./favicon.svg" width="54" height="54" alt="" /><h2>Preparing your footage</h2><p>{videoProgress.message}</p><progress value={videoProgress.value} max={1} aria-label="Video import progress" /><p className="muted-text">Embedded proxies up to 960 px · source file is unchanged</p><button className="button secondary" autoFocus onClick={() => videoAbort.current?.abort()}>Cancel import</button></div></div>}{blocked && <div className="safe-operation-overlay" role="status" aria-live="polite"><div><span><RefreshCw size={25} className="spin" /></span><h2>{blocked}</h2><p>Do not close Luno until this operation completes.</p></div></div>}</>;
}

function SoundPlayback() {
  const project = useEditor(s => s.project), frame = useEditor(s => s.frame), playing = useEditor(s => s.playing), view = useEditor(s => s.view);
  const audio = useRef<AudioPlayback | null>(null);
  useEffect(() => { audio.current ??= new AudioPlayback(); audio.current.update(project, frame, playing && view === 'editor', () => useEditor.getState().notify('Your browser blocked sound playback. Click Play again, or use the desktop app.', 'info')); }, [project, frame, playing, view]);
  useEffect(() => () => audio.current?.dispose(), []);
  return null;
}
