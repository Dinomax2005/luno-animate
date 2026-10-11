import { create } from 'zustand';
import { BRUSH_PRESETS, brushPreset, COLOR_PALETTES, DEFAULT_BRUSH, normalizeBrush } from '../engine/brushes';
import { brushPackSchema, customPresetSchema, paintColorSchema, paintSettingsSchema } from '../engine/paint-schema';
import type { BrushStyle, PaintSettings } from '../engine/types';
import { uid } from '../engine/project';
import { useEditor } from './editor';

export const PAINT_KEY = 'luno.paint.v1';
export const DEFAULT_PAINT: PaintSettings = { updatedAt: 0, brush: { ...DEFAULT_BRUSH }, presetId: 'round', backgroundColor: '#ffffff', symmetry: 'none', palette: 'Studio', recentColors: [], savedColors: [], customPresets: [], fillTolerance: 12 };
export function normalizePaintSettings(value: unknown): PaintSettings {
  const prefs = useEditor.getState().preferences;
  const strict = paintSettingsSchema.safeParse(value); if (strict.success) return { ...strict.data, foregroundColor: strict.data.foregroundColor ?? prefs.brushColor, brushSize: strict.data.brushSize ?? prefs.brushSize };
  const v = value && typeof value === 'object' ? value as Partial<PaintSettings> : {};
  const colors = (values: unknown, limit: number) => Array.isArray(values) ? [...new Set(values.filter(c => paintColorSchema.safeParse(c).success).map(c => String(c).toLowerCase()))].slice(0, limit) : [];
  const customs = Array.isArray(v.customPresets) ? v.customPresets.flatMap(p => { const result = customPresetSchema.safeParse(p); return result.success ? [result.data] : []; }).slice(0, 24) : [];
  return {
    ...DEFAULT_PAINT, foregroundColor: paintColorSchema.safeParse(v.foregroundColor).success ? v.foregroundColor! : prefs.brushColor, brushSize: typeof v.brushSize === 'number' && Number.isFinite(v.brushSize) && v.brushSize >= 1 && v.brushSize <= 256 ? v.brushSize : prefs.brushSize, updatedAt: typeof v.updatedAt === 'number' && Number.isSafeInteger(v.updatedAt) && v.updatedAt >= 0 ? v.updatedAt : 0, brush: normalizeBrush(v.brush), presetId: typeof v.presetId === 'string' && v.presetId.length <= 100 ? v.presetId : 'round',
    backgroundColor: paintColorSchema.safeParse(v.backgroundColor).success ? v.backgroundColor! : '#ffffff',
    symmetry: v.symmetry === 'vertical' || v.symmetry === 'horizontal' || v.symmetry === 'both' ? v.symmetry : 'none',
    palette: typeof v.palette === 'string' && Object.hasOwn(COLOR_PALETTES, v.palette) ? v.palette : 'Studio',
    recentColors: colors(v.recentColors, 16), savedColors: colors(v.savedColors, 32), customPresets: [...new Map(customs.map(p => [p.id, p])).values()],
    fillTolerance: typeof v.fillTolerance === 'number' && Number.isFinite(v.fillTolerance) ? Math.round(Math.min(100, Math.max(0, v.fillTolerance))) : 12,
  };
}
function initial(): PaintSettings {
  let value: unknown; try { value = JSON.parse(localStorage.getItem(PAINT_KEY) ?? '{}'); } catch { value = null; }
  const settings = normalizePaintSettings(value);
  useEditor.getState().setPreference('brushColor', settings.foregroundColor!); useEditor.getState().setPreference('brushSize', settings.brushSize!);
  return settings;
}
interface PaintStore extends PaintSettings {
  studioRequest: number; requestStudio: () => void; panelTab: 'brushes' | 'color'; lastTool: 'pen' | 'eraser' | 'bucket';
  setTab: (tab: PaintStore['panelTab']) => void; setLastTool: (tool: PaintStore['lastTool']) => void;
  configure: (patch: Partial<BrushStyle>) => void; choosePreset: (id: string) => void; resetBrush: () => void;
  setSymmetry: (value: PaintSettings['symmetry']) => void; setPalette: (value: string) => void; setTolerance: (value: number) => void;
  rememberColor: (color: string) => void; saveColor: (color: string) => boolean; removeColor: (color: string) => void; swapColors: () => void; resetColors: () => void;
  savePreset: (name: string) => boolean; removePreset: (id: string) => void; exportPack: () => string; importPack: (raw: string) => number;
  loadSettings: (value: unknown) => void; settings: () => PaintSettings;
}
let hydrating = false;
export const usePaint = create<PaintStore>((set, get) => ({
  ...initial(), studioRequest: 0, requestStudio: () => set(s => ({ studioRequest: s.studioRequest + 1 })), panelTab: 'brushes', lastTool: 'pen',
  setTab: panelTab => set({ panelTab }), setLastTool: lastTool => set({ lastTool }),
  configure: patch => set(s => ({ brush: normalizeBrush({ ...s.brush, ...patch }) })),
  choosePreset: id => { const p = brushPreset(id, get().customPresets); set({ presetId: p.id, brush: { ...p.brush } }); useEditor.getState().setPreference('brushSize', p.size); },
  resetBrush: () => { const p = brushPreset(get().presetId, get().customPresets); set({ brush: { ...p.brush } }); useEditor.getState().setPreference('brushSize', p.size); },
  setSymmetry: symmetry => set({ symmetry }), setPalette: palette => { if (Object.hasOwn(COLOR_PALETTES, palette)) set({ palette }); },
  setTolerance: value => set({ fillTolerance: Math.round(Math.min(100, Math.max(0, value))) }),
  rememberColor: color => { if (paintColorSchema.safeParse(color).success) set(s => ({ recentColors: [color.toLowerCase(), ...s.recentColors.filter(c => c.toLowerCase() !== color.toLowerCase())].slice(0, 16) })); },
  saveColor: color => { const s = get(); if (!paintColorSchema.safeParse(color).success || s.savedColors.length >= 32 || s.savedColors.includes(color.toLowerCase())) return false; set({ savedColors: [...s.savedColors, color.toLowerCase()] }); return true; },
  removeColor: color => set(s => ({ savedColors: s.savedColors.filter(c => c !== color) })),
  swapColors: () => { const foreground = useEditor.getState().preferences.brushColor; useEditor.getState().setPreference('brushColor', get().backgroundColor); set({ backgroundColor: foreground }); },
  resetColors: () => { useEditor.getState().setPreference('brushColor', '#0b1020'); set({ backgroundColor: '#ffffff' }); },
  savePreset: name => {
    const s = get(); if (s.customPresets.length >= 24 || !name.trim()) return false;
    const p = { id: `custom-${uid()}`, name: name.trim().slice(0, 48), category: 'Custom' as const, size: useEditor.getState().preferences.brushSize, brush: { ...s.brush, seed: 1 }, description: 'Your saved brush settings.' };
    set({ customPresets: [...s.customPresets, p], presetId: p.id }); return true;
  },
  removePreset: id => { const s = get(); set({ customPresets: s.customPresets.filter(p => p.id !== id), ...(s.presetId === id ? { presetId: s.brush.kind } : {}) }); },
  exportPack: () => { const s = get(); const selected = brushPreset(s.presetId, s.customPresets); return JSON.stringify({ format: 'luno-brushes', version: 1, brushes: s.customPresets.length ? s.customPresets : [{ ...selected, id: `custom-${uid()}`, category: 'Custom' }], colors: s.savedColors }, null, 2); },
  importPack: raw => {
    if (raw.length > 100000) throw new Error('Brush packs support at most 100 KB.');
    const pack = brushPackSchema.safeParse(JSON.parse(raw)); if (!pack.success) throw new Error('This is not a supported Luno .lunobrush pack.');
    const s = get(); if (s.customPresets.length + pack.data.brushes.length > 24) throw new Error('The brush library supports 24 custom presets. Remove a preset before importing.');
    const brushes = pack.data.brushes.map(p => ({ ...p, id: `custom-${uid()}` }));
    set({ customPresets: [...s.customPresets, ...brushes], savedColors: [...new Set([...s.savedColors, ...pack.data.colors])].slice(0, 32) }); return brushes.length;
  },
  loadSettings: value => { hydrating = true; try { const settings = normalizePaintSettings(value); set(settings); useEditor.getState().setPreference('brushColor', settings.foregroundColor!); useEditor.getState().setPreference('brushSize', settings.brushSize!); } finally { hydrating = false; } },
  settings: () => { const s = get(); return { updatedAt: s.updatedAt, foregroundColor: s.foregroundColor, brushSize: s.brushSize, brush: s.brush, presetId: s.presetId, backgroundColor: s.backgroundColor, symmetry: s.symmetry, palette: s.palette, recentColors: s.recentColors, savedColors: s.savedColors, customPresets: s.customPresets, fillTolerance: s.fillTolerance }; },
}));
// Save small tool preferences, never live scratch-pad artwork or active operation state.
usePaint.subscribe((state, previous) => {
  const fields = (s: PaintStore) => JSON.stringify({ foregroundColor: s.foregroundColor, brushSize: s.brushSize, brush: s.brush, presetId: s.presetId, backgroundColor: s.backgroundColor, symmetry: s.symmetry, palette: s.palette, recentColors: s.recentColors, savedColors: s.savedColors, customPresets: s.customPresets, fillTolerance: s.fillTolerance });
  if (!hydrating && state.updatedAt === previous.updatedAt && fields(state) !== fields(previous)) { usePaint.setState({ updatedAt: Math.max(Date.now(), previous.updatedAt + 1) }); return; }
  try { localStorage.setItem(PAINT_KEY, JSON.stringify(usePaint.getState().settings())); } catch { /* Durable library settings are saved with the document too. */ }
});
// Legacy foreground/size controls remain in editor preferences, but persist atomically with the brush too.
useEditor.subscribe((state, previous) => {
  if (hydrating || state.preferences.brushColor === previous.preferences.brushColor && state.preferences.brushSize === previous.preferences.brushSize) return;
  usePaint.setState({ foregroundColor: state.preferences.brushColor, brushSize: state.preferences.brushSize });
});

export const isPaintTool = (tool: string) => ['pen', 'eraser', 'bucket', 'eyedropper'].includes(tool);
export function freshBrush(): BrushStyle { const words = new Uint32Array(1); globalThis.crypto?.getRandomValues?.(words); return { ...usePaint.getState().brush, seed: words[0] || Math.floor(Math.random() * 4294967295) }; }
export function activePresetName() { const s = usePaint.getState(); return brushPreset(s.presetId, s.customPresets).name; }
export const BUILTIN_BRUSH_COUNT = BRUSH_PRESETS.length;
