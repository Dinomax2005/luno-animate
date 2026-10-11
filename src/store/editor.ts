import { create } from 'zustand';
import { editClip, fadeClip, pruneMedia, type ClipEdit } from '../engine/clips';
import { capturePose, createPreset, sampleCamera, sampleCel, sampleItem } from '../engine/animation';
import { createCharacter, createProject, createDrawingLayer, createShape, createItem, createScene, activeScene, activateScene, createText, parseProject, uid } from '../engine/project';
import { sceneNodes, transformPoint, inverse, parentOf, isLayerLocked, multiply as multiplyForUngroup } from '../engine/geometry';
import { clamp, createMiloRig } from '../engine/rig';
import type { VideoAsset, MotionProperty, AudioClip, Camera, Dialog, Keyframe, KeyRef, Point, Preferences, Preset, Project, ProjectRecord, Scene, SceneItem, ShapeKind, Tool, View } from '../engine/types';

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
  const p = createProject('blank'); p.name = 'Untitled-1'; p.background = '#ffffff';
  return p;
}
function initialPreferences(): Preferences {
  const defaults: Preferences = { onboardingComplete: false, showBones: true, showGrid: false, loop: true, autoKey: true, theme: 'dark', onionSkin: false, onionBefore: 1, onionAfter: 1, showMotionPath: false, snapToGrid: false, gridSize: 20, inverseKinematics: true, brushColor: '#dc5e68', brushSize: 5, drawingMode: 'vector', automaticUpdates: true };
  try {
    const value = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    for (const key of ['onboardingComplete', 'showBones', 'showGrid', 'loop', 'autoKey', 'onionSkin', 'showMotionPath', 'snapToGrid', 'inverseKinematics', 'automaticUpdates'] as const) {
      if (typeof value[key] === 'boolean') defaults[key] = value[key];
    }
    if (typeof value.brushColor === 'string' && /^#[0-9a-f]{6}$/i.test(value.brushColor)) defaults.brushColor = value.brushColor;
    if (value.drawingMode === 'cel') defaults.drawingMode = 'cel';
    for (const key of ['onionBefore', 'onionAfter', 'gridSize', 'brushSize'] as const) if (typeof value[key] === 'number' && Number.isFinite(value[key])) defaults[key] = clamp(value[key], key.startsWith('onion') ? 0 : 1, key.startsWith('onion') ? 5 : 100);
    if (value.theme === 'dark' || value.theme === 'light') defaults.theme = value.theme;
  } catch { /* Defaults are safe when storage is unavailable. */ }
  return defaults;
}
const initial = initialProject();
const clone = <T,>(object: T): T => {
  // Decoded proxy assets are immutable and shared by clips/history, not copied on every pose edit.
  if (object && typeof object === 'object' && 'media' in object && 'sceneId' in object) {
    const p = object as unknown as Project; return { ...structuredClone({ ...p, media: [] }), media: p.media } as T;
  }
  return structuredClone(object);
};

interface Toast { id: string; message: string; tone: 'success' | 'info' | 'error' }
export interface EditorStore {
  view: View; libraryReady: boolean; projects: ProjectRecord[]; selectedIds: string[]; selectedCamera: boolean; selectedAudio: string | null;
  busy: boolean; interacting: boolean; blockReason: string | null; keySelection: KeyRef[]; keyClipboard: { itemId: string; key: Keyframe }[];
  setView: (view: View) => void; setLibrary: (projects: ProjectRecord[]) => void; toggleSelect: (id: string) => void; selectAll: () => void;
  selectCamera: () => void; selectAudio: (id: string | null) => void;
  setBusy: (busy: boolean) => void; setInteracting: (interacting: boolean) => void; setBlocked: (reason: string | null) => void;
  addScene: () => void; switchScene: (id: string) => void; duplicateScene: () => void; renameScene: (id: string, name: string) => void; deleteScene: (id: string) => void; reorderScene: (id: string, direction: number) => void;
  addText: () => void; addBlankRig: () => void; editBoneProperties: (itemId: string, boneId: string, patch: Partial<import('../engine/types').Bone>) => void;
  bindToBone: (itemId: string, characterId: string | null, boneId?: string) => void;
  groupSelected: () => void; ungroupSelected: () => void; alignSelected: (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  addCelStroke: (points: Point[]) => void; blankCel: () => void; duplicateCel: () => void; nextDrawingFrame: (kind: 'blank' | 'duplicate') => void; removeCel: (id: string, frame: number) => void; moveCel: (id: string, from: number, to: number) => void;
  editCamera: (patch: Partial<Pick<Camera, 'x' | 'y' | 'zoom' | 'rotation'>>, record?: boolean) => void; resetCamera: () => void;
  addAudio: (clip: AudioClip) => void; editAudio: (id: string, patch: Partial<Pick<AudioClip, 'name' | 'startFrame' | 'trimStart' | 'volume' | 'muted'>>, record?: boolean) => void; removeAudio: (id: string) => void;
  setWorkArea: (start: number, end: number) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  selectKey: (itemId: string, frame: number, additive?: boolean) => void; copyKeys: () => void; pasteKeys: () => void; deleteKeys: () => void; setBezier: (bezier: [number, number, number, number]) => void;

  addVideo: (asset: VideoAsset, item: SceneItem, audio?: AudioClip) => void;
  editClip: (id: string, kind: ClipEdit, at: number) => void;
  fadeClip: (id: string, kind: 'in' | 'out') => void;
  keyProperty: (property: MotionProperty) => void;
  editMotionProperty: (property: MotionProperty, value: number) => void;
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
  const key: Keyframe = { id: existing?.id ?? uid(), frame, easing: existing?.easing ?? (project.animationMode === 'frame-by-frame' ? 'hold' : 'ease-in-out'), ...(existing?.bezier ? { bezier: existing.bezier } : {}), values: capturePose(item) };
  project.keyframes[item.id] = [...keys.filter(k => k.frame !== frame), key].sort((a, b) => a.frame - b.frame);
}

export const useEditor = create<EditorStore>((set, get) => ({
  project: initial, view: 'home', libraryReady: false, projects: [], selectedIds: [initial.items.find(i => i.type === 'character')?.id ?? initial.items.at(-1)?.id].filter((id): id is string => !!id), selectedCamera: false, selectedAudio: null,
  busy: false, interacting: false, blockReason: null, keySelection: [], keyClipboard: [],
  setView: view => set({ view, playing: false }), setLibrary: projects => set({ projects, libraryReady: true }),
  toggleSelect: id => set(s => { const ids = s.selectedIds.includes(id) ? s.selectedIds.filter(i => i !== id) : [...s.selectedIds, id]; return { selectedIds: ids, selectedId: ids.at(-1) ?? null, selectedBone: null, selectedCamera: false, selectedAudio: null }; }),
  selectAll: () => set(s => ({ selectedIds: s.project.items.filter(i => i.type !== 'group' && !isLayerLocked(s.project.items, i.id)).map(i => i.id), selectedId: s.project.items.filter(i => !isLayerLocked(s.project.items, i.id)).at(-1)?.id ?? null, selectedBone: null, selectedCamera: false, selectedAudio: null })),
  selectCamera: () => set({ selectedId: null, selectedIds: [], selectedBone: null, selectedCamera: true, selectedAudio: null, tool: 'camera', playing: false }),
  selectAudio: id => set({ selectedAudio: id, selectedCamera: false, selectedId: null, selectedIds: [], selectedBone: null }),
  setBusy: busy => set({ busy }), setInteracting: interacting => set({ interacting }), setBlocked: blockReason => set({ blockReason, playing: false }),
  selectedId: initial.items.find(i => i.type === 'character')?.id ?? initial.items.at(-1)?.id ?? null,
  selectedBone: null,
  frame: 0, playing: false, tool: 'select', zoom: 100, pan: { x: 0, y: 0 },
  preferences: initialPreferences(),
  dialog: null,
  leftTab: 'layers', history: [], future: [],
  toast: recoveryMessage ? { id: uid(), message: recoveryMessage, tone: 'error' } : null,
  savedAt: Date.now(), saveStatus: 'saving',
  checkpoint: () => set(s => ({ history: [...s.history.slice(-39), clone(s.project)], future: [] })),
  replaceProject: (project, keepHistory = true) => {
    if (keepHistory) get().checkpoint();
    const manual = project.animationMode === 'frame-by-frame';
    const primary = (manual ? project.items.find(i => i.type === 'drawing')?.id : project.items.find(i => i.type === 'character')?.id) ?? project.items.at(-1)?.id ?? null;
    set({ project, view: 'editor', ...(!keepHistory || project.id !== get().project.id || project.animationMode !== get().project.animationMode ? { preferences: { ...get().preferences, drawingMode: manual ? 'cel' : 'vector', autoKey: manual ? false : get().project.animationMode === 'frame-by-frame' ? true : get().preferences.autoKey, onionSkin: manual, showBones: !manual }, tool: manual ? 'pen' as const : 'select' as const } : {}), selectedIds: primary ? [primary] : [], selectedCamera: false, selectedAudio: null, keySelection: [], selectedId: primary, selectedBone: null, frame: 0, playing: false, zoom: 100, pan: { x: 0, y: 0 }, ...(!keepHistory ? { history: [], future: [] } : {}) });
  },
  setName: name => { if (!name.trim()) return; get().checkpoint(); set(s => ({ project: { ...s.project, name: name.trim().slice(0, 100) } })); },
  select: id => set({ selectedId: id, selectedIds: id ? [id] : [], selectedBone: null, selectedCamera: false, selectedAudio: null, keySelection: [] }),
  selectBone: id => set({ selectedBone: id }),
  setTool: tool => { if (tool === 'camera') { get().selectCamera(); return; } set({ tool, playing: false, selectedCamera: false }); },
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
    if (!item || (isLayerLocked(state.project.items, id) && Object.keys(patch).some(key => !['locked', 'visible'].includes(key)))) return;
    if (record) state.checkpoint();
    const project = clone(state.project);
    const index = project.items.findIndex(i => i.id === id);
    const animatedKeys = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity', 'blur', 'brightness', 'saturation'];
    const transforms = Object.keys(patch).some(k => animatedKeys.includes(k));
    if (transforms && state.project.animationMode !== 'frame-by-frame' && state.preferences.autoKey && (state.frame > 0 || project.keyframes[id]?.length)) {
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
    if (!item?.rig || isLayerLocked(state.project.items, id)) return;
    if (record) state.checkpoint();
    const project = clone(state.project);
    const sampled = sampleItem(item, project.keyframes[id] ?? [], state.frame);
    const rig = sampled.rig!;
    rig.bones = rig.bones.map(b => ({ ...b, angle: b.locked ? b.angle : clamp(angles[b.id] ?? b.angle, b.minAngle ?? -100000, b.maxAngle ?? 100000) }));
    if (state.project.animationMode !== 'frame-by-frame' && state.preferences.autoKey && (state.frame > 0 || project.keyframes[id]?.length)) {
      if (state.frame > 0 && !project.keyframes[id]?.length) writeKeyframe(project, item, 0);
      writeKeyframe(project, { ...sampled, rig }, state.frame);
    } else {
      project.items.find(i => i.id === id)!.rig = rig;
    }
    set({ project });
  },
  nudgeSelected: (dx, dy) => {
    const state = get(); if (state.busy || state.blockReason || state.interacting || !Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return;
    const hasSelectedAncestor = (id: string) => { let parent = parentOf(state.project.items.find(i => i.id === id)!); const seen = new Set<string>(); while (parent && !seen.has(parent)) { if (state.selectedIds.includes(parent)) return true; seen.add(parent); const item = state.project.items.find(i => i.id === parent); parent = item ? parentOf(item) : null; } return false; };
    const targets = sceneNodes(state.project, state.frame).filter(n => state.selectedIds.includes(n.item.id) && !n.locked && !hasSelectedAncestor(n.item.id));
    if (!targets.length) return; state.checkpoint(); state.setPlaying(false);
    for (const n of targets) { const matrix = inverse(n.parentMatrix), start = transformPoint(matrix, { x: 0, y: 0 }), end = transformPoint(matrix, { x: dx, y: dy }); get().editItem(n.item.id, { x: n.item.x + end.x - start.x, y: n.item.y + end.y - start.y }, false); }
  },
  addItem: item => { if (get().project.items.length >= 500) { get().notify('This scene has reached its 500-layer limit.', 'error'); return; } get().checkpoint(); set(s => ({ project: { ...s.project, items: [...s.project.items, item] }, selectedId: item.id, selectedIds: [item.id], selectedBone: null, selectedCamera: false, selectedAudio: null, tool: 'select' })); },
  addVideo: (asset, item, audio) => {
    const s = get();
    if (s.project.items.length >= 500 || s.project.media.length >= 32 || audio && s.project.audio.length >= 32) throw new Error('This document has reached its layer, media, or sound limit.');
    const end = item.endFrame ?? s.project.duration, duration = s.project.animationMode === 'video-editing' && !s.project.items.length && !s.project.audio.length ? Math.max(2, end) : Math.max(s.project.duration, end);
    const project = { ...s.project, duration, workArea: { start: s.project.workArea.start, end: Math.min(duration - 1, Math.max(s.project.workArea.end, end - 1)) }, items: [...s.project.items, item], media: [...s.project.media, asset], audio: audio ? [...s.project.audio, audio] : s.project.audio };
    // Validation happens before any mutation, including the aggregate portable-project size limit.
    parseProject(JSON.stringify(project)); s.checkpoint();
    set({ project, selectedId: item.id, selectedIds: [item.id], selectedCamera: false, selectedAudio: null, selectedBone: null, tool: 'select' });
  },
  editClip: (id, kind, at) => {
    const s = get(); if (s.busy || s.blockReason) return;
    const project = editClip(s.project, id, kind, at); if (project === s.project) return;
    s.checkpoint(); set({ project, playing: false, keySelection: [] });
  },
  fadeClip: (id, kind) => {
    const s = get(); if (s.busy || s.blockReason) return;
    const project = fadeClip(s.project, id, kind); if (project === s.project) return;
    s.checkpoint(); set({ project });
  },
  keyProperty: property => {
    const s = get(), item = s.project.items.find(i => i.id === s.selectedId);
    if (!item || isLayerLocked(s.project.items, item.id) || s.busy || s.blockReason || s.project.animationMode === 'frame-by-frame') return;
    const keys = s.project.keyframes[item.id] ?? [], current = keys.find(k => k.frame === s.frame);
    const sampled = sampleItem(item, keys, s.frame), fallback = property === 'blur' ? 0 : 1;
    let values = { ...current?.values };
    if (values[property] !== undefined) delete values[property]; else values = { ...values, [property]: sampled[property] ?? fallback };
    const next = keys.filter(k => k.frame !== s.frame);
    if (Object.keys(values).length) next.push({ id: current?.id ?? uid(), frame: s.frame, easing: current?.easing ?? 'ease-in-out', ...(current?.bezier ? { bezier: current.bezier } : {}), values });
    s.checkpoint(); set({ project: { ...s.project, keyframes: { ...s.project.keyframes, [item.id]: next.sort((a, b) => a.frame - b.frame) } } });
  },
  editMotionProperty: (property, value) => {
    const s = get(), item = s.project.items.find(i => i.id === s.selectedId);
    if (!item || isLayerLocked(s.project.items, item.id) || !Number.isFinite(value) || s.busy || s.blockReason) return;
    const bounds = property === 'opacity' ? [0, 1] : property === 'blur' ? [0, 50] : property === 'brightness' || property === 'saturation' ? [0, 3] : property.startsWith('scale') ? [0.01, 100] : [-100000, 100000];
    value = clamp(value, bounds[0], bounds[1]);
    const keys = s.project.keyframes[item.id] ?? [], start = item.startFrame ?? 0;
    if (keys.some(k => k.values[property] !== undefined) || s.preferences.autoKey && s.frame > start) {
      const next = [...keys], write = (frame: number, number: number) => {
        const index = next.findIndex(k => k.frame === frame), previous = next[index];
        const key = { id: previous?.id ?? uid(), frame, easing: previous?.easing ?? 'ease-in-out' as const, ...(previous?.bezier ? { bezier: previous.bezier } : {}), values: { ...previous?.values, [property]: number } };
        if (index < 0) next.push(key); else next[index] = key;
      };
      if (!keys.some(k => k.values[property] !== undefined) && s.frame > start) write(start, item[property] ?? (property === 'blur' ? 0 : 1));
      write(s.frame, value); s.checkpoint(); set({ project: { ...s.project, keyframes: { ...s.project.keyframes, [item.id]: next.sort((a, b) => a.frame - b.frame) } } });
    } else s.editItem(item.id, { [property]: value });
  },
  addCharacter: () => { get().addItem(createCharacter(get().project.width / 2, get().project.height * 0.47)); get().notify('Milo is ready to pose. Drag a joint to try it.'); },
  addShape: shape => get().addItem(createShape(shape, get().project.width / 2, get().project.height / 2)),
  deleteSelected: () => {
    const s = get();
    if (s.selectedAudio) { s.removeAudio(s.selectedAudio); return; }
    const selected = new Set(s.selectedIds.length ? s.selectedIds : s.selectedId ? [s.selectedId] : []);
    const ids = new Set(s.project.items.filter(i => selected.has(i.id) && !isLayerLocked(s.project.items, i.id)).map(i => i.id));
    if (!ids.size) { if (selected.size) s.notify('Unlock this layer before deleting it.', 'info'); return; }
    let changed = true;
    while (changed) { changed = false; for (const i of s.project.items) if (!ids.has(i.id) && ((i.parentId && ids.has(i.parentId)) || (i.attachment && ids.has(i.attachment.characterId)))) { ids.add(i.id); changed = true; } }
    s.checkpoint();
    const audioIds = new Set(s.project.items.filter(i => ids.has(i.id)).map(i => i.linkedAudioId));
    set({ project: pruneMedia({ ...s.project, items: s.project.items.filter(i => !ids.has(i.id)), audio: s.project.audio.filter(a => !audioIds.has(a.id)), keyframes: Object.fromEntries(Object.entries(s.project.keyframes).filter(([id]) => !ids.has(id))) }), selectedId: null, selectedIds: [], selectedBone: null, keySelection: [] });
  },
  duplicateSelected: () => {
    const s = get(); const selected = new Set(s.selectedIds.length ? s.selectedIds : s.selectedId ? [s.selectedId] : []);
    let changed = true;
    while (changed) { changed = false; for (const i of s.project.items) if (!selected.has(i.id) && ((i.parentId && selected.has(i.parentId)) || (i.attachment && selected.has(i.attachment.characterId)))) { selected.add(i.id); changed = true; } }
    const originals = s.project.items.filter(i => selected.has(i.id));
    if (!originals.length) return;
    if (s.project.items.length + originals.length > 500) { s.notify('The duplicated layers would exceed the scene limit.', 'error'); return; }
    const sounds = originals.map(i => s.project.audio.find(a => a.id === i.linkedAudioId)).filter((a): a is AudioClip => !!a);
    if (s.project.audio.length + sounds.length > 32) { s.notify('Duplicating these clips would exceed the 32-sound limit.', 'error'); return; }
    s.checkpoint(); const map = new Map(originals.map(i => [i.id, uid()])); const keyframes = { ...s.project.keyframes }; const audio = [...s.project.audio];
    const items = originals.map(o => {
      const nested = !!((o.parentId && selected.has(o.parentId)) || (o.attachment && selected.has(o.attachment.characterId)));
      const sound = s.project.audio.find(a => a.id === o.linkedAudioId), soundId = sound ? uid() : undefined;
      if (sound) audio.push({ ...sound, id: soundId!, name: `${sound.name} copy`.slice(0, 100) });
      const dx = nested ? 0 : 24;
      const i = { ...clone(o), id: map.get(o.id)!, name: `${o.name} copy`.slice(0, 100), x: o.x + dx, y: o.y + dx, locked: false, linkedAudioId: soundId,
        ...(o.parentId ? { parentId: map.get(o.parentId) ?? o.parentId } : {}), ...(o.attachment ? { attachment: { ...o.attachment, characterId: map.get(o.attachment.characterId) ?? o.attachment.characterId } } : {}) };
      keyframes[i.id] = (s.project.keyframes[o.id] ?? []).map(k => ({ ...clone(k), id: uid(), values: { ...clone(k.values), ...(k.values.x !== undefined ? { x: k.values.x + dx } : {}), ...(k.values.y !== undefined ? { y: k.values.y + dx } : {}) } }));
      return i;
    });
    set({ project: { ...s.project, items: [...s.project.items, ...items], keyframes, audio }, selectedId: items.at(-1)!.id, selectedIds: items.map(i => i.id), selectedBone: null });
  },
  moveLayer: (id, direction) => {
    const s = get(), items = [...s.project.items], item = items.find(i => i.id === id); if (!item || isLayerLocked(items, id)) return;
    const siblings = items.filter(i => parentOf(i) === parentOf(item)), index = siblings.findIndex(i => i.id === id), next = index + (direction === 'up' ? 1 : -1);
    if (index < 0 || next < 0 || next >= siblings.length) return;
    const a = items.findIndex(i => i.id === id), b = items.findIndex(i => i.id === siblings[next].id); get().checkpoint(); [items[a], items[b]] = [items[b], items[a]]; set(s => ({ project: { ...s.project, items } }));
  },
  addKeyframe: () => {
    const s = get(); if (s.selectedCamera) { s.editCamera(sampleCamera(s.project.camera, s.frame)); return; } const item = s.project.items.find(i => i.id === s.selectedId);
    if (!item) { s.notify('Select a layer to add a keyframe.', 'info'); return; }
    if (isLayerLocked(s.project.items, item.id)) { s.notify('Unlock this layer to add keyframes.', 'info'); return; }
    s.checkpoint(); const project = clone(s.project);
    if (s.frame > 0 && !project.keyframes[item.id]?.length) writeKeyframe(project, item, 0);
    writeKeyframe(project, sampleItem(item, project.keyframes[item.id] ?? [], s.frame), s.frame);
    set({ project }); s.notify(`Keyframe added at frame ${s.frame + 1}.`);
  },
  removeKeyframe: (id, frame) => {
    if (id === '@camera') { get().checkpoint(); set(s => ({ project: { ...s.project, camera: { ...s.project.camera, keys: s.project.camera.keys.filter(k => k.frame !== frame) } } })); return; }
    const item = get().project.items.find(i => i.id === id);
    if (!item || isLayerLocked(get().project.items, id)) { get().notify('Unlock this layer to edit keyframes.', 'info'); return; }
    get().checkpoint(); set(s => ({ project: { ...s.project, keyframes: { ...s.project.keyframes, [id]: (s.project.keyframes[id] ?? []).filter(k => k.frame !== frame) } } }));
  },
  moveKeyframe: (id, from, to) => {
    const s = get();
    if (id === '@camera') { if (from === to) return; s.checkpoint(); const target = clamp(Math.round(to), 0, s.project.duration - 1); const original = s.project.camera.keys.find(k => k.frame === from); if (!original) return; set({ project: { ...s.project, camera: { ...s.project.camera, keys: [...s.project.camera.keys.filter(k => k.frame !== from && k.frame !== target), { ...original, frame: target }].sort((a, b) => a.frame - b.frame) } } }); return; }
    const key = s.project.keyframes[id]?.find(k => k.frame === from);
    if (!key || from === to || isLayerLocked(s.project.items, id)) return;
    s.checkpoint(); const frame = clamp(Math.round(to), 0, s.project.duration - 1);
    const keys = s.project.keyframes[id].filter(k => k.frame !== from && k.frame !== frame);
    set({ project: { ...s.project, keyframes: { ...s.project.keyframes, [id]: [...keys, { ...key, frame }].sort((a, b) => a.frame - b.frame) } } });
  },
  setEasing: easing => {
    const s = get(); const id = s.selectedCamera ? '@camera' : s.selectedId;
    if (!id || isLayerLocked(s.project.items, id)) return;
    const keys = id === '@camera' ? s.project.camera.keys : s.project.keyframes[id] ?? [];
    if (!keys.length) { s.notify('Add a keyframe first to choose its easing.', 'info'); return; }
    s.checkpoint(); const nearest = [...keys].reverse().find(k => k.frame <= s.frame) ?? keys[0];
    const selection = s.keySelection.length ? s.keySelection : [{ itemId: id, frame: nearest.frame }];
    const project = clone(s.project);
    for (const ref of selection) {
      if (isLayerLocked(project.items, ref.itemId)) continue;
      const list = ref.itemId === '@camera' ? project.camera.keys : project.keyframes[ref.itemId] ?? [];
      for (const k of list) if (k.frame === ref.frame) { k.easing = easing; if (easing === 'bezier' && !k.bezier) k.bezier = [0.42, 0, 0.58, 1]; }
    }
    set({ project });
  },
  applyPreset: preset => {
    const s = get(); const item = s.project.items.find(i => i.id === s.selectedId);
    if (!item) { s.notify('Select an object to add a motion.', 'info'); return; }
    if (isLayerLocked(s.project.items, item.id)) { s.notify('Unlock this layer before animating it.', 'info'); return; }
    s.checkpoint();
    const keys = createPreset(item, preset, s.project.duration);
    set({ project: { ...s.project, keyframes: { ...s.project.keyframes, [item.id]: keys } }, frame: 0 });
    s.notify(`${preset[0].toUpperCase() + preset.slice(1)} motion added. Press play to see it.`);
  },
  resetRig: () => {
    const s = get(); const item = s.project.items.find(i => i.id === s.selectedId);
    if (!item?.rig || isLayerLocked(s.project.items, item.id)) return;
    const angles = Object.fromEntries(createMiloRig().bones.map(b => [b.id, b.angle]));
    s.editBone(item.id, angles); s.notify('Pose reset. Your other keyframes are unchanged.');
  },
  addBone: () => {
    const s = get(); const item = s.project.items.find(i => i.id === s.selectedId);
    if (!item?.rig || isLayerLocked(s.project.items, item.id)) { s.notify('Select an unlocked character to add a bone.', 'info'); return; }
    if (item.rig.bones.length >= 200) { s.notify('This rig has reached its 200-bone limit.', 'info'); return; }
    const id = uid(); const rig = clone(item.rig);
    rig.bones.push({ id, name: `Bone ${rig.bones.length + 1}`, parentId: s.selectedBone ?? 'spine', length: 70, angle: 35 });
    s.editItem(item.id, { rig }); set({ selectedBone: id, tool: 'rig' }); s.notify('Bone added. Adjust its length and angle in the inspector.');
  },
  resizeProject: settings => {
    get().checkpoint(); set(s => {
      const project = { ...s.project, ...settings };
      if (settings.duration) trimScene(project, settings.duration, s.project.duration);
      return { project, frame: Math.min(s.frame, project.duration - 1), playing: false };
    });
  },
  addScene: () => {
    const s = get(); if (s.project.sceneOrder.length >= 32) { s.notify('A project supports up to 32 scenes.', 'info'); return; }
    s.checkpoint(); const scene = createScene(s.project.width, s.project.height, `Scene ${String(s.project.sceneOrder.length + 1).padStart(2, '0')}`);
    if (s.project.animationMode === 'frame-by-frame') { scene.items = [createDrawingLayer(s.project.width, s.project.height)]; scene.duration = 2; scene.workArea = { start: 0, end: 1 }; }
    const project = activateScene({ ...s.project, scenes: [...s.project.scenes, scene], sceneOrder: [...s.project.sceneOrder, scene.id] }, scene.id);
    const drawingId = project.animationMode === 'frame-by-frame' ? project.items.find(i => i.type === 'drawing')?.id ?? null : null;
    set({ project, frame: 0, playing: false, selectedId: drawingId, selectedIds: drawingId ? [drawingId] : [], selectedBone: null, selectedCamera: false, selectedAudio: null, keySelection: [] });
  },
  switchScene: id => { const s = get(); if (id === s.project.sceneId) return; const project = activateScene(s.project, id), drawingId = project.animationMode === 'frame-by-frame' ? project.items.find(i => i.type === 'drawing')?.id ?? null : null; set({ project, frame: 0, playing: false, selectedId: drawingId, selectedIds: drawingId ? [drawingId] : [], selectedBone: null, selectedCamera: false, selectedAudio: null, keySelection: [] }); },
  duplicateScene: () => {
    const s = get(); if (s.project.sceneOrder.length >= 32) return; s.checkpoint();
    const scene = duplicateSceneDocument(activeScene(s.project));
    const project = activateScene({ ...s.project, scenes: [...s.project.scenes, scene], sceneOrder: [...s.project.sceneOrder, scene.id] }, scene.id), drawingId = project.animationMode === 'frame-by-frame' ? project.items.find(i => i.type === 'drawing')?.id ?? null : null;
    set({ project, frame: 0, playing: false, selectedId: drawingId, selectedIds: drawingId ? [drawingId] : [], selectedBone: null, keySelection: [] });
  },
  renameScene: (id, name) => { const s = get(); if (!name.trim()) return; s.checkpoint(); const trimmed = name.trim().slice(0, 100); set({ project: id === s.project.sceneId ? { ...s.project, sceneName: trimmed } : { ...s.project, scenes: s.project.scenes.map(scene => scene.id === id ? { ...scene, name: trimmed } : scene) } }); },
  deleteScene: id => {
    const s = get(); if (s.project.sceneOrder.length < 2) { s.notify('Keep at least one scene in your project.', 'info'); return; } s.checkpoint();
    let project = s.project; if (id === project.sceneId) project = activateScene(project, project.sceneOrder.find(i => i !== id)!);
    set({ project: { ...project, scenes: project.scenes.filter(scene => scene.id !== id), sceneOrder: project.sceneOrder.filter(i => i !== id) }, frame: 0, playing: false, selectedId: null, selectedIds: [], selectedBone: null, selectedCamera: false, selectedAudio: null, keySelection: [] });
  },
  reorderScene: (id, direction) => { const s = get(), order = [...s.project.sceneOrder], index = order.indexOf(id), next = index + direction; if (index < 0 || next < 0 || next >= order.length) return; s.checkpoint(); [order[index], order[next]] = [order[next], order[index]]; set({ project: { ...s.project, sceneOrder: order } }); },
  addText: () => get().addItem(createText(get().project.width / 2, get().project.height / 2)),
  addBlankRig: () => { const p = get().project; get().addItem({ ...createCharacter(p.width / 2, p.height * 0.47), name: 'My cutout rig', characterStyle: 'skeleton' }); get().notify('Import separate artwork parts, then attach each part to a joint in the inspector.', 'info'); },
  editBoneProperties: (itemId, boneId, patch) => {
    const s = get(); const item = s.project.items.find(i => i.id === itemId); if (!item?.rig || isLayerLocked(s.project.items, item.id)) return;
    const rig = clone(item.rig); const bone = rig.bones.find(b => b.id === boneId); if (!bone) return;
    const updated = { ...bone, ...patch, id: bone.id };
    if (updated.minAngle !== undefined && updated.maxAngle !== undefined && updated.minAngle > updated.maxAngle) { s.notify('Minimum angle cannot exceed maximum angle.', 'info'); return; }
    if (patch.parentId && !rig.bones.some(b => b.id === patch.parentId)) { s.notify('Choose an existing parent bone.', 'error'); return; }
    if (patch.parentId) { let parent = rig.bones.find(b => b.id === patch.parentId); const seen = new Set([boneId]); while (parent) { if (seen.has(parent.id)) { s.notify('A bone cannot be its own ancestor.', 'error'); return; } seen.add(parent.id); parent = rig.bones.find(b => b.id === parent!.parentId); } }
    rig.bones = rig.bones.map(b => b.id === boneId ? updated : b); s.editItem(itemId, { rig });
  },
  bindToBone: (itemId, characterId, boneId = 'head') => {
    const s = get(); const item = s.project.items.find(i => i.id === itemId); if (!item || isLayerLocked(s.project.items, item.id) || item.type === 'character' || item.type === 'group') return;
    if (!characterId) {
      if (!item.attachment) return;
      const node = sceneNodes(s.project, s.frame).find(n => n.item.id === itemId); if (!node) return;
      const m = item.parentId ? multiplyForUngroup(inverse(node.parentMatrix), node.matrix) : node.matrix;
      const sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]);
      if (Math.abs(m[0] * m[2] + m[1] * m[3]) > 0.001 * Math.max(1, sx * sy) || sx < 0.01 || sy < 0.01 || sx > 100 || sy > 100) { s.notify('This attachment has a transform that cannot be flattened without changing its artwork. Keep it attached.', 'info'); return; }
      s.checkpoint(); const project = clone(s.project); const target = project.items.find(i => i.id === itemId)!; delete target.attachment;
      Object.assign(target, { x: m[4], y: m[5], rotation: Math.atan2(m[1], m[0]) * 180 / Math.PI, scaleX: Math.hypot(m[0], m[1]), scaleY: Math.hypot(m[2], m[3]) }); delete project.keyframes[itemId]; set({ project }); s.notify('Detached at the current pose. Previous transform keys remain available with Undo.'); return;
    }
    const character = s.project.items.find(i => i.id === characterId); if (isLayerLocked(s.project.items, characterId)) { s.notify('Unlock the target rig before attaching artwork.', 'info'); return; } const bone = character?.rig?.bones.find(b => b.id === boneId); if (!bone) return;
    s.checkpoint(); const project = clone(s.project); const target = project.items.find(i => i.id === itemId)!;
    const headOrBody = boneId === 'head' || boneId === 'spine'; const scale = clamp((boneId === 'head' ? Math.max(80, bone.length * 1.8) : Math.max(20, bone.length)) / target.height, 0.01, 100);
    Object.assign(target, { attachment: { characterId, boneId, anchor: boneId === 'head' ? 1 : 0.5 }, parentId: null, x: 0, y: 0, rotation: headOrBody ? 90 : -90, scaleX: scale, scaleY: scale }); delete project.keyframes[itemId];
    set({ project }); s.notify('Artwork attached. Pose the rig to move it. Previous transform keys can be recovered with Undo.');
  },
  groupSelected: () => {
    const s = get(); const ids = s.selectedIds.length ? s.selectedIds : s.selectedId ? [s.selectedId] : [];
    const children = s.project.items.filter(i => ids.includes(i.id) && !i.locked && !i.parentId && !i.attachment);
    if (!children.length) { s.notify('Select unlocked, ungrouped layers to group.', 'info'); return; }
    if (s.project.items.length >= 500) return; s.checkpoint();
    const left = Math.min(...children.map(i => i.x - i.width * i.scaleX / 2)), top = Math.min(...children.map(i => i.y - i.height * i.scaleY / 2)), right = Math.max(...children.map(i => i.x + i.width * i.scaleX / 2)), bottom = Math.max(...children.map(i => i.y + i.height * i.scaleY / 2));
    const group = createItem('group', { name: 'Group', x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top }); const setIds = new Set(children.map(i => i.id));
    const keyframes = Object.fromEntries(Object.entries(s.project.keyframes).map(([id, keys]) => [id, setIds.has(id) ? keys.map(k => ({ ...k, values: { ...k.values, ...(k.values.x !== undefined ? { x: k.values.x - group.x } : {}), ...(k.values.y !== undefined ? { y: k.values.y - group.y } : {}) } })) : keys]));
    set({ project: { ...s.project, keyframes, items: [...s.project.items.map(i => setIds.has(i.id) ? { ...i, x: i.x - group.x, y: i.y - group.y, parentId: group.id } : i), group] }, selectedId: group.id, selectedIds: [group.id], selectedBone: null });
    s.notify('Grouped. Animate the group to move all its layers together.');
  },
  ungroupSelected: () => {
    const s = get(); const group = s.project.items.find(i => i.id === s.selectedId); if (group?.type !== 'group' || isLayerLocked(s.project.items, group.id)) return;
    // Bake all child transforms at each frame, preserving animated group motion (no lossy flattening).
    const children = s.project.items.filter(i => i.parentId === group.id); const ids = new Set(children.map(i => i.id));
    const project = clone(s.project); const keys = { ...project.keyframes }; delete keys[group.id];
    for (const child of children) {
      const baked: Keyframe[] = [];
      for (let f = 0; f < project.duration; f++) { const node = sceneNodes(s.project, f).find(n => n.item.id === child.id)!; const matrix = node.matrix; const parent = group.parentId ? sceneNodes(s.project, f).find(n => n.item.id === group.parentId)!.matrix : null; const m = parent ? multiplyForUngroup(inverse(parent), matrix) : matrix;
        const sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]); const dot = m[0] * m[2] + m[1] * m[3];
        if (sx < 0.01 || sy < 0.01 || sx > 100 || sy > 100 || Math.abs(m[4]) > 100000 || Math.abs(m[5]) > 100000 || Math.abs(dot) > 0.001 * Math.max(1, sx * sy)) { s.notify('This group contains skew from non-uniform scaling. Keep it grouped to preserve its artwork.', 'info'); return; }
        baked.push({ id: uid(), frame: f, easing: 'linear', values: { ...capturePose(node.item), x: m[4], y: m[5], rotation: Math.atan2(m[1], m[0]) * 180 / Math.PI, scaleX: sx, scaleY: sy, opacity: node.item.opacity * sampleItem(group, s.project.keyframes[group.id] ?? [], f).opacity } });
      }
      keys[child.id] = baked;
    }
    s.checkpoint(); project.items = project.items.filter(i => i.id !== group.id).map(i => ids.has(i.id) ? { ...i, parentId: group.parentId ?? null, visible: i.visible && group.visible } : i); project.keyframes = keys;
    set({ project, selectedId: children.at(-1)?.id ?? null, selectedIds: children.map(i => i.id), selectedBone: null }); s.notify('Ungrouped. Group motion was baked into the child layers.');
  },
  alignSelected: mode => {
    const s = get(); const ids = s.selectedIds.length ? s.selectedIds : s.selectedId ? [s.selectedId] : [];
    const nodes = sceneNodes(s.project, s.frame).filter(n => ids.includes(n.item.id) && !n.locked && !n.item.parentId && !n.item.attachment);
    if (!nodes.length) return; s.checkpoint();
    for (const { item } of nodes) { const halfW = item.width * item.scaleX / 2, halfH = item.height * item.scaleY / 2;
      s.editItem(item.id, mode === 'left' ? { x: halfW } : mode === 'center' ? { x: s.project.width / 2 } : mode === 'right' ? { x: s.project.width - halfW } : mode === 'top' ? { y: halfH } : mode === 'middle' ? { y: s.project.height / 2 } : { y: s.project.height - halfH }, false);
    }
  },
  addCelStroke: points => {
    const s = get(); let item = s.project.items.find(i => i.id === s.selectedId && i.type === 'drawing') ?? [...s.project.items].reverse().find(i => i.type === 'drawing' && !isLayerLocked(s.project.items, i.id));
    if (item && isLayerLocked(s.project.items, item.id)) return; if (!item && s.project.items.length >= 500) return; s.checkpoint(); const project = clone(s.project);
    if (!item) { item = { ...createItem('drawing'), type: 'drawing', name: 'Frame-by-frame drawing', x: project.width / 2, y: project.height / 2, width: project.width, height: project.height, cels: [], holdCels: project.animationMode !== 'frame-by-frame' }; project.items.push(item); }
    const target = project.items.find(i => i.id === item!.id)!; const sampledNode = sceneNodes(project, s.frame).find(n => n.item.id === item!.id)!;
    const local = points.map(p => transformPoint(inverse(sampledNode.matrix), p)); const cels = [...(target.cels ?? [])]; let cel = cels.find(c => c.frame === s.frame);
    if (!cel) { cel = { frame: s.frame, strokes: [] }; cels.push(cel); }
    if (cel.strokes.length >= 500) { s.notify('This cel has reached its 500-stroke limit.', 'info'); return; }
    cel.strokes.push({ points: local.slice(0, 20000), color: s.preferences.brushColor, width: s.preferences.brushSize }); target.cels = cels.sort((a, b) => a.frame - b.frame);
    set({ project, selectedId: target.id, selectedIds: [target.id], selectedBone: null, selectedCamera: false, tool: 'pen' });
  },
  blankCel: () => { const s = get(), item = s.project.items.find(i => i.id === s.selectedId && i.type === 'drawing'); if (!item || isLayerLocked(s.project.items, item.id)) { s.notify('Select a frame-by-frame drawing first.', 'info'); return; } s.editItem(item.id, { cels: [...(item.cels ?? []).filter(c => c.frame !== s.frame), { frame: s.frame, strokes: [] }].sort((a, b) => a.frame - b.frame) }); },
  duplicateCel: () => { const s = get(), item = s.project.items.find(i => i.id === s.selectedId && i.type === 'drawing'); if (!item || isLayerLocked(s.project.items, item.id)) return; const previous = sampleCel(item, Math.max(0, s.frame - 1)); s.editItem(item.id, { cels: [...(item.cels ?? []).filter(c => c.frame !== s.frame), { frame: s.frame, strokes: clone(previous?.strokes ?? []) }].sort((a, b) => a.frame - b.frame) }); },
  nextDrawingFrame: kind => {
    const s = get(), item = s.project.items.find(i => i.id === s.selectedId && i.type === 'drawing');
    if (!item || isLayerLocked(s.project.items, item.id)) { s.notify('Select an unlocked drawing layer first.', 'info'); return; }
    const next = s.frame + 1;
    if (next >= 1800) { s.notify('A scene supports at most 1800 frames.', 'info'); return; }
    if (item.cels?.some(c => c.frame === next)) { set({ frame: next, playing: false }); s.notify(`Frame ${next + 1} already has a cel. Its drawing was kept.`, 'info'); return; }
    s.checkpoint(); const project = clone(s.project), drawing = project.items.find(i => i.id === item.id)!;
    drawing.cels = [...(drawing.cels ?? []), { frame: next, strokes: kind === 'duplicate' ? clone(sampleCel(item, s.frame)?.strokes ?? []) : [] }].sort((a, b) => a.frame - b.frame);
    if (next >= project.duration) { if (project.workArea.end === project.duration - 1) project.workArea.end = next; project.duration = next + 1; }
    set({ project, frame: next, playing: false });
  },
  removeCel: (id, frame) => { const s = get(), item = s.project.items.find(i => i.id === id); if (!item || isLayerLocked(s.project.items, item.id)) return; s.editItem(id, { cels: (item.cels ?? []).filter(c => c.frame !== frame) }); },
  moveCel: (id, from, to) => { const s = get(), item = s.project.items.find(i => i.id === id), cel = item?.cels?.find(c => c.frame === from); if (!item || isLayerLocked(s.project.items, item.id) || !cel || from === to) return; const frame = clamp(to, 0, s.project.duration - 1); s.editItem(id, { cels: [...(item.cels ?? []).filter(c => c.frame !== from && c.frame !== frame), { ...cel, frame }].sort((a, b) => a.frame - b.frame) }); },
  editCamera: (patch, record = true) => {
    const s = get(); if (record) s.checkpoint(); const camera = clone(s.project.camera);
    if (s.project.animationMode !== 'frame-by-frame' && s.preferences.autoKey && (s.frame > 0 || camera.keys.length)) {
      const sampled = { ...sampleCamera(camera, s.frame), ...patch };
      if (s.frame > 0 && !camera.keys.length) camera.keys.push({ id: uid(), frame: 0, easing: 'ease-in-out', values: { x: camera.x, y: camera.y, scaleX: camera.zoom, rotation: camera.rotation } });
      const original = camera.keys.find(k => k.frame === s.frame); camera.keys = [...camera.keys.filter(k => k.frame !== s.frame), { id: original?.id ?? uid(), frame: s.frame, easing: original?.easing ?? 'ease-in-out', ...(original?.bezier ? { bezier: original.bezier } : {}), values: { x: sampled.x, y: sampled.y, scaleX: sampled.zoom, rotation: sampled.rotation } }].sort((a, b) => a.frame - b.frame);
    } else Object.assign(camera, patch);
    set({ project: { ...s.project, camera } });
  },
  resetCamera: () => { const s = get(); s.checkpoint(); set({ project: { ...s.project, camera: { x: s.project.width / 2, y: s.project.height / 2, zoom: 1, rotation: 0, keys: [] } } }); },
  addAudio: clip => { const s = get(); if (s.project.audio.length >= 32) { s.notify('Each scene supports up to 32 audio clips.', 'info'); return; } s.checkpoint(); set({ project: { ...s.project, audio: [...s.project.audio, clip] }, selectedAudio: clip.id, selectedId: null, selectedIds: [], selectedCamera: false }); },
  editAudio: (id, patch, record = true) => {
    const s = get(); let unlink = false;
    const audio = s.project.audio.map(a => {
      if (a.id !== id) return a;
      const next = { ...a, ...patch, startFrame: clamp(Math.round(patch.startFrame ?? a.startFrame), 0, s.project.duration - 1), trimStart: clamp(patch.trimStart ?? a.trimStart, 0, Math.max(0, a.duration - 0.01)) };
      unlink = next.startFrame !== a.startFrame || next.trimStart !== a.trimStart;
      if (a.endFrame !== undefined) {
        const length = Math.min(a.endFrame - a.startFrame, Math.max(1, Math.ceil((a.duration - next.trimStart) * s.project.fps - 1e-6)));
        next.endFrame = Math.min(s.project.duration, next.startFrame + length);
      }
      return next;
    });
    if (record) s.checkpoint();
    set({ project: { ...s.project, audio, items: unlink ? s.project.items.map(i => i.linkedAudioId === id ? { ...i, linkedAudioId: undefined } : i) : s.project.items } });
  },
  removeAudio: id => { const s = get(); s.checkpoint(); set({ project: { ...s.project, audio: s.project.audio.filter(a => a.id !== id), items: s.project.items.map(i => i.linkedAudioId === id ? { ...i, linkedAudioId: undefined } : i) }, selectedAudio: null }); },
  setWorkArea: (start, end) => { const s = get(); const a = clamp(Math.round(start), 0, s.project.duration - 1), b = clamp(Math.round(end), a, s.project.duration - 1); s.checkpoint(); set({ project: { ...s.project, workArea: { start: a, end: b } } }); },
  selectKey: (itemId, frame, additive = false) => {
    const s = get(); const ref = { itemId, frame }; const existing = s.keySelection.some(k => k.itemId === itemId && k.frame === frame);
    set({ keySelection: additive ? existing ? s.keySelection.filter(k => !(k.itemId === itemId && k.frame === frame)) : [...s.keySelection, ref] : [ref], frame, playing: false });
  },
  copyKeys: () => {
    const s = get(); const id = s.selectedCamera ? '@camera' : s.selectedId;
    const selected = s.keySelection.length ? s.keySelection : id ? [{ itemId: id, frame: s.frame }] : [];
    const keyClipboard = selected.flatMap(ref => { const key = (ref.itemId === '@camera' ? s.project.camera.keys : s.project.keyframes[ref.itemId] ?? []).find(k => k.frame === ref.frame); return key ? [{ itemId: ref.itemId, key: clone(key) }] : []; });
    set({ keyClipboard }); s.notify(keyClipboard.length ? `${keyClipboard.length} keyframe${keyClipboard.length > 1 ? 's' : ''} copied.` : 'Select a timeline diamond to copy a keyframe.', 'info');
  },
  pasteKeys: () => {
    const s = get(); if (!s.keyClipboard.length) return; const earliest = Math.min(...s.keyClipboard.map(k => k.key.frame)); const channels = new Set(s.keyClipboard.map(k => k.itemId)); const targetId = s.selectedCamera ? '@camera' : s.selectedId;
    const project = clone(s.project); const keySelection: KeyRef[] = []; let overwritten = false;
    for (const entry of s.keyClipboard) {
      const id = channels.size === 1 && targetId ? targetId : entry.itemId;
      const item = project.items.find(i => i.id === id); if (id !== '@camera' && (!item || isLayerLocked(project.items, item.id))) continue;
      const frame = s.frame + entry.key.frame - earliest; if (frame >= project.duration) continue;
      const list = id === '@camera' ? project.camera.keys : project.keyframes[id] ?? [];
      if (list.some(k => k.frame === frame)) overwritten = true;
      const key = { ...clone(entry.key), id: uid(), frame };
      if (!item?.rig) delete key.values.bones; else if (key.values.bones) key.values.bones = Object.fromEntries(Object.entries(key.values.bones).filter(([bone]) => item.rig!.bones.some(b => b.id === bone)));
      const keys = [...list.filter(k => k.frame !== frame), key].sort((a, b) => a.frame - b.frame);
      if (id === '@camera') project.camera.keys = keys; else project.keyframes[id] = keys;
      keySelection.push({ itemId: id, frame });
    }
    if (!keySelection.length) return; s.checkpoint(); set({ project, keySelection }); s.notify(overwritten ? 'Keyframes pasted; overlapping keys were replaced. Undo restores them.' : 'Keyframes pasted.');
  },
  deleteKeys: () => { const s = get(); if (!s.keySelection.length) return; s.checkpoint(); const project = clone(s.project); for (const ref of s.keySelection) { if (ref.itemId === '@camera') project.camera.keys = project.camera.keys.filter(k => k.frame !== ref.frame); else if (!isLayerLocked(project.items, ref.itemId)) project.keyframes[ref.itemId] = (project.keyframes[ref.itemId] ?? []).filter(k => k.frame !== ref.frame); } set({ project, keySelection: [] }); },
  setBezier: bezier => { const s = get(); const id = s.selectedCamera ? '@camera' : s.selectedId; if (!id || isLayerLocked(s.project.items, id)) return; const project = clone(s.project); const keys = id === '@camera' ? project.camera.keys : project.keyframes[id] ?? []; const nearest = [...keys].reverse().find(k => k.frame <= s.frame) ?? keys[0]; if (!nearest) return; s.checkpoint(); nearest.easing = 'bezier'; nearest.bezier = bezier; set({ project }); },
  undo: () => { const s = get(); const previous = s.history.at(-1); if (!previous) return; set({ project: previous, history: s.history.slice(0, -1), future: [s.project, ...s.future].slice(0, 40), frame: Math.min(s.frame, previous.duration - 1), selectedId: previous.items.some(i => i.id === s.selectedId) ? s.selectedId : null, selectedIds: s.selectedIds.filter(id => previous.items.some(i => i.id === id)), selectedCamera: false, selectedAudio: null, keySelection: [], selectedBone: null, playing: false }); },
  redo: () => { const s = get(); const next = s.future[0]; if (!next) return; set({ project: next, history: [...s.history, s.project], future: s.future.slice(1), frame: Math.min(s.frame, next.duration - 1), selectedId: next.items.some(i => i.id === s.selectedId) ? s.selectedId : null, selectedIds: s.selectedIds.filter(id => next.items.some(i => i.id === id)), selectedCamera: false, selectedAudio: null, keySelection: [], selectedBone: null, playing: false }); },
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
  return item ? { ...sampleItem(item, project.keyframes[item.id] ?? [], frame), locked: sceneNodes(project, frame).find(n => n.item.id === item.id)?.locked ?? item.locked } : undefined;
}

export function trimScene(project: Project, duration: number, previousDuration = project.duration) {
  const fullRange = project.workArea.start === 0 && project.workArea.end === previousDuration - 1;
  project.duration = duration;
  project.keyframes = Object.fromEntries(Object.entries(project.keyframes).map(([id, keys]) => [id, keys.filter(k => k.frame < duration)]));
  project.items = project.items.map(item => ({ ...item, ...(item.cels ? { cels: item.cels.filter(c => c.frame < duration) } : {}), ...(item.startFrame !== undefined ? { startFrame: Math.min(item.startFrame, duration - 1) } : {}), ...(item.endFrame !== undefined ? { endFrame: Math.min(item.endFrame, duration) } : {}) }));
  project.camera = { ...project.camera, keys: project.camera.keys.filter(k => k.frame < duration) };
  project.audio = project.audio.filter(a => a.startFrame < duration).map(a => ({ ...a, ...(a.endFrame !== undefined ? { endFrame: Math.min(a.endFrame, duration) } : {}) }));
  const audioIds = new Set(project.audio.map(a => a.id)); project.items = project.items.map(i => i.linkedAudioId && !audioIds.has(i.linkedAudioId) ? { ...i, linkedAudioId: undefined } : i);
  project.workArea = { start: Math.min(project.workArea.start, duration - 1), end: fullRange ? duration - 1 : Math.min(project.workArea.end, duration - 1) };
}
export function duplicateSceneDocument(original: Scene): Scene {
  const scene = clone(original); const audioMap = new Map(scene.audio.map(a => [a.id, uid()])); const map = new Map(scene.items.map(i => [i.id, uid()]));
  scene.id = uid(); scene.name = `${scene.name} copy`.slice(0, 100);
  scene.items = scene.items.map(i => ({ ...i, id: map.get(i.id)!, ...(i.linkedAudioId ? { linkedAudioId: audioMap.get(i.linkedAudioId) } : {}), ...(i.parentId ? { parentId: map.get(i.parentId)! } : {}), ...(i.attachment ? { attachment: { ...i.attachment, characterId: map.get(i.attachment.characterId)! } } : {}) }));
  scene.keyframes = Object.fromEntries(Object.entries(scene.keyframes).map(([id, keys]) => [map.get(id)!, keys.map(k => ({ ...k, id: uid() }))]));
  scene.camera.keys = scene.camera.keys.map(k => ({ ...k, id: uid() })); scene.audio = scene.audio.map(a => ({ ...a, id: audioMap.get(a.id)! }));
  return scene;
}
