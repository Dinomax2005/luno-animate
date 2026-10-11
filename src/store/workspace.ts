import { create } from 'zustand';

export type WorkspaceName = 'Animation' | 'Drawing' | 'Rigging' | 'Motion' | 'Video editing';
export interface WorkspaceLayout {
  workspace: WorkspaceName; leftWidth: number; rightWidth: number; timelineHeight: number; frameWidth: number;
  showLayers: boolean; showProperties: boolean; showTimeline: boolean; showRulers: boolean; timelineSnap: boolean;
}
export const WORKSPACE_KEY = 'luno.workspace.pro.v1';
export const WORKSPACE_PROFILES_KEY = 'luno.workspace.pro.profiles.v1';
export const workspaceNames: WorkspaceName[] = ['Animation', 'Drawing', 'Rigging', 'Motion', 'Video editing'];
export const defaultLayout: WorkspaceLayout = {
  workspace: 'Animation', leftWidth: 218, rightWidth: 282, timelineHeight: 258, frameWidth: 12,
  showLayers: true, showProperties: true, showTimeline: true, showRulers: true, timelineSnap: true,
};
export function layoutForWorkspace(workspace: WorkspaceName): WorkspaceLayout {
  return { ...defaultLayout, workspace, rightWidth: ['Rigging', 'Motion', 'Video editing'].includes(workspace) ? 320 : 282,
    leftWidth: workspace === 'Motion' ? 196 : 218, showLayers: workspace !== 'Video editing',
    frameWidth: workspace === 'Video editing' ? 4 : workspace === 'Motion' ? 8 : 12,
    timelineHeight: workspace === 'Drawing' ? 292 : workspace === 'Motion' || workspace === 'Video editing' ? 310 : 258 };
}
export function validateLayout(value: unknown): WorkspaceLayout {
  const result = { ...defaultLayout };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  if (workspaceNames.includes(input.workspace as WorkspaceName)) result.workspace = input.workspace as WorkspaceName;
  for (const [key, min, max] of [['leftWidth', 176, 380], ['rightWidth', 240, 460], ['timelineHeight', 140, 560], ['frameWidth', 4, 40]] as const) {
    const number = input[key]; if (typeof number === 'number' && Number.isFinite(number)) result[key] = Math.round(Math.min(max, Math.max(min, number)));
  }
  for (const key of ['showLayers', 'showProperties', 'showTimeline', 'showRulers', 'timelineSnap'] as const) if (typeof input[key] === 'boolean') result[key] = input[key];
  return result;
}
export type WorkspaceProfiles = Partial<Record<WorkspaceName, WorkspaceLayout>>;
export function validateWorkspaceProfiles(value: unknown): WorkspaceProfiles {
  const profiles: WorkspaceProfiles = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) for (const name of workspaceNames) {
    const candidate = (value as Record<string, unknown>)[name];
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) profiles[name] = validateLayout({ ...layoutForWorkspace(name), ...candidate, workspace: name });
  }
  return profiles;
}
function readLayouts() {
  let layout = { ...defaultLayout }, profiles: WorkspaceProfiles = {}, hasActive = false;
  try { const value = JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? 'null'); hasActive = !!value && typeof value === 'object' && !Array.isArray(value); layout = validateLayout(value); } catch { /* Retain defaults. */ }
  try { profiles = validateWorkspaceProfiles(JSON.parse(localStorage.getItem(WORKSPACE_PROFILES_KEY) ?? 'null')); } catch { /* Old installs have only their active layout. */ }
  // Import the active 0.3.4–0.3.6 layout without overwriting its custom dock sizes.
  if (!hasActive && profiles[layout.workspace]) layout = profiles[layout.workspace]!;
  profiles[layout.workspace] = layout; return { ...layout, profiles };
}
interface WorkspaceState extends WorkspaceLayout {
  profiles: WorkspaceProfiles; focused: boolean; popout: 'layers' | 'properties' | null; cursor: { x: number; y: number } | null;
  togglePanel: (side: 'layers' | 'properties') => void; closePopout: () => void;
  setLayout: (patch: Partial<WorkspaceLayout>) => void; setCursor: (cursor: WorkspaceState['cursor']) => void;
  toggleFocus: () => void; reset: () => void; preset: (workspace: WorkspaceName) => void;
}
export const useWorkspace = create<WorkspaceState>((set) => ({
  ...readLayouts(), focused: false, popout: null, cursor: null,
  closePopout: () => set({ popout: null }),
  togglePanel: side => set(s => {
    const key = side === 'layers' ? 'showLayers' : 'showProperties';
    const narrow = typeof matchMedia === 'function' && matchMedia(`(max-width: ${side === 'layers' ? 1000 : 800}px)`).matches;
    const layout = validateLayout({ ...s, [key]: narrow ? true : !s[key] });
    return { ...layout, profiles: { ...s.profiles, [s.workspace]: layout }, focused: false, popout: narrow && s.popout !== side ? side : null };
  }),
  setLayout: patch => set(s => { const layout = validateLayout({ ...s, ...patch }); return { ...layout, profiles: { ...s.profiles, [layout.workspace]: layout }, focused: false }; }),
  setCursor: cursor => set(s => s.cursor?.x === cursor?.x && s.cursor?.y === cursor?.y ? s : { cursor }),
  toggleFocus: () => set(s => ({ focused: !s.focused, popout: null })),
  reset: () => set(s => { const layout = layoutForWorkspace(s.workspace); return { ...layout, profiles: { ...s.profiles, [s.workspace]: layout }, focused: false, popout: null }; }),
  preset: workspace => set(s => {
    const profiles = { ...s.profiles, [s.workspace]: validateLayout(s) }, layout = profiles[workspace] ?? layoutForWorkspace(workspace);
    return { ...layout, profiles: { ...profiles, [workspace]: layout }, focused: false, popout: null };
  }),
}));
let writeTimer: ReturnType<typeof setTimeout> | undefined;
useWorkspace.subscribe((s, old) => {
  if ((Object.keys(defaultLayout) as (keyof WorkspaceLayout)[]).every(key => s[key] === old[key]) && s.profiles === old.profiles) return;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      const current = useWorkspace.getState();
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(validateLayout(current)));
      localStorage.setItem(WORKSPACE_PROFILES_KEY, JSON.stringify(validateWorkspaceProfiles(current.profiles)));
    } catch { /* Layout preferences never block artwork saves. */ }
  }, 180);
});
