import { create } from 'zustand';
import { APP_VERSION } from '../config/version';
import type { AnimationMode } from '../engine/types';
import { useEditor } from '../store/editor';

export const LAUNCH_KEY = 'luno.launch.v1';
function readLaunch() {
  try {
    const value = JSON.parse(localStorage.getItem(LAUNCH_KEY) ?? '{}');
    return { showStart: value.showStart !== false, seenVersion: typeof value.seenVersion === 'string' && value.seenVersion.length < 40 ? value.seenVersion : null };
  } catch { return { showStart: true, seenVersion: null }; }
}
function persist(showStart: boolean, seenVersion: string | null) {
  try { localStorage.setItem(LAUNCH_KEY, JSON.stringify({ showStart, seenVersion })); } catch { /* Launch preferences never block opening or saving artwork. */ }
}
export const useLaunch = create<{
  showStart: boolean; seenVersion: string | null; newMode: AnimationMode; presented: boolean; pendingStart: boolean; automaticNews: boolean;
  setShowStart: (value: boolean) => void; setNewMode: (mode: AnimationMode) => void;
  acknowledgeNews: () => void; openNews: () => void;
}>(set => ({
  ...readLaunch(), newMode: 'rigged', presented: false, pendingStart: false, automaticNews: false,
  setShowStart: showStart => set(s => { persist(showStart, s.seenVersion); return { showStart }; }),
  setNewMode: newMode => set({ newMode }),
  acknowledgeNews: () => {
    const s = useLaunch.getState(); persist(s.showStart, APP_VERSION);
    const start = s.automaticNews && s.pendingStart && s.showStart && useEditor.getState().view === 'home';
    set({ seenVersion: APP_VERSION, automaticNews: false, pendingStart: false });
    useEditor.getState().setDialog(start ? 'start' : null);
  },
  openNews: () => { set({ automaticNews: false, pendingStart: false }); useEditor.getState().setDialog('whats-new'); },
}));
/** Run after the durable library and native file-association handoff, never on every render. */
export function presentLaunch(associatedFile = false) {
  const s = useLaunch.getState(), editor = useEditor.getState();
  if (s.presented) return;
  useLaunch.setState({ presented: true });
  if (editor.dialog || editor.busy || editor.blockReason) return;
  const start = s.showStart && !associatedFile && editor.view === 'home';
  if (s.seenVersion !== APP_VERSION) {
    useLaunch.setState({ pendingStart: start, automaticNews: true }); editor.setDialog('whats-new');
  } else if (start) editor.setDialog('start');
}
