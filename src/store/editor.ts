import { create } from 'zustand';
import { capturePose, createPreset, sampleItem } from '../engine/animation';
import { createCharacter, createProject, createShape, parseProject, uid } from '../engine/project';
import { clamp, createMiloRig } from '../engine/rig';
import type { Dialog, Keyframe, Point, Preferences, Preset, Project, SceneItem, ShapeKind, Tool } from '../engine/types';

export const STORAGE_KEY = 'luno.project.v1';
export const PREFS_KEY = 'luno.preferences.v1';
let recoveryMessage = '';
function initialProject(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return parseProject(raw);
  } catch {
    recoveryMessage = 'Your previous project could not be opened. A recovery copy has been kept in local storage.';
    try { localStorage.setItem('luno.recovery.v1', localStorage.getItem(STORAGE_KEY) ?? ''); } catch { /* Storage may be unavailable. */ }
  }
  const p = createProject();
  const character = p.items.find(i => i.type === 'character')!;
  p.keyframes[character.id] = createPreset(character, 'wave', p.duration);
  return p;
}
function initialPreferences(): Preferences {
  const defaults: Preferences = { onboardingComplete: false, showBones: true, showGrid: false, loop: true, autoKey: true, theme: 'light' };
  try {
    const value = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    for (const key of ['onboardingComplete', 'showBones', 'showGrid', 'loop', 'autoKey'] as const) {
      if (typeof value[key] === 'boolean') defaults[key] = value[key];
    }
    if (value.theme === 'dark') defaults.theme = 'dark';
  } catch { /* Defaults are safe when storage is unavailable. */ }
  return defaults;
}
const initial = initialProject();
const clone = <T,>(object: T): T => structuredClone(object);

interface Toast { id: string; message: string; tone: 'success' | 'info' | 'error' }
interface EditorStore {
  project: Project;
  selectedId: string | null;
  selectedBone: string | null;
  frame: number;
  playing: boolean;
  tool: Tool;
  zoom: number;
  pan: Point;
  preferences: Preferences;
  dialog: Dialog;
  leftTab: 'layers' | 'assets';
  history: Project[];
  future: Project[];
  toast: Toast | null;
  savedAt: number;
  saveStatus: 'saving' | 'saved' | 'error';
  setSaveStatus: (status: 'saving' | 'saved' | 'error') => void;
  checkpoint: () => void;
  replaceProject: (p: Project, keepHistory?: boolean) => void;
  setName: (name: string) => void;
  select: (id: string | null) => void;
  selectBone: (id: string | null) => void;
  setTool: (tool: Tool) => void;
  setFrame: (frame: number) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: Point) => void;
  setDialog: (dialog: Dialog) => void;
  setLeftTab: (tab: 'layers' | 'assets') => void;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  editItem: (id: string, patch: Partial<SceneItem>, record?: boolean) => void;
  editBone: (id: string, angles: Record<string, number>, record?: boolean) => void;
  addItem: (item: SceneItem) => void;
  addCharacter: () => void;
  addShape: (shape: ShapeKind) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  moveLayer: (id: string, direction: 'up' | 'down') => void;
  addKeyframe: () => void;
  removeKeyframe: (itemId: string, frame: number) => void;
  moveKeyframe: (itemId: string, from: number, to: number) => void;
  setEasing: (easing: Keyframe['easing']) => void;
  applyPreset: (preset: Preset) => void;
  resetRig: () => void;
  addBone: () => void;
  resizeProject: (settings: Partial<Pick<Project, 'width' | 'height' | 'fps' | 'duration' | 'background'>>) => void;
  undo: () => void;
  redo: () => void;
  notify: (message: string, tone?: Toast['tone']) => void;
  clearToast: () => void;
  markSaved: () => void;
}

function writeKeyframe(project: Project, item: SceneItem, frame: number) {
  const keys = project.keyframes[item.id] ?? [];
  const existing = keys.find(k => k.frame === frame);
  const key: Keyframe = { id: existing?.id ?? uid(), frame, easing: existing?.easing ?? 'ease-in-out', values: capturePose(item) };
  project.keyframes[item.id] = [...keys.filter(k => k.frame !== frame), key].sort((a, b) => a.frame - b.frame);
}

