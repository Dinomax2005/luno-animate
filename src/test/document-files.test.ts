import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject, parseProject } from '../engine/project';
import { decodeLam, encodeLam } from '../engine/lam';
import { fileIsDirty, openBrowserFile, saveDocument, useDocumentFiles, type NativeFileTarget, type WritableFileHandle } from '../services/document-files';

const target = (token = 'approved-token', documentId = 'original-id', name = 'Original.lam'): NativeFileTarget => ({ token, documentId, name, displayPath: `/approved/${name}` });
const files = () => useDocumentFiles.getState();
function native(documents: NonNullable<Window['luno']>['documents']) { vi.stubGlobal('luno', { documents }); }
beforeEach(() => { files().reset(); vi.stubGlobal('isSecureContext', true); vi.stubGlobal('luno', undefined); vi.stubGlobal('showSaveFilePicker', undefined); vi.stubGlobal('showOpenFilePicker', undefined); });
afterEach(() => vi.unstubAllGlobals());

function browserHandle(name: string, initial: Uint8Array) {
  let bytes = initial, modified = 1, denied = false, failure = false;
  const abort = vi.fn(async () => {}), write = vi.fn(), close = vi.fn();
  const handle: WritableFileHandle = {
    name,
    getFile: async () => ({ name, size: bytes.length, lastModified: modified, arrayBuffer: async () => bytes.slice().buffer }) as File,
    queryPermission: async () => denied ? 'denied' : 'granted', requestPermission: async () => denied ? 'denied' : 'granted',
    createWritable: vi.fn(async () => {
      let staged: Uint8Array;
      return { write: async (data: Uint8Array) => { write(data); staged = data; }, close: async () => { close(); if (failure) throw new Error('Disk full'); bytes = staged; modified++; }, abort };
    }),
  };
  return { handle, write, close, abort, read: () => bytes, change: (data: Uint8Array) => { bytes = data; modified++; }, deny: () => { denied = true; }, fail: () => { failure = true; } };
}

