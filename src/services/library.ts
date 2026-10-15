import { openDB, type DBSchema } from "idb";
import { decode, encode, fingerprint } from "../core/codec";
import { thumbnail } from "../core/render";
import type { Document, Workspace } from "../core/model";
import { useStudio, type LibraryEntry } from "../state/studio";
interface DB extends DBSchema {
  projects: { key: string; value: { entry: LibraryEntry; bytes: Uint8Array } };
  revisions: {
    key: number;
    value: { id?: number; project: string; bytes: Uint8Array; date: number };
    indexes: { project: string };
  };
}
let database: ReturnType<typeof openDB<DB>> | undefined;
function db() {
  return (database ??= openDB<DB>("pegbar-studio-library", 1, {
    upgrade(db) {
      db.createObjectStore("projects", { keyPath: "entry.id" });
      db.createObjectStore("revisions", {
        keyPath: "id",
        autoIncrement: true,
      }).createIndex("project", "project");
    },
  }));
}
let queue: Promise<unknown> = Promise.resolve();
let scheduled: ReturnType<typeof setTimeout> | undefined,
  last: Document | null = null;
async function list() {
  if (window.studio) return window.studio.library.list();
  return (await (await db()).getAll("projects")).map((v) => v.entry);
}
export async function refresh() {
  useStudio.setState({
    library: (await list()).sort((a, b) => b.modified - a.modified),
    ready: true,
  });
}
export async function initialize() {
  await refresh();
  last = null;
}
export async function loadProject(id: string) {
  const s = useStudio.getState();
  if (s.busy || s.interacting) return;
  s.set({ busy: true });
  try {
    await flush();
    const bytes = window.studio
      ? await window.studio.library.load(id)
      : (await (await db()).get("projects", id))?.bytes;
    if (!bytes) throw new Error("Project not found.");
    const entry = s.library.find((e) => e.id === id);
    s.open(decode(bytes), entry?.workspace);
    last = useStudio.getState().document;
  } catch (e) {
    s.notify(e instanceof Error ? e.message : "Open failed.", true);
  } finally {
    s.set({ busy: false });
  }
}
async function save(snapshot: Document, workspace: Workspace) {
  const bytes = encode(snapshot);
  let preview = "";
  try {
    preview = await thumbnail(snapshot);
  } catch {
    /* Missing media cannot destroy the document save. */
  }
  let entry: LibraryEntry;
  if (window.studio)
    entry = await window.studio.library.save(bytes, preview, workspace);
  else {
    const d = await db(),
      old = await d.get("projects", snapshot.id);
    entry = {
      id: snapshot.id,
      title: snapshot.title,
      created: old?.entry.created ?? snapshot.created,
      modified: Date.now(),
      thumbnail: preview || old?.entry.thumbnail || "",
      starred: old?.entry.starred ?? false,
      workspace,
      scenes: snapshot.scenes.length,
      seconds:
        snapshot.scenes.reduce((n, s) => n + s.length, 0) / snapshot.canvas.fps,
    };
    const tx = d.transaction(["projects", "revisions"], "readwrite");
    try {
      if (old) {
        await tx
          .objectStore("revisions")
          .add({ project: snapshot.id, bytes: old.bytes, date: Date.now() });
        const keys = await tx
          .objectStore("revisions")
          .index("project")
          .getAllKeys(snapshot.id);
        for (const key of keys.slice(0, -3))
          await tx.objectStore("revisions").delete(key);
      }
      await tx.objectStore("projects").put({ entry, bytes });
      await tx.done;
    } catch (e) {
      try {
        tx.abort();
      } catch {
        /* Already closed. */
      }
      await tx.done.catch(() => {});
      throw e;
    }
  }
  useStudio.setState((s) => ({
    library: [entry, ...s.library.filter((e) => e.id !== entry.id)].sort(
      (a, b) => b.modified - a.modified,
    ),
    saveState: s.document === snapshot ? "saved" : s.saveState,
  }));
  last = snapshot;
}
export async function flush() {
  clearTimeout(scheduled);
  const s = useStudio.getState();
  if (s.document && s.document !== last) {
    const snapshot = s.document;
    queue = queue.catch(() => {}).then(() => save(snapshot, s.workspace));
  }
  try {
    await queue;
  } catch (e) {
    useStudio.getState().set({ saveState: "error" });
    throw e;
  }
}
export async function home() {
  const s = useStudio.getState();
  if (s.busy || s.interacting) return;
  s.set({ busy: true });
  try {
    await flush();
    s.set({ view: "home", playing: false, dialog: null });
    await refresh();
  } catch (e) {
    s.notify(
      `Could not finish the local save: ${e instanceof Error ? e.message : "storage error"}. Export a .lam copy before closing.`,
      true,
    );
  } finally {
    s.set({ busy: false });
  }
}
export async function deleteProject(id: string) {
  const s = useStudio.getState();
  if (window.studio) await window.studio.library.delete(id);
  else {
    const d = await db(),
      tx = d.transaction(["projects", "revisions"], "readwrite");
    await tx.objectStore("projects").delete(id);
    for (const key of await tx
      .objectStore("revisions")
      .index("project")
      .getAllKeys(id))
      await tx.objectStore("revisions").delete(key);
    await tx.done;
  }
  if (s.document?.id === id) s.set({ document: null, view: "home" });
  await refresh();
}
export async function duplicateProject(id: string) {
  const bytes = window.studio
    ? await window.studio.library.load(id)
    : (await (await db()).get("projects", id))?.bytes;
  if (!bytes) throw new Error("Project not found.");
  const d = decode(bytes);
  d.id = crypto.randomUUID();
  d.title += " copy";
  d.created = Date.now();
  await save(
    d,
    useStudio.getState().library.find((p) => p.id === id)?.workspace ?? "Draw",
  );
}
useStudio.subscribe((s, old) => {
  if (
    !s.document ||
    (s.document === old.document && !(old.interacting && !s.interacting))
  )
    return;
  clearTimeout(scheduled);
  if (s.interacting) return;
  scheduled = setTimeout(
    () =>
      void flush().catch((e) =>
        s.notify(`Library save failed: ${e.message}. Save a .lam copy.`, true),
      ),
    700,
  );
});

export async function adoptDocument(incoming: Document): Promise<Document> {
  const existing = useStudio
    .getState()
    .library.find((p) => p.id === incoming.id);
  if (!existing) return incoming;
  const data = window.studio
    ? await window.studio.library.load(incoming.id)
    : (await (await db()).get("projects", incoming.id))?.bytes;
  if (data && fingerprint(data) === fingerprint(encode(incoming)))
    return incoming;
  return {
    ...incoming,
    id: crypto.randomUUID(),
    title: incoming.title.slice(0, 85) + " · imported",
    created: Date.now(),
  };
}