export const useEditor = create<EditorStore>((set, get) => ({
  project: initial,
  selectedId: initial.items.find(i => i.type === 'character')?.id ?? initial.items.at(-1)?.id ?? null,
  selectedBone: null,
  frame: 0, playing: false, tool: 'select', zoom: 100, pan: { x: 0, y: 0 },
  preferences: initialPreferences(),
  dialog: window.luno && !initialPreferences().onboardingComplete ? 'setup' : null,
  leftTab: 'layers', history: [], future: [],
  toast: recoveryMessage ? { id: uid(), message: recoveryMessage, tone: 'error' } : null,
  savedAt: Date.now(), saveStatus: 'saving',
  checkpoint: () => set(s => ({ history: [...s.history.slice(-39), clone(s.project)], future: [] })),
  replaceProject: (project, keepHistory = true) => {
    if (keepHistory) get().checkpoint();
    set({ project, selectedId: project.items.find(i => i.type === 'character')?.id ?? project.items.at(-1)?.id ?? null, selectedBone: null, frame: 0, playing: false, zoom: 100, pan: { x: 0, y: 0 }, ...(!keepHistory ? { history: [], future: [] } : {}) });
  },
  setName: name => { if (!name.trim()) return; get().checkpoint(); set(s => ({ project: { ...s.project, name: name.trim().slice(0, 100) } })); },
  select: id => set({ selectedId: id, selectedBone: null }),
  selectBone: id => set({ selectedBone: id }),
  setTool: tool => set({ tool, playing: false }),
  setFrame: frame => set(s => ({ frame: clamp(Math.round(frame), 0, s.project.duration - 1) })),
  setPlaying: playing => set(s => ({ playing, frame: playing && s.frame >= s.project.duration - 1 ? 0 : s.frame })),
  setZoom: zoom => set({ zoom: clamp(zoom, 25, 300) }),
  setPan: pan => set({ pan }),
  setDialog: dialog => set({ dialog, playing: false }),
  setLeftTab: leftTab => set({ leftTab }),
  setPreference: (key, value) => set(s => ({ preferences: { ...s.preferences, [key]: value } })),
  editItem: (id, patch, record = true) => {
    const state = get();
    const item = state.project.items.find(i => i.id === id);
    if (!item) return;
    if (record) state.checkpoint();
    const project = clone(state.project);
    const index = project.items.findIndex(i => i.id === id);
    const animatedKeys = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity'];
    const transforms = Object.keys(patch).some(k => animatedKeys.includes(k));
    if (transforms && state.preferences.autoKey && (state.frame > 0 || project.keyframes[id]?.length)) {
      const sampled = sampleItem(item, project.keyframes[id] ?? [], state.frame);
      if (state.frame > 0 && !project.keyframes[id]?.length) writeKeyframe(project, item, 0);
      writeKeyframe(project, { ...sampled, ...patch }, state.frame);
      const structural = Object.fromEntries(Object.entries(patch).filter(([key]) => !animatedKeys.includes(key)));
      project.items[index] = { ...project.items[index], ...structural };
    } else {
      project.items[index] = { ...project.items[index], ...patch };
      // Rest-pose edits intentionally do not overwrite animation channels.
    }
    set({ project });
  },
  editBone: (id, angles, record = true) => {
    const state = get();
    const item = state.project.items.find(i => i.id === id);
    if (!item?.rig) return;
    if (record) state.checkpoint();
    const project = clone(state.project);
    const sampled = sampleItem(item, project.keyframes[id] ?? [], state.frame);
    const rig = sampled.rig!;
    rig.bones = rig.bones.map(b => ({ ...b, angle: angles[b.id] ?? b.angle }));
    if (state.preferences.autoKey && (state.frame > 0 || project.keyframes[id]?.length)) {
      if (state.frame > 0 && !project.keyframes[id]?.length) writeKeyframe(project, item, 0);
      writeKeyframe(project, { ...sampled, rig }, state.frame);
    } else {
      project.items.find(i => i.id === id)!.rig = rig;
    }
    set({ project });
  },
  addItem: item => { get().checkpoint(); set(s => ({ project: { ...s.project, items: [...s.project.items, item] }, selectedId: item.id, selectedBone: null, tool: 'select' })); },
  addCharacter: () => { get().addItem(createCharacter(get().project.width / 2, get().project.height * 0.47)); get().notify('Milo is ready to pose. Drag a joint to try it.'); },
  addShape: shape => get().addItem(createShape(shape, get().project.width / 2, get().project.height / 2)),
  deleteSelected: () => {
    const { selectedId, project } = get();
    const item = project.items.find(i => i.id === selectedId);
    if (!item) return;
    if (item.locked) { get().notify('Unlock this layer before deleting it.', 'info'); return; }
    get().checkpoint();
    const keyframes = { ...project.keyframes }; delete keyframes[item.id];
    set({ project: { ...project, items: project.items.filter(i => i.id !== item.id), keyframes }, selectedId: null, selectedBone: null });
  },
  duplicateSelected: () => {
    const s = get(); const original = s.project.items.find(i => i.id === s.selectedId);
    if (!original) return;
    s.checkpoint();
    const item = { ...clone(original), id: uid(), name: `${original.name} copy`.slice(0, 100), x: original.x + 24, y: original.y + 24, locked: false };
    const keys = (s.project.keyframes[original.id] ?? []).map(k => ({ ...clone(k), id: uid(), values: { ...clone(k.values), x: (k.values.x ?? original.x) + 24, y: (k.values.y ?? original.y) + 24 } }));
    set({ project: { ...s.project, items: [...s.project.items, item], keyframes: { ...s.project.keyframes, [item.id]: keys } }, selectedId: item.id });
  },
  moveLayer: (id, direction) => {
    const items = [...get().project.items]; const index = items.findIndex(i => i.id === id);
    const next = index + (direction === 'up' ? 1 : -1);
    if (index < 0 || next < 0 || next >= items.length) return;
    get().checkpoint(); [items[index], items[next]] = [items[next], items[index]];
    set(s => ({ project: { ...s.project, items } }));
  },
  addKeyframe: () => {
    const s = get(); const item = s.project.items.find(i => i.id === s.selectedId);
    if (!item) { s.notify('Select a layer to add a keyframe.', 'info'); return; }
    if (item.locked) { s.notify('Unlock this layer to add keyframes.', 'info'); return; }
    s.checkpoint(); const project = clone(s.project);
    if (s.frame > 0 && !project.keyframes[item.id]?.length) writeKeyframe(project, item, 0);
    writeKeyframe(project, sampleItem(item, project.keyframes[item.id] ?? [], s.frame), s.frame);
    set({ project }); s.notify(`Keyframe added at frame ${s.frame + 1}.`);
  },
  removeKeyframe: (id, frame) => {
    const item = get().project.items.find(i => i.id === id);
    if (!item || item.locked) { get().notify('Unlock this layer to edit keyframes.', 'info'); return; }
    get().checkpoint(); set(s => ({ project: { ...s.project, keyframes: { ...s.project.keyframes, [id]: (s.project.keyframes[id] ?? []).filter(k => k.frame !== frame) } } }));
  },
  moveKeyframe: (id, from, to) => {
    const s = get(); const key = s.project.keyframes[id]?.find(k => k.frame === from);
    if (!key || from === to || s.project.items.find(i => i.id === id)?.locked) return;
    s.checkpoint(); const frame = clamp(Math.round(to), 0, s.project.duration - 1);
    const keys = s.project.keyframes[id].filter(k => k.frame !== from && k.frame !== frame);
    set({ project: { ...s.project, keyframes: { ...s.project.keyframes, [id]: [...keys, { ...key, frame }].sort((a, b) => a.frame - b.frame) } } });
  },
  setEasing: easing => {
    const s = get(); if (!s.selectedId) return;
    const keys = s.project.keyframes[s.selectedId] ?? [];
    if (!keys.length) { s.notify('Add a keyframe first to choose its easing.', 'info'); return; }
    if (s.project.items.find(i => i.id === s.selectedId)?.locked) return;
    s.checkpoint();
    const nearest = [...keys].reverse().find(k => k.frame <= s.frame) ?? keys[0];
    set({ project: { ...s.project, keyframes: { ...s.project.keyframes, [s.selectedId]: keys.map(k => k.id === nearest.id ? { ...k, easing } : k) } } });
  },
  applyPreset: preset => {
    const s = get(); const item = s.project.items.find(i => i.id === s.selectedId);
    if (!item) { s.notify('Select an object to add a motion.', 'info'); return; }
    if (item.locked) { s.notify('Unlock this layer before animating it.', 'info'); return; }
    s.checkpoint();
    const keys = createPreset(item, preset, s.project.duration);
    set({ project: { ...s.project, keyframes: { ...s.project.keyframes, [item.id]: keys } }, frame: 0 });
    s.notify(`${preset[0].toUpperCase() + preset.slice(1)} motion added. Press play to see it.`);
  },
  resetRig: () => {
    const s = get(); const item = s.project.items.find(i => i.id === s.selectedId);
    if (!item?.rig || item.locked) return;
    const angles = Object.fromEntries(createMiloRig().bones.map(b => [b.id, b.angle]));
    s.editBone(item.id, angles); s.notify('Pose reset. Your other keyframes are unchanged.');
  },
  addBone: () => {
    const s = get(); const item = s.project.items.find(i => i.id === s.selectedId);
    if (!item?.rig || item.locked) { s.notify('Select an unlocked character to add a bone.', 'info'); return; }
    const id = uid(); const rig = clone(item.rig);
    rig.bones.push({ id, name: `Bone ${rig.bones.length + 1}`, parentId: s.selectedBone ?? 'spine', length: 70, angle: 35 });
    s.editItem(item.id, { rig }); set({ selectedBone: id, tool: 'rig' }); s.notify('Bone added. Adjust its length and angle in the inspector.');
  },
  resizeProject: settings => {
    get().checkpoint(); set(s => {
      const project = { ...s.project, ...settings };
      if (settings.duration) project.keyframes = Object.fromEntries(Object.entries(project.keyframes).map(([id, keys]) => [id, keys.filter(k => k.frame < settings.duration!)]));
      return { project, frame: Math.min(s.frame, project.duration - 1), playing: false };
    });
  },
  undo: () => { const s = get(); const previous = s.history.at(-1); if (!previous) return; set({ project: previous, history: s.history.slice(0, -1), future: [s.project, ...s.future].slice(0, 40), frame: Math.min(s.frame, previous.duration - 1), selectedId: previous.items.some(i => i.id === s.selectedId) ? s.selectedId : null, selectedBone: null, playing: false }); },
  redo: () => { const s = get(); const next = s.future[0]; if (!next) return; set({ project: next, history: [...s.history, s.project], future: s.future.slice(1), frame: Math.min(s.frame, next.duration - 1), selectedId: next.items.some(i => i.id === s.selectedId) ? s.selectedId : null, selectedBone: null, playing: false }); },
  notify: (message, tone = 'success') => set({ toast: { id: uid(), message, tone } }),
  clearToast: () => set({ toast: null }),
  setSaveStatus: saveStatus => set({ saveStatus }),
  markSaved: () => set({ savedAt: Date.now(), saveStatus: 'saved' }),
}));

export function useSelectedItem() {
  const project = useEditor(s => s.project);
  const selectedId = useEditor(s => s.selectedId);
  const frame = useEditor(s => s.frame);
  const item = project.items.find(i => i.id === selectedId);
  return item ? sampleItem(item, project.keyframes[item.id] ?? [], frame) : undefined;
}