describe('renderer document destinations', () => {
  it('Save uses the linked token, never asks for a path, and preserves the external document ID', async () => {
    const p = { ...createProject('blank'), id: 'collision-safe-library-id' }, cap = target(); const save = vi.fn(async (_token: string, _data: Uint8Array) => cap), saveAs = vi.fn();
    native({ open: async () => null, save, saveAs }); files().bind(p, { kind: 'native', target: cap });
    const edit = { ...p, name: 'Edited' }; expect(fileIsDirty(edit, files().links[p.id])).toBe(true);
    expect(await saveDocument(edit)).toEqual({ kind: 'saved', name: 'Original.lam' }); expect(saveAs).not.toHaveBeenCalled();
    expect(save.mock.calls[0][0]).toBe(cap.token); expect(decodeLam(save.mock.calls[0][1]).id).toBe('original-id');
    expect(files().links[p.id].target).toMatchObject({ token: cap.token }); expect(fileIsDirty(edit, files().links[p.id])).toBe(false);
  });
  it('Save As rebinds only after a successful write and the next Save uses the new destination', async () => {
    const p = createProject(), cap = target('first', p.id), next = target('second', p.id, 'Chosen.lam');
    const save = vi.fn(async (_token: string, _data: Uint8Array) => next), saveAs = vi.fn(async () => next); native({ open: async () => null, save, saveAs }); files().bind(p, { kind: 'native', target: cap });
    await saveDocument(p, true); expect(files().links[p.id].target).toMatchObject({ token: 'second' }); await saveDocument({ ...p, name: 'Second save' });
    expect(save.mock.calls[0][0]).toBe('second'); expect(saveAs).toHaveBeenCalledTimes(1);
  });
  it('cancelled and failed Save As leave the old destination and file dirty state intact', async () => {
    const p = createProject(), cap = target('first', p.id); files().bind(p, { kind: 'native', target: cap }); const original = files().links[p.id], edit = { ...p, name: 'Unsaved edit' };
    native({ open: async () => null, save: vi.fn(), saveAs: async () => null }); expect(await saveDocument(edit, true)).toEqual({ kind: 'cancelled' }); expect(files().links[p.id]).toBe(original);
    native({ open: async () => null, save: vi.fn(), saveAs: async () => { throw new Error('Disk full'); } }); await expect(saveDocument(edit, true)).rejects.toThrow('Disk full'); expect(files().links[p.id]).toBe(original); expect(fileIsDirty(edit, original)).toBe(true);
  });
  it('a failed direct Save is not treated as saved and never falls back to overwriting another file', async () => {
    const p = createProject(), cap = target('first', p.id), saveAs = vi.fn(); files().bind(p, { kind: 'native', target: cap });
    native({ open: async () => null, save: async () => { throw new Error('Changed on disk'); }, saveAs }); const edit = { ...p, name: 'Unsaved' };
    await expect(saveDocument(edit)).rejects.toThrow('Changed on disk'); expect(fileIsDirty(edit, files().links[p.id])).toBe(true); expect(saveAs).not.toHaveBeenCalled();
  });
  it('a new or duplicated document never inherits another document’s destination', async () => {
    const p = createProject(), cap = target('first', p.id), other = { ...p, id: 'new-document-id' }, save = vi.fn(), saveAs = vi.fn(async () => null);
    files().bind(p, { kind: 'native', target: cap }); native({ open: async () => null, save, saveAs }); await saveDocument(other);
    expect(save).not.toHaveBeenCalled(); expect(saveAs).toHaveBeenCalledTimes(1); expect(files().links[other.id]).toBeUndefined();
  });
  it('dirty status compares actual content, not merely an object identity changed by a library reload', () => {
    const p = createProject(); files().bind(p, { kind: 'native', target: target('first', p.id) }); expect(fileIsDirty(structuredClone(p), files().links[p.id])).toBe(false); expect(fileIsDirty(parseProject(JSON.stringify(p)), files().links[p.id])).toBe(false);
    expect(fileIsDirty({ ...p, name: 'Other' }, files().links[p.id])).toBe(true);
  });
  it('links and errors are explicitly discardable for recovery, deletion, and library restoration', () => {
    const p = createProject(); files().bind(p, { kind: 'native', target: target() }); files().setError(p.id, 'Failure'); files().forget(p.id);
    expect(files().links[p.id]).toBeUndefined(); expect(files().errors[p.id]).toBeUndefined(); files().bind(p, { kind: 'native', target: target() }); files().reset(); expect(files().links).toEqual({});
  });
});
describe('browser file-system access', () => {
  it('overwrites the opened handle on repeated Save and closes each transaction', async () => {
    const p = createProject('blank'), f = browserHandle('Original.lam', encodeLam(p)); vi.stubGlobal('showOpenFilePicker', async () => [f.handle]);
    const opened = await openBrowserFile(); files().bind(p, { kind: 'browser', target: opened!.browserTarget! });
    await saveDocument({ ...p, name: 'First' }); await saveDocument({ ...p, name: 'Second' }); expect(decodeLam(f.read()).name).toBe('Second'); expect(f.close).toHaveBeenCalledTimes(2);
  });
  it('uses Save As for a new document and retains that handle for Save', async () => {
    const p = createProject('blank'), f = browserHandle('Chosen.lam', new Uint8Array()); const picker = vi.fn(async () => f.handle); vi.stubGlobal('showSaveFilePicker', picker);
    await saveDocument(p); await saveDocument({ ...p, name: 'Edited' }); expect(picker).toHaveBeenCalledTimes(1); expect(decodeLam(f.read()).name).toBe('Edited');
  });
  it('leaves the old handle intact when Save As is cancelled', async () => {
    const p = createProject(), f = browserHandle('Original.lam', encodeLam(p)); vi.stubGlobal('showOpenFilePicker', async () => [f.handle]);
    const opened = await openBrowserFile(); files().bind(p, { kind: 'browser', target: opened!.browserTarget! }); const old = files().links[p.id];
    vi.stubGlobal('showSaveFilePicker', async () => { throw new DOMException('Cancelled', 'AbortError'); }); expect(await saveDocument(p, true)).toEqual({ kind: 'cancelled' }); expect(files().links[p.id]).toBe(old); expect(f.write).not.toHaveBeenCalled();
  });
  it('blocks denied permission and external changes before opening a writer', async () => {
    const p = createProject(), f = browserHandle('Original.lam', encodeLam(p)); vi.stubGlobal('showOpenFilePicker', async () => [f.handle]);
    const opened = await openBrowserFile(); files().bind(p, { kind: 'browser', target: opened!.browserTarget! }); f.change(encodeLam({ ...p, name: 'External edit' }));
    await expect(saveDocument(p)).rejects.toThrow('changed on disk'); expect(f.handle.createWritable).not.toHaveBeenCalled();
    f.deny(); await expect(saveDocument(p)).rejects.toThrow('permission'); expect(decodeLam(f.read()).name).toBe('External edit');
  });
  it('aborts a failed writer and does not mark the file saved or rebind it', async () => {
    const p = createProject(), f = browserHandle('Original.lam', encodeLam(p)); vi.stubGlobal('showOpenFilePicker', async () => [f.handle]);
    const opened = await openBrowserFile(); files().bind(p, { kind: 'browser', target: opened!.browserTarget! }); const old = files().links[p.id]; f.fail();
    await expect(saveDocument({ ...p, name: 'Unwritten' })).rejects.toThrow('Disk full'); expect(f.abort).toHaveBeenCalled(); expect(files().links[p.id]).toBe(old); expect(decodeLam(f.read()).name).toBe(p.name);
  });
  it('does not authorize legacy JSON files for direct overwrite', async () => {
    const p = createProject(), f = browserHandle('Legacy.luno', new TextEncoder().encode(JSON.stringify(p))); vi.stubGlobal('showOpenFilePicker', async () => [f.handle]); expect((await openBrowserFile())?.browserTarget).toBeNull();
  });
});
