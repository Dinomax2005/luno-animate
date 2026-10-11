import { APP_VERSION } from './version';
export const whatsNew = {
  version: APP_VERSION,
  title: 'A blue studio. A sharper workflow.',
  changes: [
    { title: 'Small launcher, ready studio', text: 'The installed app opens a separate compact startup window. It closes before the main studio appears—no full-window loading screen. Startup errors offer Retry or Quit; browsers use a compact fallback card.' },
    { title: 'A coherent blue workspace', text: 'A blue eclipse identity, dark and light blue accents, clearer panel hierarchy, visible keyboard focus, and more readable selection states. Existing artwork is never recolored.' },
    { title: 'Precision motion and clip editing', text: 'Expand layers into individual property tracks. Move, copy, paste, or delete channel keys without losing other transforms, effects, or rig poses. Clips snap to the playhead and neighboring boundaries; hold Alt to bypass. Trim handles can restore available source footage and linked sound.' },
    { title: 'A workspace that stays yours', text: 'Motion, Drawing, Rigging, Animation, and Video editing remember their own docks, panel visibility, timeline zoom, and snapping. Ctrl/⌘ Shift D now really splits; opacity sliders and effect resets edit the animated values at the playhead.' },
  ],
  note: 'All three document modes, rigs, manual cels, linked-file Save, autosave, backups, and MP4/audio export remain. Video uses portable proxies up to 30 seconds and 960 px per clip, within the 64 MB .lam limit. Easing remains shared by channels at the same frame.',
};
