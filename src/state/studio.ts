import { create } from "zustand";
import {
  brushDefaults,
  createDocument,
  identity,
  layer,
  MAX_FRAMES,
  scene,
  uid,
  type Asset,
  type Brush,
  type Channel,
  type Document,
  type Key,
  type Layer,
  type Mark,
  type Scene,
  type Tool,
  type Transform,
  type Workspace,
} from "../core/model";
import { brushSchema, validateDocument } from "../core/validate";
import { bonesAt, celAt, channelAt, clamp, locked, pose } from "../core/motion";

export interface LibraryEntry {
  id: string;
  title: string;
  modified: number;
  created: number;
  thumbnail: string;
  starred: boolean;
  workspace: Workspace;
  scenes: number;
  seconds: number;
}
export type Dialog =
  | "new"
  | "export"
  | "settings"
  | "about"
  | "commands"
  | "setup"
  | "scenes"
  | "reference"
  | "help"
  | "updates"
  | null;
interface Preferences {
  theme: "dark" | "light";
  grid: boolean;
  snap: boolean;
  onion: boolean;
  autoKey: boolean;
  loop: boolean;
  brush: Brush;
  foreground: string;
  background: string;
  left: number;
  right: number;
  timeline: number;
  newsSeen: string;
}
const SETTINGS = "pegbar.studio.preferences.v1";
// 1.0.x stored the same preferences under the earlier key. Read it once so a
// rename does not silently reset a returning user's workspace.
const LEGACY_SETTINGS = "luno.studio.preferences.v1";
function settings(): Preferences {
  const initial: Preferences = {
    theme: "dark",
    grid: false,
    snap: false,
    onion: true,
    autoKey: true,
    loop: true,
    brush: { ...brushDefaults },
    foreground: "#24262a",
    background: "#f6f5f1",
    left: 240,
    right: 296,
    timeline: 242,
    newsSeen: "",
  };
  try {
    const raw = JSON.parse(
      localStorage.getItem(SETTINGS) ??
        localStorage.getItem(LEGACY_SETTINGS) ??
        "{}",
    );
    for (const k of ["grid", "snap", "onion", "autoKey", "loop"] as const)
      if (typeof raw[k] === "boolean") initial[k] = raw[k];
    const brush = brushSchema.safeParse(raw.brush);
    if (brush.success) initial.brush = brush.data;
    if (raw.theme === "light") initial.theme = "light";
    if (typeof raw.newsSeen === "string") initial.newsSeen = raw.newsSeen;
    for (const k of ["foreground", "background"] as const)
      if (/^#[a-f0-9]{6}$/i.test(raw[k])) initial[k] = raw[k];
    for (const [key, min, max] of [
      ["left", 190, 350],
      ["right", 250, 420],
      ["timeline", 180, 460],
    ] as const)
      if (Number.isFinite(raw[key])) initial[key] = clamp(raw[key], min, max);
  } catch {
    /* Local preferences are optional. */
  }
  return initial;
}
function clone(d: Document): Document {
  return { ...structuredClone({ ...d, assets: [] }), assets: d.assets };
}
function target(s: Studio): Scene | undefined {
  return s.document?.scenes.find((scene) => scene.id === s.sceneId);
}
function extend(s: Scene, length: number) {
  const old = s.length;
  s.length = clamp(length, 2, MAX_FRAMES);
  if (s.work[1] === old - 1) s.work[1] = s.length - 1;
  s.work = [
    Math.min(s.work[0], s.length - 1),
    Math.min(s.work[1], s.length - 1),
  ];
  for (const l of s.layers) {
    if (l.end === old) l.end = s.length;
    l.end = Math.min(l.end, s.length);
    l.start = Math.min(l.start, l.end - 1);
    l.keys = l.keys.filter((k) => k.frame < s.length);
    if (l.cels) l.cels = l.cels.filter((c) => c.frame < s.length);
  }
  s.camera.keys = s.camera.keys.filter((k) => k.frame < s.length);
  s.sounds = s.sounds
    .filter((a) => a.start < s.length)
    .map((a) => ({ ...a, end: Math.min(a.end, s.length) }));
}
function writeKey(l: Layer, frame: number, values: Key["values"]) {
  if (frame > 0) {
    const base: Key["values"] = {};
    for (const ch of Object.keys(values) as Channel[])
      if (!l.keys.some((k) => k.values[ch] !== undefined))
        base[ch] = ch.startsWith("bone:")
          ? l.bones?.find((b) => b.id === ch.slice(5))?.angle
          : (l.transform as unknown as Record<string, number>)[ch];
    if (Object.keys(base).length) {
      const zero = l.keys.find((k) => k.frame === 0);
      l.keys = [
        ...l.keys.filter((k) => k.frame !== 0),
        {
          id: zero?.id ?? uid(),
          frame: 0,
          easing: zero?.easing ?? "smooth",
          values: { ...zero?.values, ...base },
        },
      ];
    }
  }
  const old = l.keys.find((k) => k.frame === frame);
  l.keys = [
    ...l.keys.filter((k) => k.frame !== frame),
    {
      id: old?.id ?? uid(),
      frame,
      easing: old?.easing ?? "smooth",
      values: { ...old?.values, ...values },
      ...(old?.curve ? { curve: old.curve } : {}),
    },
  ].sort((a, b) => a.frame - b.frame);
}
export interface Studio {
  document: Document | null;
  sceneId: string;
  workspace: Workspace;
  view: "home" | "studio";
  frame: number;
  playing: boolean;
  selected: string[];
  bone: string | null;
  tool: Tool;
  zoom: number;
  pan: { x: number; y: number };
  preferences: Preferences;
  dialog: Dialog;
  history: Document[];
  future: Document[];
  busy: boolean;
  interacting: boolean;
  library: LibraryEntry[];
  ready: boolean;
  saveState: "saved" | "saving" | "error";
  notice: { text: string; error: boolean; id: string } | null;
  keySelection: { layer: string; id: string }[];
  keyClipboard: { layer: string; key: Key }[];
  navigator: "layers" | "assets" | "scenes" | "reference";
  popout: "left" | "right" | null;
  focused: boolean;
  frameWidth: number;
  set: (patch: Partial<Studio>) => void;
  notify: (text: string, error?: boolean) => void;
  pref: <K extends keyof Preferences>(k: K, value: Preferences[K]) => void;
  open: (d: Document, w?: Workspace) => void;
  create: (w: Workspace, title: string, canvas?: Document["canvas"]) => void;
  commit: (
    label: string,
    change: (d: Document, s: Scene) => void,
    owned?: boolean,
  ) => boolean;
  undo: () => void;
  redo: () => void;
  select: (id: string | null, additive?: boolean) => void;
  add: (kind: Layer["kind"], shape?: Layer["shape"]) => void;
  remove: () => void;
  duplicate: () => void;
  group: () => void;
  ungroup: () => void;
  arrange: (id: string, direction: number) => void;
  patchLayer: (id: string, patch: Partial<Layer>) => void;
  transform: (id: string, patch: Partial<Transform>, record?: boolean) => void;
  beginGesture: () => void;
  endGesture: () => void;
  cancelGesture: () => void;
  addMark: (
    mark: Mark,
    expected: {
      document: string;
      scene: string;
      frame: number;
      layer: string | null;
    },
  ) => boolean;
  newCel: (copy: boolean, next?: boolean) => void;
  editCel: (
    layer: string,
    frame: number,
    action: "delete" | "move",
    to?: number,
  ) => void;
  reverseCels: (start: number, end: number) => void;
  addKey: () => void;
  deleteKeys: () => void;
  copyKeys: () => void;
  pasteKeys: () => void;
  moveKey: (id: string, key: string, to: number) => void;
  easing: (ease: Key["easing"], curve?: Key["curve"]) => void;
  presetMotion: (kind: "fade" | "slide" | "spin" | "pulse") => void;
  boneAngles: (
    id: string,
    angles: Record<string, number>,
    record?: boolean,
  ) => void;
  addScene: () => void;
  switchScene: (id: string) => void;
  sceneAction: (
    id: string,
    action: "duplicate" | "delete" | "up" | "down" | "rename",
    name?: string,
  ) => void;
  timing: (length: number, fps?: number) => void;
  workArea: (start: number, end: number) => void;
  media: (
    asset: Asset,
    expected: string,
    reference?: boolean,
    companion?: Asset,
  ) => boolean;
  splitClip: () => void;
  removeReference: (id: string) => void;
  referenceNote: (id: string, name: string, notes: string) => void;
  editSound: (id: string, patch: Partial<Scene["sounds"][number]>) => void;
  bind: (layer: string, rig: string | null, bone?: string) => void;
}
let gesture: Document | null = null;
export const useStudio = create<Studio>((set, get) => ({
  document: null,
  sceneId: "",
  workspace: "Draw",
  view: "home",
  frame: 0,
  playing: false,
  selected: [],
  bone: null,
  tool: "brush",
  zoom: 100,
  pan: { x: 0, y: 0 },
  preferences: settings(),
  dialog: null,
  history: [],
  future: [],
  busy: false,
  interacting: false,
  library: [],
  ready: false,
  saveState: "saved",
  notice: null,
  keySelection: [],
  keyClipboard: [],
  navigator: "layers",
  popout: null,
  focused: false,
  frameWidth: 11,
  set: (patch) => set(patch),
  notify: (text, error = false) => set({ notice: { text, error, id: uid() } }),
  pref: (k, value) =>
    set((s) => ({ preferences: { ...s.preferences, [k]: value } })),
  open: (d, w = "Draw") => {
    const doc = validateDocument(d);
    set({
      document: doc,
      sceneId: doc.scenes[0].id,
      workspace: w,
      view: "studio",
      frame: 0,
      selected: doc.scenes[0].layers[0] ? [doc.scenes[0].layers[0].id] : [],
      tool: w === "Draw" ? "brush" : "select",
      history: [],
      future: [],
      playing: false,
      dialog: null,
      pan: { x: 0, y: 0 },
      zoom: 100,
      bone: null,
      keySelection: [],
      focused: false,
    });
  },
  create: (w, title, canvas) => get().open(createDocument(w, title, canvas), w),
  commit: (label, change, owned = false) => {
    const s = get();
    if (!s.document || s.interacting || (s.busy && !owned)) return false;
    try {
      const next = clone(s.document),
        active = next.scenes.find((sc) => sc.id === s.sceneId)!;
      if (!active) return false;
      change(next, active);
      const valid = validateDocument(next);
      set({
        document: valid,
        history: [...s.history.slice(-39), s.document],
        future: [],
        playing: false,
        saveState: "saving",
      });
      return true;
    } catch (e) {
      s.notify(
        `${label}: ${e instanceof Error ? e.message : "operation failed"}`,
        true,
      );
      return false;
    }
  },
  undo: () => {
    const s = get();
    if (s.busy || s.interacting || !s.history.length) return;
    const d = s.history.at(-1)!;
    set({
      document: d,
      history: s.history.slice(0, -1),
      future: [s.document!, ...s.future],
      sceneId: d.scenes.some((sc) => sc.id === s.sceneId)
        ? s.sceneId
        : d.scenes[0].id,
      frame: Math.max(
        0,
        Math.min(
          s.frame,
          (d.scenes.find((sc) => sc.id === s.sceneId)?.length ?? 2) - 1,
        ),
      ),
      playing: false,
      saveState: "saving",
      keySelection: [],
    });
  },
  redo: () => {
    const s = get();
    if (s.busy || s.interacting || !s.future.length) return;
    const d = s.future[0];
    set({
      document: d,
      history: [...s.history, s.document!],
      future: s.future.slice(1),
      sceneId: d.scenes.some((sc) => sc.id === s.sceneId)
        ? s.sceneId
        : d.scenes[0].id,
      playing: false,
      saveState: "saving",
      keySelection: [],
    });
  },
  select: (id, additive = false) =>
    set((s) => ({
      selected: id
        ? additive
          ? s.selected.includes(id)
            ? s.selected.filter((v) => v !== id)
            : [...s.selected, id]
          : [id]
        : [],
      bone: null,
      keySelection: [],
    })),
  add: (kind, shape) => {
    let id = "";
    const ok = get().commit("Insert layer", (d, s) => {
      const l = layer(kind, d.canvas);
      if (shape) {
        l.shape = shape;
        l.name =
          shape === "rect"
            ? "Rectangle"
            : shape === "ellipse"
              ? "Ellipse"
              : "Star";
      }
      l.end = s.length;
      s.layers.push(l);
      id = l.id;
    });
    if (ok)
      set({
        selected: [id],
        tool: kind === "paint" ? "brush" : "select",
        navigator: "layers",
      });
  },
  remove: () => {
    const selected = new Set(get().selected);
    get().commit("Delete selection", (_d, s) => {
      const allowed = new Set(
        s.layers
          .filter((l) => selected.has(l.id) && !locked(l, s.layers))
          .map((l) => l.id),
      );
      let changed = true;
      while (changed) {
        changed = false;
        for (const l of s.layers)
          if (
            !allowed.has(l.id) &&
            ((l.parent && allowed.has(l.parent)) ||
              (l.bind && allowed.has(l.bind.rig)))
          ) {
            allowed.add(l.id);
            changed = true;
          }
      }
      const sounds = new Set(
        s.layers.filter((l) => allowed.has(l.id)).map((l) => l.sound),
      );
      s.layers = s.layers.filter((l) => !allowed.has(l.id));
      s.sounds = s.sounds.filter((a) => !sounds.has(a.id));
    });
    set({ selected: [], bone: null });
  },
  duplicate: () => {
    const selected = new Set(get().selected),
      created: string[] = [];
    const ok = get().commit("Duplicate selection", (_d, s) => {
      let changed = true;
      while (changed) {
        changed = false;
        for (const l of s.layers)
          if (l.parent && selected.has(l.parent) && !selected.has(l.id)) {
            selected.add(l.id);
            changed = true;
          }
      }
      const mapping = new Map(
        s.layers.filter((l) => selected.has(l.id)).map((l) => [l.id, uid()]),
      );
      for (const l of [...s.layers])
        if (mapping.has(l.id)) {
          const copy = structuredClone(l);
          copy.id = mapping.get(l.id)!;
          copy.name += " copy";
          copy.parent = l.parent ? (mapping.get(l.parent) ?? l.parent) : null;
          if (copy.bind)
            copy.bind.rig = mapping.get(copy.bind.rig) ?? copy.bind.rig;
          if (!copy.parent) {
            copy.transform.x += 24;
            copy.transform.y += 24;
          }
          copy.keys = copy.keys.map((k) => ({ ...k, id: uid() }));
          s.layers.push(copy);
          created.push(copy.id);
        }
    });
    if (ok) set({ selected: created });
  },
  group: () => {
    const s = get();
    let id = "";
    const ok = s.commit("Group selection", (d, sc) => {
      const ids = new Set(s.selected),
        roots = sc.layers.filter(
          (l) => ids.has(l.id) && !l.parent && !l.bind && !locked(l, sc.layers),
        );
      if (roots.length < 2)
        throw new Error("Select at least two unlocked root layers.");
      const group = layer("group", d.canvas);
      group.end = sc.length;
      id = group.id;
      sc.layers.push(group);
      for (const l of roots) l.parent = id;
    });
    if (ok) set({ selected: [id] });
  },
  ungroup: () => {
    const id = get().selected[0];
    get().commit("Ungroup", (_d, s) => {
      const group = s.layers.find((l) => l.id === id && l.kind === "group");
      if (!group) return;
      if (
        group.keys.length ||
        Object.entries(group.transform).some(
          ([key, v]) =>
            v !== (identity() as unknown as Record<string, number>)[key],
        )
      )
        throw new Error(
          "Keep transformed/animated groups intact to preserve motion.",
        );
      s.layers = s.layers
        .filter((l) => l.id !== id)
        .map((l) => (l.parent === id ? { ...l, parent: null } : l));
    });
  },
  arrange: (id, direction) =>
    get().commit("Arrange layer", (_d, s) => {
      const i = s.layers.findIndex((l) => l.id === id),
        j = clamp(i + direction, 0, s.layers.length - 1);
      if (i >= 0) {
        const [l] = s.layers.splice(i, 1);
        s.layers.splice(j, 0, l);
      }
    }),
  patchLayer: (id, patch) =>
    get().commit("Layer properties", (_d, s) => {
      const l = s.layers.find((l) => l.id === id);
      if (
        l &&
        (!locked(l, s.layers) ||
          Object.keys(patch).every((k) => k === "locked" || k === "visible"))
      ) {
        Object.assign(l, patch);
        if (l.sound && l.kind === "video") {
          const a = s.sounds.find((a) => a.id === l.sound);
          if (a) {
            a.start = l.start;
            a.end = l.end;
            a.trim = l.sourceIn;
          }
        }
      }
    }),
  transform: (id, patch, record = true) => {
    const s = get(),
      sc = target(s),
      l = sc?.layers.find((l) => l.id === id);
    if (!l || locked(l, sc!.layers)) return;
    const update = (node: Layer) => {
      const safe = { ...patch };
      if (safe.scaleX !== undefined)
        safe.scaleX = clamp(safe.scaleX, 0.01, 100);
      if (safe.scaleY !== undefined)
        safe.scaleY = clamp(safe.scaleY, 0.01, 100);
      if (safe.opacity !== undefined) safe.opacity = clamp(safe.opacity, 0, 1);
      if (s.frame > 0 && s.preferences.autoKey) writeKey(node, s.frame, safe);
      else node.transform = { ...node.transform, ...safe };
    };
    if (record)
      s.commit("Transform", (_d, scene) =>
        update(scene.layers.find((l) => l.id === id)!),
      );
    else if (s.document)
      set({
        document: {
          ...s.document,
          scenes: s.document.scenes.map((scene) =>
            scene.id === s.sceneId
              ? {
                  ...scene,
                  layers: scene.layers.map((node) => {
                    if (node.id !== id) return node;
                    const copy = {
                      ...node,
                      transform: { ...node.transform },
                      keys: node.keys.map((k) => ({
                        ...k,
                        values: { ...k.values },
                      })),
                    };
                    update(copy);
                    return copy;
                  }),
                }
              : scene,
          ),
        },
        saveState: "saving",
      });
  },
  beginGesture: () => {
    const s = get();
    if (s.document && !s.busy && !s.interacting) {
      gesture = s.document;
      set({ interacting: true, playing: false });
    }
  },
  endGesture: () => {
    const s = get();
    if (!gesture) return;
    const original = gesture;
    gesture = null;
    try {
      if (s.document !== original) {
        const valid = validateDocument(s.document);
        set({
          document: valid,
          history: [...s.history.slice(-39), original],
          future: [],
          saveState: "saving",
        });
      }
    } catch (e) {
      set({ document: original });
      s.notify(e instanceof Error ? e.message : "Gesture refused.", true);
    }
    set({ interacting: false });
  },
  cancelGesture: () => {
    if (gesture) set({ document: gesture, interacting: false });
    gesture = null;
  },
  addMark: (mark, expected) => {
    const s = get();
    if (
      !s.document ||
      s.document.id !== expected.document ||
      s.sceneId !== expected.scene ||
      s.frame !== expected.frame
    ) {
      s.notify("The drawing target changed. Stroke cancelled.");
      return false;
    }
    let id = expected.layer;
    const ok = s.commit("Paint", (d, sc) => {
      let l = sc.layers.find((l) => l.id === id && l.kind === "paint");
      if (!l) {
        if (mark.tool === "erase" || mark.tool === "fill")
          throw new Error("Select an unlocked drawing layer first.");
        l = layer(
          "paint",
          d.canvas,
          `Drawing ${sc.layers.filter((l) => l.kind === "paint").length + 1}`,
        );
        l.end = sc.length;
        sc.layers.push(l);
        id = l.id;
      }
      if (locked(l, sc.layers))
        throw new Error("This drawing layer is locked.");
      if (mark.tool === "erase" && !celAt(l, s.frame)?.marks.length)
        throw new Error("No marks to erase on this cel.");
      let cel = l.cels?.find((c) => c.frame === s.frame);
      if (!cel) {
        cel = {
          frame: s.frame,
          marks: structuredClone(celAt(l, s.frame)?.marks ?? []),
        };
        l.cels = [...(l.cels ?? []), cel].sort((a, b) => a.frame - b.frame);
      }
      cel.marks.push(mark);
    });
    if (ok) set({ selected: [id!] });
    return ok;
  },
  newCel: (copy, next = true) => {
    const s = get();
    let id = "";
    const ok = s.commit(copy ? "Duplicate cel" : "Blank cel", (d, sc) => {
      let l = sc.layers.find(
        (l) => s.selected.includes(l.id) && l.kind === "paint",
      );
      if (!l) {
        l = layer("paint", d.canvas);
        l.end = sc.length;
        sc.layers.push(l);
      }
      if (locked(l, sc.layers)) throw new Error("Unlock the drawing layer.");
      const f = s.frame + (next ? 1 : 0);
      if (f >= MAX_FRAMES) throw new Error("Scene limit: 1,800 frames.");
      const marks = copy ? structuredClone(celAt(l, s.frame)?.marks ?? []) : [];
      if (f >= sc.length) extend(sc, f + 1);
      l.cels = [
        ...(l.cels ?? []).filter((c) => c.frame !== f),
        { frame: f, marks },
      ].sort((a, b) => a.frame - b.frame);
      id = l.id;
    });
    if (ok) set({ selected: [id], frame: s.frame + (next ? 1 : 0) });
  },
  editCel: (id, frame, action, to) =>
    get().commit("Edit cel", (_d, sc) => {
      const l = sc.layers.find((l) => l.id === id);
      if (!l || locked(l, sc.layers)) return;
      if (action === "delete")
        l.cels = l.cels?.filter((c) => c.frame !== frame);
      else {
        const c = l.cels?.find((c) => c.frame === frame);
        if (c && Number.isInteger(to) && to! >= 0 && to! < sc.length)
          l.cels = [
            ...l.cels!.filter((c) => c.frame !== frame && c.frame !== to),
            { ...c, frame: to! },
          ].sort((a, b) => a.frame - b.frame);
      }
    }),
  reverseCels: (start, end) => {
    const state = get();
    state.commit("Reverse exposures", (_d, sc) => {
      if (start < 0 || end < start || end >= sc.length)
        throw new Error("Select a valid range.");
      for (const l of sc.layers.filter(
        (l) =>
          l.kind === "paint" &&
          !locked(l, sc.layers) &&
          (state.selected.includes(l.id) || !state.selected.length),
      )) {
        const frames = Array.from({ length: end - start + 1 }, (_, i) =>
            structuredClone(celAt(l, start + i)?.marks ?? []),
          ).reverse(),
          after = structuredClone(celAt(l, end + 1)?.marks ?? []);
        l.cels = [
          ...(l.cels ?? []).filter((c) => c.frame < start || c.frame > end),
          ...frames.map((marks, i) => ({ frame: start + i, marks })),
        ];
        if (
          l.held &&
          end + 1 < sc.length &&
          !l.cels.some((c) => c.frame === end + 1)
        )
          l.cels.push({ frame: end + 1, marks: after });
        l.cels.sort((a, b) => a.frame - b.frame);
      }
    });
  },
  addKey: () => {
    const state = get();
    state.commit("Insert keyframe", (_d, sc) => {
      for (const l of sc.layers.filter(
        (l) => state.selected.includes(l.id) && !locked(l, sc.layers),
      )) {
        const values: Key["values"] = { ...pose(l, state.frame) };
        for (const b of l.bones ?? [])
          values[`bone:${b.id}`] = channelAt(
            b.angle,
            l.keys,
            `bone:${b.id}`,
            state.frame,
          );
        writeKey(l, state.frame, values);
      }
    });
  },
  deleteKeys: () => {
    const selected = get().keySelection;
    get().commit("Delete keys", (_d, s) => {
      for (const l of s.layers)
        if (!locked(l, s.layers))
          l.keys = l.keys.filter(
            (k) => !selected.some((v) => v.layer === l.id && v.id === k.id),
          );
    });
    set({ keySelection: [] });
  },
  copyKeys: () => {
    const s = get(),
      sc = target(s);
    if (!sc) return;
    set({
      keyClipboard: sc.layers.flatMap((l) =>
        l.keys
          .filter((k) =>
            s.keySelection.some((v) => v.layer === l.id && v.id === k.id),
          )
          .map((k) => ({ layer: l.id, key: structuredClone(k) })),
      ),
    });
  },
  pasteKeys: () => {
    const s = get(),
      clipboard = s.keyClipboard;
    if (!clipboard.length) return;
    const from = Math.min(...clipboard.map((k) => k.key.frame));
    s.commit("Paste keys", (_d, sc) => {
      for (const entry of clipboard) {
        const l = sc.layers.find((l) => l.id === entry.layer),
          f = s.frame + entry.key.frame - from;
        if (l && !locked(l, sc.layers) && f < sc.length) {
          l.keys = [
            ...l.keys.filter((k) => k.frame !== f),
            { ...structuredClone(entry.key), id: uid(), frame: f },
          ].sort((a, b) => a.frame - b.frame);
        }
      }
    });
  },
  moveKey: (id, key, to) =>
    get().commit("Move keyframe", (_d, s) => {
      const l = s.layers.find((l) => l.id === id),
        k = l?.keys.find((k) => k.id === key);
      if (l && k && !locked(l, s.layers)) {
        const f = clamp(Math.round(to), 0, s.length - 1);
        l.keys = [
          ...l.keys.filter((v) => v.id !== key && v.frame !== f),
          { ...k, frame: f },
        ].sort((a, b) => a.frame - b.frame);
      }
    }),
  easing: (easing, curve) => {
    const sel = get().keySelection;
    get().commit("Keyframe easing", (_d, s) => {
      for (const l of s.layers)
        for (const k of l.keys)
          if (sel.some((v) => v.layer === l.id && v.id === k.id)) {
            k.easing = easing;
            if (curve) k.curve = curve;
          }
    });
  },
  presetMotion: (kind) => {
    const st = get();
    st.commit("Motion preset", (_d, s) => {
      for (const l of s.layers.filter(
        (l) => st.selected.includes(l.id) && !locked(l, s.layers),
      )) {
        const p = pose(l, st.frame),
          end = Math.min(s.length - 1, st.frame + 48);
        if (kind === "fade") {
          writeKey(l, st.frame, { opacity: 0 });
          writeKey(l, end, { opacity: p.opacity });
        }
        if (kind === "slide") {
          writeKey(l, st.frame, { x: p.x - 160, opacity: 0 });
          writeKey(l, end, { x: p.x, opacity: 1 });
        }
        if (kind === "spin") {
          writeKey(l, st.frame, { rotation: p.rotation });
          writeKey(l, end, { rotation: p.rotation + 360 });
        }
        if (kind === "pulse") {
          writeKey(l, st.frame, { scaleX: p.scaleX, scaleY: p.scaleY });
          writeKey(l, Math.floor((st.frame + end) / 2), {
            scaleX: p.scaleX * 1.2,
            scaleY: p.scaleY * 1.2,
          });
          writeKey(l, end, { scaleX: p.scaleX, scaleY: p.scaleY });
        }
      }
    });
  },
  boneAngles: (id, angles, record = true) => {
    const s = get();
    const apply = (l: Layer) => {
      for (const b of l.bones ?? [])
        if (angles[b.id] !== undefined) {
          const angle = clamp(angles[b.id], b.min, b.max);
          if (s.preferences.autoKey && s.frame > 0)
            writeKey(l, s.frame, { [`bone:${b.id}`]: angle });
          else b.angle = angle;
        }
    };
    if (record)
      s.commit("Pose rig", (_d, sc) => {
        const l = sc.layers.find((l) => l.id === id);
        if (l && !locked(l, sc.layers)) apply(l);
      });
    else if (s.document)
      set({
        document: {
          ...s.document,
          scenes: s.document.scenes.map((sc) =>
            sc.id === s.sceneId
              ? {
                  ...sc,
                  layers: sc.layers.map((l) => {
                    if (l.id !== id) return l;
                    const copy = structuredClone(l);
                    apply(copy);
                    return copy;
                  }),
                }
              : sc,
          ),
        },
        saveState: "saving",
      });
  },
  addScene: () => {
    let id = "";
    const ok = get().commit("Add scene", (d) => {
      const s = scene(d.canvas, d.scenes.length + 1);
      d.scenes.push(s);
      id = s.id;
    });
    if (ok) get().switchScene(id);
  },
  switchScene: (id) => {
    if (
      get().document?.scenes.some((s) => s.id === id) &&
      !get().busy &&
      !get().interacting
    )
      set({
        sceneId: id,
        frame: 0,
        selected: [],
        bone: null,
        playing: false,
        keySelection: [],
      });
  },
  sceneAction: (id, action, name) => {
    const ok = get().commit("Manage scene", (d) => {
      const i = d.scenes.findIndex((s) => s.id === id);
      if (i < 0) return;
      if (action === "rename") {
        d.scenes[i].name = name?.trim().slice(0, 100) || d.scenes[i].name;
      }
      if (action === "delete") {
        if (d.scenes.length < 2) throw new Error("Keep at least one scene.");
        d.scenes.splice(i, 1);
      }
      if (action === "duplicate") {
        const copy = structuredClone(d.scenes[i]);
        copy.id = uid();
        copy.name += " copy";
        const map = new Map(copy.layers.map((l) => [l.id, uid()]));
        for (const l of copy.layers) {
          l.id = map.get(l.id)!;
          if (l.parent) l.parent = map.get(l.parent)!;
          if (l.bind) l.bind.rig = map.get(l.bind.rig)!;
          l.keys = l.keys.map((k) => ({ ...k, id: uid() }));
        }
        const audioMap = new Map(copy.sounds.map((a) => [a.id, uid()]));
        copy.sounds = copy.sounds.map((a) => ({
          ...a,
          id: audioMap.get(a.id)!,
        }));
        for (const l of copy.layers)
          if (l.sound) l.sound = audioMap.get(l.sound);
        d.scenes.splice(i + 1, 0, copy);
      }
      if (action === "up" || action === "down") {
        const j = clamp(i + (action === "up" ? -1 : 1), 0, d.scenes.length - 1),
          [s] = d.scenes.splice(i, 1);
        d.scenes.splice(j, 0, s);
      }
    });
    if (ok && !get().document!.scenes.some((s) => s.id === get().sceneId))
      get().switchScene(get().document!.scenes[0].id);
  },
  timing: (length, fps) => {
    const state = get();
    const ok = state.commit("Scene timing", (d, s) => {
      extend(s, Math.round(length));
      if (fps) d.canvas.fps = fps;
    });
    if (ok)
      set({
        frame: Math.max(0, Math.min(state.frame, Math.round(length) - 1)),
      });
  },
  workArea: (start, end) =>
    get().commit("Work area", (_d, s) => {
      s.work = [
        clamp(Math.round(start), 0, s.length - 1),
        clamp(Math.round(end), Math.max(0, start), s.length - 1),
      ];
    }),
  media: (asset, expected, reference = false, companion) => {
    const st = get();
    if (st.document?.id !== expected) {
      st.notify("Document changed during import.", true);
      return false;
    }
    let selected = "";
    const ok = st.commit(
      "Import media",
      (d, s) => {
        d.assets.push(asset);
        if (companion) d.assets.push(companion);
        if (reference) {
          if (asset.kind !== "image")
            throw new Error("Use an image reference.");
          d.references.push({
            id: uid(),
            asset: asset.id,
            name: asset.name,
            notes: "",
          });
          return;
        }
        if (asset.kind === "audio") {
          const length = Math.min(
            MAX_FRAMES,
            Math.max(
              s.length,
              st.frame + Math.ceil(asset.duration * d.canvas.fps),
            ),
          );
          extend(s, length);
          s.sounds.push({
            id: uid(),
            asset: asset.id,
            name: asset.name,
            start: st.frame,
            trim: 0,
            end: Math.min(
              s.length,
              st.frame + Math.ceil(asset.duration * d.canvas.fps),
            ),
            gain: 1,
            muted: false,
          });
          return;
        }
        const node = layer(
          asset.kind === "video" ? "video" : "image",
          d.canvas,
          asset.name,
        );
        node.asset = asset.id;
        node.width = asset.width;
        node.height = asset.height;
        const fit = Math.min(
          1,
          (d.canvas.width * 0.65) / asset.width,
          (d.canvas.height * 0.7) / asset.height,
        );
        node.transform.scaleX = node.transform.scaleY = fit;
        node.start = st.frame;
        if (asset.kind === "video")
          extend(
            s,
            Math.max(
              s.length,
              Math.min(
                MAX_FRAMES,
                st.frame + Math.ceil(asset.duration * d.canvas.fps),
              ),
            ),
          );
        node.end =
          asset.kind === "video"
            ? Math.min(
                s.length,
                st.frame + Math.ceil(asset.duration * d.canvas.fps),
              )
            : s.length;
        if (companion) {
          const audio = {
            id: uid(),
            asset: companion.id,
            name: companion.name,
            start: st.frame,
            trim: 0,
            end: node.end,
            gain: 1,
            muted: false,
          };
          s.sounds.push(audio);
          node.sound = audio.id;
        }
        s.layers.push(node);
        selected = node.id;
      },
      true,
    );
    if (ok && selected) set({ selected: [selected], tool: "select" });
    return ok;
  },
  splitClip: () => {
    const st = get();
    st.commit("Split clip", (_d, sc) => {
      const original = sc.layers.find(
        (l) => l.id === st.selected[0] && l.kind === "video",
      );
      if (
        !original ||
        locked(original, sc.layers) ||
        st.frame <= original.start ||
        st.frame >= original.end
      )
        throw new Error("Place the playhead inside an unlocked video clip.");
      const copy = structuredClone(original),
        oldEnd = original.end;
      copy.id = uid();
      copy.name += " / split";
      copy.start = st.frame;
      copy.sourceIn =
        original.sourceIn +
        (st.frame - original.start) / st.document!.canvas.fps;
      copy.keys = copy.keys.map((k) => ({ ...k, id: uid() }));
      original.end = st.frame;
      if (original.sound) {
        const sound = sc.sounds.find((a) => a.id === original.sound);
        if (sound) {
          const tail = {
            ...sound,
            id: uid(),
            start: st.frame,
            trim:
              sound.trim + (st.frame - sound.start) / st.document!.canvas.fps,
            end: oldEnd,
          };
          sound.end = st.frame;
          sc.sounds.push(tail);
          copy.sound = tail.id;
        }
      }
      sc.layers.splice(sc.layers.indexOf(original) + 1, 0, copy);
    });
  },
  removeReference: (id) =>
    get().commit("Remove reference", (d) => {
      d.references = d.references.filter((r) => r.id !== id);
    }),
  referenceNote: (id, name, notes) =>
    get().commit("Reference notes", (d) => {
      const r = d.references.find((r) => r.id === id);
      if (r) {
        r.name = name.trim() || r.name;
        r.notes = notes;
      }
    }),
  editSound: (id, patch) =>
    get().commit("Sound clip", (_d, s) => {
      const sound = s.sounds.find((a) => a.id === id);
      if (sound) Object.assign(sound, patch);
    }),
  bind: (id, rig, bone) =>
    get().commit("Bone attachment", (_d, s) => {
      const l = s.layers.find((l) => l.id === id);
      if (l) {
        if (rig && bone) {
          l.bind = { rig, bone };
          l.parent = null;
          l.transform.x = l.transform.y = 0;
        } else delete l.bind;
      }
    }),
}));
let timer: ReturnType<typeof setTimeout> | undefined;
useStudio.subscribe((s, old) => {
  if (s.preferences === old.preferences) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(
        SETTINGS,
        JSON.stringify(useStudio.getState().preferences),
      );
    } catch {
      /* Never block project saves. */
    }
  }, 180);
});
export function currentScene(): Scene | undefined {
  return target(useStudio.getState());
}
export function selectedLayer(): Layer | undefined {
  const s = useStudio.getState();
  return target(s)?.layers.find((l) => l.id === s.selected[0]);
}
export function keyChannels(layer: Layer): Channel[] {
  return [
    ...new Set(layer.keys.flatMap((k) => Object.keys(k.values) as Channel[])),
  ];
}
export { bonesAt };
