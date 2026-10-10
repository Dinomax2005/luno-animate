import { create } from 'zustand';

export type WorkspaceName = 'Animation' | 'Drawing' | 'Rigging';
export interface WorkspaceLayout {
  workspace: WorkspaceName;
  leftWidth: number;
  rightWidth: number;
  timelineHeight: number;
  frameWidth: number;
  showLayers: boolean;
  showProperties: boolean;
  showTimeline: boolean;
  showRulers: boolean;
}
export const WORKSPACE_KEY = 'luno.workspace.pro.v1';
export const defaultLayout: WorkspaceLayout = {
  workspace: 'Animation', leftWidth: 218, rightWidth: 282, timelineHeight: 258,
  frameWidth: 12, showLayers: true, showProperties: true, showTimeline: true, showRulers: true,
};
export function validateLayout(value: unknown): WorkspaceLayout {
  const result = { ...defaultLayout };
  if (!value || typeof value !== 'object') return result;
  const input = value as Record<string, unknown>;
  if (['Animation', 'Drawing', 'Rigging'].includes(String(input.workspace))) result.workspace = input.workspace as WorkspaceName;
  for (const [key, min, max] of [['leftWidth', 176, 380], ['rightWidth', 240, 460], ['timelineHeight', 140, 560], ['frameWidth', 4, 40]] as const) {
    const number = input[key]; if (typeof number === 'number' && Number.isFinite(number)) result[key] = Math.round(Math.min(max, Math.max(min, number)));
  }
  for (const key of ['showLayers', 'showProperties', 'showTimeline', 'showRulers'] as const) if (typeof input[key] === 'boolean') result[key] = input[key];
  return result;
}
function readLayout() { try { return validateLayout(JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? 'null')); } catch { return { ...defaultLayout }; } }
interface WorkspaceState extends WorkspaceLayout {
  focused: boolean;
  popout: 'layers' | 'properties' | null;
  togglePanel: (side: 'layers' | 'properties') => void;
  closePopout: () => void;
  cursor: { x: number; y: number } | null;
  setLayout: (patch: Partial<WorkspaceLayout>) => void;
  setCursor: (cursor: WorkspaceState['cursor']) => void;
  toggleFocus: () => void;
  reset: () => void;
  preset: (workspace: WorkspaceName) => void;
}
export const useWorkspace = create<WorkspaceState>((set) => ({
  ...readLayout(), focused: false, popout: null, cursor: null,
  closePopout: () => set({ popout: null }),
  togglePanel: side => set(s => { const key = side === 'layers' ? 'showLayers' : 'showProperties'; const narrow = typeof matchMedia === 'function' && matchMedia(`(max-width: ${side === 'layers' ? 1000 : 800}px)`).matches; return narrow ? { [key]: true, focused: false, popout: s.popout === side ? null : side } : { [key]: !s[key], focused: false, popout: null }; }),
  setLayout: patch => set(s => ({ ...validateLayout({ ...s, ...patch }), focused: false })),
  setCursor: cursor => set(s => s.cursor?.x === cursor?.x && s.cursor?.y === cursor?.y ? s : { cursor }),
  toggleFocus: () => set(s => ({ focused: !s.focused, popout: null })),
  reset: () => set({ ...defaultLayout, focused: false, popout: null }),
  preset: workspace => set({ ...defaultLayout, workspace, rightWidth: workspace === 'Rigging' ? 320 : 282, timelineHeight: workspace === 'Drawing' ? 292 : 258, focused: false, popout: null }),
}));
let writeTimer: ReturnType<typeof setTimeout> | undefined;
useWorkspace.subscribe((s, old) => {
  if ((Object.keys(defaultLayout) as (keyof WorkspaceLayout)[]).every(key => s[key] === old[key])) return;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try { localStorage.setItem(WORKSPACE_KEY, JSON.stringify(validateLayout(useWorkspace.getState()))); } catch { /* Layout preferences never block artwork saves. */ }
  }, 180);
});
