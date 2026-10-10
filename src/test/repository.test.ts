import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import { BrowserRepository } from '../services/repository';
import { createProject } from '../engine/project';
let repo: BrowserRepository, name: string;
beforeEach(() => { name = `luno-test-${crypto.randomUUID()}`; repo = new BrowserRepository(name); });
afterEach(async () => { await repo.close(); });
describe('persistent project library', () => {
  it('is empty on first start, saves multiple real projects, and survives a new connection', async () => { expect(await repo.list()).toEqual([]); const a = createProject(), b = createProject('title'); await repo.save(a); await repo.save(b); await repo.close(); repo = new BrowserRepository(name); expect(await repo.list()).toHaveLength(2); expect(await repo.load(a.id)).toEqual(a); });
  it('renames the actual portable document and preserves favorite/trash across saves', async () => { const p = createProject(); await repo.save(p, 'thumbnail'); await repo.patch(p.id, { name: 'Better name', starred: true }); expect((await repo.load(p.id)).name).toBe('Better name'); await repo.save({ ...p, name: 'Better name' }); const record = (await repo.list())[0]; expect(record.starred).toBe(true); expect(record.thumbnail).toBe('thumbnail'); await repo.patch(p.id, { deletedAt: 123 }); expect((await repo.list())[0].deletedAt).toBe(123); await repo.patch(p.id, { deletedAt: null }); expect((await repo.list())[0].starred).toBe(true); });
  it('keeps three prior saves and can recover the most recent prior version', async () => { const p = createProject(); for (let i = 0; i < 6; i++) await repo.save({ ...p, name: `Edit ${i}` }); const db = await openDB(name); expect(await db.count('revisions')).toBe(3); db.close(); expect((await repo.recover(p.id)).name).toBe('Edit 4'); });
  it('does not erase projects on invalid input', async () => { const p = createProject(); await repo.save(p); expect(() => repo.save({ ...p, width: -1 })).toThrow(); expect(await repo.load(p.id)).toEqual(p); });
  it('rolls back artwork and revisions together on an aborted transaction', async () => { const p = createProject(); await repo.save(p); const original = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) { const request = original.apply(this, args); if (this.name === 'projects') queueMicrotask(() => this.transaction.abort()); return request; }; try { await expect(repo.save({ ...p, name: 'Unsaved' })).rejects.toThrow(); } finally { IDBObjectStore.prototype.put = original; } expect(await repo.load(p.id)).toEqual(p); const db = await openDB(name); expect(await db.count('revisions')).toBe(0); db.close(); });
  it('requires Trash before deletion and deletes that project’s revisions only', async () => { const a = createProject(), b = createProject(); await repo.save(a); await repo.save({ ...a, name: 'Changed' }); await repo.save(b); await expect(repo.deleteForever(a.id)).rejects.toThrow('Trash'); await repo.patch(a.id, { deletedAt: 123 }); await repo.deleteForever(a.id); expect(await repo.list()).toHaveLength(1); expect(await repo.load(b.id)).toEqual(b); const db = await openDB(name); expect(await db.count('revisions')).toBe(0); db.close(); });
  it('persists the last project and preferences independently of project data', async () => { expect(await repo.getSettings()).toEqual({ lastProjectId: null }); await repo.saveSettings({ lastProjectId: 'chosen' }); await repo.close(); repo = new BrowserRepository(name); expect(await repo.getSettings()).toEqual({ lastProjectId: 'chosen' }); });
  it('rejects missing IDs and empty renames without unhandled transaction errors', async () => { await expect(repo.load('missing')).rejects.toThrow(); await expect(repo.patch('missing', { name: 'Unknown' })).rejects.toThrow(); const p = createProject(); await repo.save(p); await expect(repo.patch(p.id, { name: '  ' })).rejects.toThrow('name'); expect(await repo.load(p.id)).toEqual(p); });
  it('recovers even if the current binary payload is corrupted', async () => { const p = createProject(); await repo.save(p); await repo.save({ ...p, name: 'Later' }); const db = await openDB(name); const record = await db.get('projects', p.id); record.bytes[60] ^= 255; await db.put('projects', record); db.close(); await expect(repo.load(p.id)).rejects.toThrow(); expect(await repo.recover(p.id)).toEqual(p); });
  it('serializes rapid saves rather than letting an older asynchronous write win', async () => { const p = createProject(); await Promise.all(Array.from({ length: 10 }, (_, n) => repo.save({ ...p, name: `Save ${n}` }))); expect((await repo.load(p.id)).name).toBe('Save 9'); });
  it('captures encoded artwork and matching metadata before a queued caller can mutate them', async () => {
    const p = createProject(), captured = structuredClone(p); const saving = repo.save(p);
    p.id = crypto.randomUUID(); p.name = 'Changed after request'; p.width = 1200; p.items = [];
    await saving; const records = await repo.list(); expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ id: captured.id, name: captured.name, width: captured.width, kind: 'Character animation' });
    expect(await repo.load(captured.id)).toEqual(captured); await expect(repo.load(p.id)).rejects.toThrow();
  });
  it('captures mutable metadata/settings requests at queue entry', async () => {
    const p = createProject(); await repo.save(p); const patch = { name: 'Requested name' }; const patching = repo.patch(p.id, patch); patch.name = 'Too late'; await patching;
    expect((await repo.load(p.id)).name).toBe('Requested name');
    const settings = { lastProjectId: p.id }; const saving = repo.saveSettings(settings); settings.lastProjectId = 'Too late'; await saving; expect((await repo.getSettings()).lastProjectId).toBe(p.id);
  });
  it.each(['QuotaExceededError', 'DataCloneError'])('rolls back prior revision writes after a synchronous %s', async errorName => {
    const p = createProject(); await repo.save(p); const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) { if (this.name === 'projects') throw new DOMException('Injected storage write failure', errorName); return original.apply(this, args); };
    try { await expect(repo.save({ ...p, name: 'Unsaved' })).rejects.toMatchObject({ name: errorName }); }
    finally { IDBObjectStore.prototype.put = original; }
    expect(await repo.load(p.id)).toEqual(p); const db = await openDB(name); expect(await db.count('revisions')).toBe(0); db.close();
  });

});
