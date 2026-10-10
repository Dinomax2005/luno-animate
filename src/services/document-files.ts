import { create } from 'zustand';
import { sha256 } from '@noble/hashes/sha2.js';
import { decodeLam, encodeLam, MAX_LAM_BYTES } from '../engine/lam';
import { safeName, saveProject as exportCopy } from '../engine/files';
import { parseProject } from '../engine/project';
import type { Project } from '../engine/types';

export interface NativeFileTarget { token: string; name: string; displayPath: string; documentId: string }
export interface NativeOpenedFile { data: Uint8Array; filename: string; target: NativeFileTarget | null }
export interface WritableFileHandle {
  name: string; getFile: () => Promise<File>;
  queryPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
  createWritable: () => Promise<{ write: (data: Uint8Array) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> }>;
}
export interface BrowserFileTarget { handle: WritableFileHandle; name: string; documentId: string; hash: string; lastModified: number; size: number }
export interface BrowserOpenedFile { data: Uint8Array; filename: string; browserTarget: BrowserFileTarget | null }
export type FileSource = { kind: 'native'; target: NativeFileTarget } | { kind: 'browser'; target: BrowserFileTarget };
export type FileLink = FileSource & { savedContent: string };
const hex = (data: Uint8Array) => Array.from(sha256(data), b => b.toString(16).padStart(2, '0')).join('');
const contentCache = new WeakMap<Project, string>();
function contentKey(project: Project) {
  let value = contentCache.get(project);
  if (!value) {
    let text = JSON.stringify(project);
    try { text = JSON.stringify(parseProject(text, false)); } catch { /* Invalid edits remain dirty; Save reports validation errors without crashing the UI. */ }
    value = hex(new TextEncoder().encode(text)); contentCache.set(project, value);
  }
  return value;
}
// Capabilities and browser handles are session-only, keyed by the actual library document ID.
export const useDocumentFiles = create<{ links: Record<string, FileLink>; savingId: string | null; setSaving: (id: string | null) => void; errors: Record<string, string>; setError: (id: string, error: string | null) => void; bind: (project: Project, source: FileSource) => void; forget: (id: string) => void; reset: () => void }>(set => ({
  links: {}, savingId: null, setSaving: savingId => set({ savingId }), errors: {},
  setError: (id, error) => set(s => ({ errors: error ? { ...s.errors, [id]: error } : Object.fromEntries(Object.entries(s.errors).filter(([key]) => key !== id)) })),
  bind: (project, source) => set(s => ({ links: { ...s.links, [project.id]: { ...source, savedContent: contentKey(project) } }, errors: Object.fromEntries(Object.entries(s.errors).filter(([key]) => key !== project.id)) })),
  forget: id => set(s => ({ links: Object.fromEntries(Object.entries(s.links).filter(([key]) => key !== id)), errors: Object.fromEntries(Object.entries(s.errors).filter(([key]) => key !== id)) })),
  reset: () => set({ links: {}, errors: {}, savingId: null }),
}));
export function fileIsDirty(project: Project, link?: FileLink) { return !!link && link.savedContent !== contentKey(project); }
export function linkedFileName(link?: FileLink) { return link?.target.name ?? null; }
function canUseBrowserPicker() {
  if (window.luno || !window.isSecureContext) return false;
  try { return window.top === window || window.top?.location.origin === window.location.origin; } catch { return false; }
}
export function browserCanOpenFiles() { return canUseBrowserPicker() && typeof window.showOpenFilePicker === 'function'; }
function cancelled(error: unknown) { return !!error && typeof error === 'object' && 'name' in error && error.name === 'AbortError'; }
async function fileData(handle: WritableFileHandle) {
  const file = await handle.getFile();
  if (file.size > MAX_LAM_BYTES) throw new Error('Choose a project smaller than 64 MB.');
  const data = new Uint8Array(await file.arrayBuffer());
  return { file, data, hash: hex(data) };
}
export async function openBrowserFile(): Promise<BrowserOpenedFile | null> {
  if (!window.showOpenFilePicker) return null;
  try {
    const [handle] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'Luno Animate document', accept: { 'application/vnd.luno.lam': ['.lam', '.luno', '.json'] } }] });
    if (!handle) return null;
    const { file, data, hash } = await fileData(handle);
    const project = /\.lam$/i.test(file.name) ? decodeLam(data) : null;
    return { data, filename: file.name, browserTarget: project ? { handle, name: file.name, documentId: project.id, hash, lastModified: file.lastModified, size: file.size } : null };
  } catch (error) { if (cancelled(error)) return null; throw error; }
}
async function writeBrowserFile(target: BrowserFileTarget, data: Uint8Array) {
  const permission = await target.handle.queryPermission?.({ mode: 'readwrite' });
  if (permission && permission !== 'granted' && await target.handle.requestPermission?.({ mode: 'readwrite' }) !== 'granted') throw new Error('Write permission was not granted. Your original file is unchanged. Use Save As.');
  const current = await fileData(target.handle);
  if (current.hash !== target.hash || current.file.lastModified !== target.lastModified || current.file.size !== target.size) throw new Error('The opened file changed on disk. Reopen it or use Save As; the external changes were not overwritten.');
  const writer = await target.handle.createWritable();
  try { await writer.write(data); await writer.close(); }
  catch (error) { await writer.abort().catch(() => {}); throw error; }
  const after = await fileData(target.handle);
  if (after.hash !== hex(data)) throw new Error('The saved file could not be verified. Keep your library copy and use Save As.');
  return { ...target, hash: after.hash, lastModified: after.file.lastModified, size: after.file.size };
}
export type SaveResult = { kind: 'saved'; name: string } | { kind: 'copy'; name: string } | { kind: 'cancelled' };
export async function saveDocument(project: Project, saveAs = false): Promise<SaveResult> {
  const link = useDocumentFiles.getState().links[project.id];
  if (!saveAs && link) {
    // Collision-safe library imports keep their own ID; the external document keeps its original identity.
    const data = encodeLam({ ...project, id: link.target.documentId });
    const source: FileSource = link.kind === 'native'
      ? { kind: 'native', target: await window.luno!.documents!.save(link.target.token, data) }
      : { kind: 'browser', target: await writeBrowserFile(link.target, data) };
    useDocumentFiles.getState().bind(project, source);
    return { kind: 'saved', name: source.target.name };
  }
  const data = encodeLam(project);
  if (window.luno?.documents) {
    const target = await window.luno.documents.saveAs(data, safeName(project.name));
    if (!target) return { kind: 'cancelled' };
    useDocumentFiles.getState().bind(project, { kind: 'native', target });
    return { kind: 'saved', name: target.name };
  }
  if (canUseBrowserPicker() && window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: `${safeName(project.name)}.lam`, types: [{ description: 'Luno Animate document', accept: { 'application/vnd.luno.lam': ['.lam'] } }] });
      if (!/\.lam$/i.test(handle.name)) throw new Error('Choose a .lam filename. Other file formats are not replaced.');
      const before = await fileData(handle);
      const target = await writeBrowserFile({ handle, name: handle.name, documentId: project.id, hash: before.hash, lastModified: before.file.lastModified, size: before.file.size }, data);
      useDocumentFiles.getState().bind(project, { kind: 'browser', target });
      return { kind: 'saved', name: target.name };
    } catch (error) { if (cancelled(error)) return { kind: 'cancelled' }; throw error; }
  }
  // A download cannot grant permission to overwrite the original file. Never claim it did.
  const copied = await exportCopy(project);
  return copied ? { kind: 'copy', name: `${safeName(project.name)}.lam` } : { kind: 'cancelled' };
}
