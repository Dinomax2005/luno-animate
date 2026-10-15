import { useStudio } from "../state/studio";
import { home } from "./library";
import { openFile, saveFile } from "./files";
export interface Command {
  id: string;
  label: string;
  group: "File" | "Edit" | "Layer" | "Animation" | "View" | "Help";
  shortcut?: string;
  run: () => void | Promise<unknown>;
  enabled?: () => boolean;
}
export function commands(importMedia: () => void): Command[] {
  const s = () => useStudio.getState(),
    active = () => s().view === "studio" && !s().busy && !s().interacting;
  return [
    {
      id: "new",
      label: "New project…",
      group: "File",
      shortcut: "Ctrl N",
      run: () => s().set({ dialog: "new" }),
    },
    {
      id: "open",
      label: "Open project…",
      group: "File",
      shortcut: "Ctrl O",
      run: openFile,
    },
    { id: "home", label: "Project library", group: "File", run: home },
    {
      id: "save",
      label: "Save",
      group: "File",
      shortcut: "Ctrl S",
      enabled: active,
      run: () => saveFile(),
    },
    {
      id: "save-as",
      label: "Save As…",
      group: "File",
      shortcut: "Ctrl Shift S",
      enabled: active,
      run: () => saveFile(true),
    },
    {
      id: "copy",
      label: "Export .lam copy…",
      group: "File",
      enabled: active,
      run: () => saveFile(false, true),
    },
    {
      id: "media",
      label: "Import media…",
      group: "File",
      enabled: active,
      run: importMedia,
    },
    {
      id: "export",
      label: "Export…",
      group: "File",
      shortcut: "Ctrl E",
      enabled: active,
      run: () => s().set({ dialog: "export" }),
    },
    {
      id: "undo",
      label: "Undo",
      group: "Edit",
      shortcut: "Ctrl Z",
      enabled: () => active() && !!s().history.length,
      run: () => s().undo(),
    },
    {
      id: "redo",
      label: "Redo",
      group: "Edit",
      shortcut: "Ctrl Shift Z",
      enabled: () => active() && !!s().future.length,
      run: () => s().redo(),
    },
    {
      id: "duplicate",
      label: "Duplicate selection",
      group: "Edit",
      shortcut: "Ctrl D",
      enabled: () => active() && !!s().selected.length,
      run: () => s().duplicate(),
    },
    {
      id: "delete",
      label: "Delete selection",
      group: "Edit",
      shortcut: "Delete",
      enabled: () => active() && !!s().selected.length,
      run: () => s().remove(),
    },
    {
      id: "copy-keys",
      label: "Copy selected keys",
      group: "Edit",
      shortcut: "Ctrl C",
      enabled: () => active() && !!s().keySelection.length,
      run: () => s().copyKeys(),
    },
    {
      id: "paste-keys",
      label: "Paste keys at playhead",
      group: "Edit",
      shortcut: "Ctrl V",
      enabled: () => active() && !!s().keyClipboard.length,
      run: () => s().pasteKeys(),
    },
    {
      id: "drawing",
      label: "New drawing layer",
      group: "Layer",
      enabled: active,
      run: () => s().add("paint"),
    },
    {
      id: "rectangle",
      label: "Rectangle",
      group: "Layer",
      enabled: active,
      run: () => s().add("shape", "rect"),
    },
    {
      id: "ellipse",
      label: "Ellipse",
      group: "Layer",
      enabled: active,
      run: () => s().add("shape", "ellipse"),
    },
    {
      id: "star",
      label: "Star",
      group: "Layer",
      enabled: active,
      run: () => s().add("shape", "star"),
    },
    {
      id: "type",
      label: "Text",
      group: "Layer",
      enabled: active,
      run: () => s().add("text"),
    },
    {
      id: "armature",
      label: "Armature",
      group: "Layer",
      enabled: active,
      run: () => s().add("rig"),
    },
    {
      id: "group",
      label: "Group selection",
      group: "Layer",
      shortcut: "Ctrl G",
      enabled: () => active() && s().selected.length >= 2,
      run: () => s().group(),
    },
    {
      id: "ungroup",
      label: "Ungroup",
      group: "Layer",
      enabled: active,
      run: () => s().ungroup(),
    },
    {
      id: "split",
      label: "Split selected video clip",
      group: "Animation",
      shortcut: "S",
      enabled: active,
      run: () => s().splitClip(),
    },
    {
      id: "play",
      label: s().playing ? "Pause" : "Play",
      group: "Animation",
      shortcut: "Space",
      enabled: active,
      run: () => s().set({ playing: !s().playing }),
    },
    {
      id: "key",
      label: "Insert keyframe",
      group: "Animation",
      shortcut: "K",
      enabled: active,
      run: () => s().addKey(),
    },
    {
      id: "blank",
      label: "Blank next cel",
      group: "Animation",
      shortcut: "F7",
      enabled: active,
      run: () => s().newCel(false),
    },
    {
      id: "duplicate-cel",
      label: "Duplicate next cel",
      group: "Animation",
      shortcut: "F6",
      enabled: active,
      run: () => s().newCel(true),
    },
    {
      id: "reverse",
      label: "Reverse exposures in work area",
      group: "Animation",
      enabled: active,
      run: () => {
        const st = s(),
          sc = st.document!.scenes.find((sc) => sc.id === st.sceneId)!;
        st.reverseCels(...sc.work);
      },
    },
    {
      id: "breakdowns",
      label: "Add in-betweens",
      group: "Animation",
      shortcut: "Ctrl B",
      enabled: () => active() && !!s().selected.length,
      run: () => s().breakdowns(3, "even"),
    },
    {
      id: "assist",
      label: "Motion audit…",
      group: "Animation",
      enabled: active,
      run: () => s().set({ dialog: "assist" }),
    },
    {
      id: "focus",
      label: "Focus canvas",
      group: "View",
      shortcut: "Tab",
      enabled: active,
      run: () => s().set({ focused: !s().focused }),
    },
    {
      id: "grid",
      label: "Canvas grid",
      group: "View",
      enabled: active,
      run: () => s().pref("grid", !s().preferences.grid),
    },
    {
      id: "onion",
      label: "Onion skins",
      group: "View",
      shortcut: "U",
      enabled: active,
      run: () => s().pref("onion", !s().preferences.onion),
    },
    {
      id: "fit",
      label: "Fit canvas",
      group: "View",
      enabled: active,
      run: () => s().set({ zoom: 100, pan: { x: 0, y: 0 } }),
    },
    {
      id: "scenes",
      label: "Scene navigator",
      group: "View",
      enabled: active,
      run: () => s().set({ navigator: "scenes" }),
    },
    {
      id: "references",
      label: "Reference board",
      group: "View",
      enabled: active,
      run: () => s().set({ navigator: "reference" }),
    },
    {
      id: "theme",
      label:
        s().preferences.theme === "dark" ? "Light interface" : "Dark interface",
      group: "View",
      run: () =>
        s().pref("theme", s().preferences.theme === "dark" ? "light" : "dark"),
    },
    {
      id: "reference",
      label: "Keyboard & tools",
      group: "Help",
      run: () => s().set({ dialog: "help" }),
    },
    {
      id: "setup",
      label: "Workspace setup",
      group: "Help",
      run: () => s().set({ dialog: "setup" }),
    },
    {
      id: "updates",
      label: "Updates & backups",
      group: "Help",
      run: () => s().set({ dialog: "updates" }),
    },
    {
      id: "about",
      label: "About & licence",
      group: "Help",
      run: () => s().set({ dialog: "about" }),
    },
  ];
}
export function execute(command: Command) {
  const s = useStudio.getState();
  if (s.busy || s.interacting || command.enabled?.() === false) return;
  (document.activeElement as HTMLElement)?.blur();
  Promise.resolve(command.run()).catch((e) =>
    s.notify(e instanceof Error ? e.message : "Command failed.", true),
  );
}
