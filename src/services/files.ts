import { create } from "zustand";
import { decode, encode, fingerprint } from "../core/codec";
import type { Document } from "../core/model";
import { useStudio } from "../state/studio";
import { adoptDocument, flush } from "./library";
export interface FileLink {
  document: string;
  name: string;
  hash: string;
  snapshot: Document;
  token?: string;
  handle?: FileSystemFileHandle;
}
export const useFile = create<{ links: Record<string, FileLink> }>()(() => ({
  links: {},
}));
export function bind(link: FileLink) {
  useFile.setState((s) => ({ links: { ...s.links, [link.document]: link } }));
}
export function dirty() {
  const d = useStudio.getState().document;
  return (
    !!d &&
    !!useFile.getState().links[d.id] &&
    useFile.getState().links[d.id].snapshot !== d
  );
}
function cancelled(e: unknown) {
  return e instanceof DOMException && e.name === "AbortError";
}
export async function openFile() {
  const s = useStudio.getState();
  if (s.busy || s.interacting) return;
  s.set({ busy: true });
  try {
    await flush();
    if (window.studio) {
      const file = await window.studio.files.open();
      if (file) {
        s.open(await adoptDocument(decode(file.bytes)));
        bind({
          ...file,
          document: useStudio.getState().document!.id,
          snapshot: useStudio.getState().document!,
        });
      }
    } else if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: "Luno Studio project",
            accept: { "application/vnd.luno.studio": [".lam"] },
          },
        ],
      });
      const file = await handle.getFile();
      if (file.size > 64_000_052) throw new Error("Project exceeds 64 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      s.open(await adoptDocument(decode(bytes)));
      bind({
        document: useStudio.getState().document!.id,
        snapshot: useStudio.getState().document!,
        name: file.name,
        hash: fingerprint(bytes),
        handle,
      });
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".lam";
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) void importProject(file);
      };
      input.click();
    }
  } catch (e) {
    if (!cancelled(e))
      s.notify(
        e instanceof Error ? e.message : "Could not open the file.",
        true,
      );
  } finally {
    s.set({ busy: false });
  }
}
export async function importProject(file: File) {
  const s = useStudio.getState();
  if (file.size > 64_000_052) {
    s.notify("Project exceeds 64 MB.", true);
    return;
  }
  s.set({ busy: true });
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    s.open(await adoptDocument(decode(data)));
    s.notify("Imported an editable copy. Save As to link a writable file.");
  } catch (e) {
    s.notify(e instanceof Error ? e.message : "Unsupported project.", true);
  } finally {
    s.set({ busy: false });
  }
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const filename = (s: string) =>
  s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100) || "Untitled";
export async function saveFile(as = false, copy = false) {
  const s = useStudio.getState();
  if (!s.document || s.busy || s.interacting) return;
  (document.activeElement as HTMLElement)?.blur();
  const snapshot = useStudio.getState().document!;
  s.set({ busy: true });
  try {
    try {
      await flush();
    } catch {
      /* Portable save still works if the library is unavailable. */
    }
    const bytes = encode(snapshot),
      hash = fingerprint(bytes),
      link = useFile.getState().links[snapshot.id];
    if (copy) {
      if (window.studio) {
        await window.studio.files.export(bytes, snapshot.title, "lam");
        s.notify("Exported a .lam copy. Linked Save destination is unchanged.");
        return;
      }
      download(
        new Blob([bytes as Uint8Array<ArrayBuffer>], {
          type: "application/vnd.luno.studio",
        }),
        `${filename(snapshot.title)}.lam`,
      );
      s.notify("Exported a .lam copy. Linked Save destination is unchanged.");
      return;
    }
    if (window.studio) {
      const result = await window.studio.files.save(
        bytes,
        snapshot.title,
        as ? undefined : link?.token,
        as ? undefined : link?.hash,
      );
      if (result) {
        bind({ ...result, document: snapshot.id, snapshot });
        s.notify(`Saved ${result.name}.`);
      }
      return;
    }
    let handle = as ? undefined : link?.handle;
    if (!handle && window.showSaveFilePicker)
      handle = await window.showSaveFilePicker({
        suggestedName: `${filename(snapshot.title)}.lam`,
        types: [
          {
            description: "Luno Studio project",
            accept: { "application/vnd.luno.studio": [".lam"] },
          },
        ],
      });
    if (handle) {
      if (handle === link?.handle) {
        const existing = await handle.getFile();
        if (
          fingerprint(new Uint8Array(await existing.arrayBuffer())) !==
          link.hash
        )
          throw new Error(
            "The file changed outside Luno. Use Save As to preserve both versions.",
          );
      }
      const writable = await handle.createWritable({ keepExistingData: false });
      try {
        await writable.write(bytes as Uint8Array<ArrayBuffer>);
        await writable.close();
      } catch (e) {
        await writable.abort().catch(() => {});
        throw e;
      }
      bind({
        document: snapshot.id,
        snapshot,
        name: handle.name,
        hash,
        handle,
      });
      s.notify(`Saved ${handle.name}.`);
    } else {
      download(
        new Blob([bytes as Uint8Array<ArrayBuffer>]),
        `${filename(snapshot.title)}.lam`,
      );
      s.notify(
        "Downloaded a copy. This browser cannot overwrite the original; use desktop or file-system access.",
      );
    }
  } catch (e) {
    if (!cancelled(e))
      s.notify(
        e instanceof Error
          ? e.message
          : "Save failed. Your original file is unchanged.",
        true,
      );
  } finally {
    s.set({ busy: false });
  }
}
export async function saveMedia(blob: Blob, name: string, extension: string) {
  if (window.studio)
    return window.studio.files.export(
      new Uint8Array(await blob.arrayBuffer()),
      filename(name),
      extension,
    );
  download(blob, `${filename(name)}.${extension}`);
  return true;
}
