import { usePaint } from '../store/paint';
import { useEditor, STORAGE_KEY, PREFS_KEY } from '../store/editor';
import { uid, activateScene } from '../engine/project';
import type { Project } from '../engine/types';
import { repository, type RecordPatch } from './repository';
import { useDocumentFiles } from './document-files';
import { useWorkspace, WORKSPACE_KEY } from '../store/workspace';

let boot: Promise<void> | null = null;
let saveQueue: Promise<unknown> = Promise.resolve();
let lastSaved: Project | null = null;
export function hasUnsavedProject() { const s = useEditor.getState(); return s.view === 'editor' && s.project !== lastSaved; }
export async function refreshLibrary() { useEditor.getState().setLibrary(await repository().list()); }
export function initializeLibrary() {
  return boot ??= (async () => {
    const repo = repository(); let records = await repo.list();
    if (localStorage.getItem(STORAGE_KEY)) {
      const old = useEditor.getState().project;
      if (!records.some(r => r.id === old.id)) { await repo.save(old); records = await repo.list(); }
      // Preserve the original as a migration recovery copy, remove only after durable save.
      if (!localStorage.getItem('luno.migrated.v1')) localStorage.setItem('luno.migrated.v1', localStorage.getItem(STORAGE_KEY)!);
      localStorage.removeItem(STORAGE_KEY);
    }
    const settings = await repo.getSettings();
    const state = useEditor.getState(), localPaint = usePaint.getState().settings();
    // Compare before hydrating preferences, whose foreground/size fields also update the painting store.
    const newerLocalPaint = localPaint.updatedAt > (settings.paint?.updatedAt ?? 0);
    if (settings.preferences) useEditor.setState({ preferences: { ...state.preferences, ...settings.preferences } });
    if (newerLocalPaint) usePaint.getState().loadSettings(localPaint);
    else if (settings.paint) usePaint.getState().loadSettings(settings.paint);
    if (settings.lastProjectId && records.some(r => r.id === settings.lastProjectId && !r.deletedAt)) {
      try { const p = await repo.load(settings.lastProjectId); state.replaceProject(p, false); lastSaved = p; state.markSaved(); state.setView('home'); }
      catch { state.notify('Your last project could not be opened. Use Recover prior save in its project menu.', 'error'); }
    }
    state.setLibrary(records);
    // Request persistent browser storage where supported. This never sends artwork over the network.
    if (!window.luno) void navigator.storage?.persist?.().catch(() => {});
  })().catch(error => { boot = null; useEditor.getState().notify(error instanceof Error ? error.message : 'Could not open your project library.', 'error'); throw error; });
}
export function flushProject(withThumbnail = false): Promise<void> {
  const snapshot = useEditor.getState();
  const action = async () => {
    const s = useEditor.getState(); const p = snapshot.project;
    if (snapshot.view === 'editor') {
      if (p !== lastSaved || withThumbnail) {
        s.setSaveStatus('saving'); let thumbnail: string | undefined;
        if (withThumbnail) {
          try { const { exportPng } = await import('../engine/export'); const blob = await exportPng(activateScene(p, p.sceneOrder[0]), 0, Math.min(0.5, 480 / p.width, 300 / p.height)); thumbnail = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); }); }
          catch { /* A failed preview must never block the document save. */ }
        }
        await repository().save(p, thumbnail); lastSaved = p;
      }
      if (useEditor.getState().project === p) s.markSaved();
    }
    await repository().saveSettings({ lastProjectId: snapshot.view === 'editor' ? p.id : (await repository().getSettings()).lastProjectId, preferences: useEditor.getState().preferences, paint: usePaint.getState().settings() });
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(useEditor.getState().preferences)); } catch { /* Durable preferences are also kept in the library. */ }
  };
  const result = saveQueue.then(action); saveQueue = result.catch(() => {});
  return result.catch(error => { useEditor.getState().setSaveStatus('error'); throw error; });
}
export async function goHome() {
  (document.activeElement as HTMLElement | null)?.blur?.();
  useEditor.getState().setBlocked('Saving your project library…');
  try { await flushProject(true); useEditor.getState().setView('home'); await refreshLibrary(); }
  catch (error) { useEditor.getState().notify(`${error instanceof Error ? error.message : 'Save failed.'} Your canvas is still open. Export a .lam copy before leaving.`, 'error'); }
  finally { useEditor.getState().setBlocked(null); }
}
function documentWorkspace(project: Project, newDocument = false) {
  const recommend = (p: Project) => p.animationMode === 'frame-by-frame' ? 'Drawing' as const : p.animationMode === 'video-editing' ? 'Video editing' as const : 'Motion' as const;
  const previous = useEditor.getState().project, workspace = useWorkspace.getState();
  let savedLayout = false; try { savedLayout = !!localStorage.getItem(WORKSPACE_KEY); } catch { /* Preferences must not block opening work. */ }
  // New document types get contextual defaults. Reopening work must not erase
  // the user's dock dimensions, visibility choices, or explicit workspace.
  if (newDocument || !savedLayout || previous.animationMode !== project.animationMode && workspace.workspace === recommend(previous)) workspace.preset(recommend(project));
}
export async function openLibraryProject(id: string) {
  useEditor.getState().setBlocked('Opening document…');
  try {
  await flushProject(true); const project = await repository().load(id);
  documentWorkspace(project); useEditor.getState().replaceProject(project, false); lastSaved = project; useEditor.getState().markSaved();
  await repository().saveSettings({ lastProjectId: id, preferences: useEditor.getState().preferences, paint: usePaint.getState().settings() });
  } finally { useEditor.getState().setBlocked(null); }
}
export async function openDocument(project: Project, imported = false, preserveName = false) {
  (document.activeElement as HTMLElement | null)?.blur?.();
  useEditor.getState().setBlocked('Giving your next idea a safe home…');
  try {
  await flushProject(true);
  const records = await repository().list();
  if (imported && records.some(r => r.id === project.id)) project = { ...project, id: uid(), name: preserveName ? project.name : `${project.name} (imported)`.slice(0, 100) };
  await repository().save(project); documentWorkspace(project, !imported); useEditor.getState().replaceProject(project, false); lastSaved = project; useEditor.getState().markSaved();
  await repository().saveSettings({ lastProjectId: project.id, preferences: useEditor.getState().preferences, paint: usePaint.getState().settings() });
  } finally { useEditor.getState().setBlocked(null); }
}
export async function changeRecord(id: string, patch: RecordPatch) { await repository().patch(id, patch); await refreshLibrary(); }
export async function duplicateProject(id: string) {
  const original = await repository().load(id); const project = { ...original, id: uid(), name: `${original.name} copy`.slice(0, 100) };
  const originalRecord = useEditor.getState().projects.find(r => r.id === id);
  await repository().save(project, originalRecord?.thumbnail); await refreshLibrary(); useEditor.getState().notify('A separate project copy is ready.');
}
export async function recoverProject(id: string) { useDocumentFiles.getState().forget(id); const p = await repository().recover(id); await refreshLibrary(); useEditor.getState().replaceProject(p, false); lastSaved = p; useEditor.getState().markSaved(); useEditor.getState().notify('Recovered a prior save. Your other projects are unchanged.'); }
