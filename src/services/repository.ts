import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { decodeLam, encodeLam } from '../engine/lam';
import { projectRecord } from '../engine/library-record';
import type { Preferences, Project, ProjectRecord, SavedProject } from '../engine/types';
export interface LibrarySettings { lastProjectId: string | null; preferences?: Preferences }
export type RecordPatch = { name?: string; starred?: boolean; deletedAt?: number | null };
export interface Repository {
  list(): Promise<ProjectRecord[]>; save(project: Project, thumbnail?: string | null): Promise<ProjectRecord>;
  load(id: string): Promise<Project>; patch(id: string, patch: RecordPatch): Promise<void>;
  deleteForever(id: string): Promise<void>; recover(id: string): Promise<Project>;
  getSettings(): Promise<LibrarySettings>; saveSettings(settings: LibrarySettings): Promise<void>;
}
interface LunoDB extends DBSchema {
  projects: { key: string; value: SavedProject };
  revisions: { key: number; value: { id?: number; projectId: string; createdAt: number; bytes: Uint8Array }; indexes: { 'by-project': string } };
  settings: { key: string; value: LibrarySettings };
}
async function protectTransaction<T>(tx: { abort(): void; done: Promise<void> }, action: () => Promise<T>): Promise<T> {
  try { const value = await action(); await tx.done; return value; }
  catch (error) { try { tx.abort(); } catch { /* The failed request may already have aborted the transaction. */ } await tx.done.catch(() => {}); throw error; }
}
/** IndexedDB commits artwork and metadata together; a failed/quota-limited save preserves the previous copy. */
export class BrowserRepository implements Repository {
  private db: Promise<IDBPDatabase<LunoDB>>;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(name = 'luno-library-v1') {
    this.db = openDB<LunoDB>(name, 1, { upgrade(db) {
      db.createObjectStore('projects', { keyPath: 'id' });
      const revisions = db.createObjectStore('revisions', { keyPath: 'id', autoIncrement: true });
      revisions.createIndex('by-project', 'projectId'); db.createObjectStore('settings');
    }, blocking: () => { void this.db.then(db => db.close()); } });
  }
  private serial<T>(action: () => Promise<T>): Promise<T> { const result = this.queue.then(action); this.queue = result.catch(() => {}); return result; }
  async list() { await this.queue; const records = await (await this.db).getAll('projects'); return records.map(({ bytes: _bytes, ...record }) => record); }
  async load(id: string) { await this.queue; const record = await (await this.db).get('projects', id); if (!record) throw new Error('This project could not be found.'); const project = decodeLam(record.bytes); if (project.id !== id) throw new Error('Project integrity mismatch.'); return project; }
  save(project: Project, thumbnail?: string | null) {
    const bytes = encodeLam(project);
    return this.serial(async () => {
      const db = await this.db; const tx = db.transaction(['projects', 'revisions'], 'readwrite');
      return protectTransaction(tx, async () => {
      const previous = await tx.objectStore('projects').get(project.id); const record = projectRecord(project, previous, thumbnail);
      if (previous) {
        await tx.objectStore('revisions').add({ projectId: project.id, createdAt: previous.updatedAt, bytes: previous.bytes });
        const revisions = await tx.objectStore('revisions').index('by-project').getAll(project.id);
        for (const old of revisions.slice(0, Math.max(0, revisions.length - 3))) await tx.objectStore('revisions').delete(old.id!);
      }
      await tx.objectStore('projects').put({ ...record, bytes }); return record;
      });
    });
  }
  patch(id: string, patch: RecordPatch) {
    return this.serial(async () => {
      const db = await this.db; const tx = db.transaction(['projects', 'revisions'], 'readwrite'); return protectTransaction(tx, async () => { const previous = await tx.objectStore('projects').get(id);
      if (!previous) { tx.abort(); void tx.done.catch(() => {}); throw new Error('This project could not be found.'); }
      let bytes = previous.bytes; let name = previous.name;
      if (patch.name !== undefined) {
        name = patch.name.trim().slice(0, 100); if (!name) { tx.abort(); void tx.done.catch(() => {}); throw new Error('Please give your project a name.'); }
        bytes = encodeLam({ ...decodeLam(bytes), name });
        await tx.objectStore('revisions').add({ projectId: id, createdAt: previous.updatedAt, bytes: previous.bytes });
        const revisions = await tx.objectStore('revisions').index('by-project').getAll(id);
        for (const old of revisions.slice(0, Math.max(0, revisions.length - 3))) await tx.objectStore('revisions').delete(old.id!);
      }
      await tx.objectStore('projects').put({ ...previous, ...patch, name, bytes, updatedAt: patch.name !== undefined ? Date.now() : previous.updatedAt }); });
    });
  }
  deleteForever(id: string) {
    return this.serial(async () => {
      const db = await this.db; const tx = db.transaction(['projects', 'revisions'], 'readwrite'); return protectTransaction(tx, async () => { const record = await tx.objectStore('projects').get(id);
      if (!record?.deletedAt) { tx.abort(); void tx.done.catch(() => {}); throw new Error('Move a project to Trash before permanently deleting it.'); }
      await tx.objectStore('projects').delete(id); const revisions = await tx.objectStore('revisions').index('by-project').getAll(id);
      for (const revision of revisions) await tx.objectStore('revisions').delete(revision.id!); });
    });
  }
  async recover(id: string) {
    await this.queue; const db = await this.db; const revisions = (await db.getAllFromIndex('revisions', 'by-project', id)).reverse();
    for (const revision of revisions) { let p: Project; try { p = decodeLam(revision.bytes); if (p.id !== id) continue; } catch { continue; } await this.save(p); return p; }
    throw new Error('No readable prior save is available. Your existing files have not been removed.');
  }
  async getSettings() { await this.queue; return (await (await this.db).get('settings', 'studio')) ?? { lastProjectId: null }; }
  saveSettings(settings: LibrarySettings) { return this.serial(async () => { await (await this.db).put('settings', settings, 'studio'); }); }
  async close() { await this.queue; (await this.db).close(); }
}
export class NativeRepository implements Repository {
  private api() { if (!window.luno) throw new Error('The desktop project connection is unavailable.'); return window.luno.library; }
  list() { return this.api().list(); }
  async save(p: Project, thumbnail?: string | null) { return this.api().save(encodeLam(p), thumbnail); }
  async load(id: string) { return decodeLam(await this.api().load(id)); }
  patch(id: string, patch: RecordPatch) { return this.api().patch(id, patch); }
  deleteForever(id: string) { return this.api().deleteForever(id); }
  async recover(id: string) { return decodeLam(await this.api().recover(id)); }
  getSettings() { return this.api().getSettings(); }
  saveSettings(settings: LibrarySettings) { return this.api().saveSettings(settings); }
}
let instance: Repository | undefined;
export const repository = (): Repository => instance ??= window.luno ? new NativeRepository() : new BrowserRepository();
