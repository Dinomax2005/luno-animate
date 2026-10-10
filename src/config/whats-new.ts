import { APP_VERSION } from './version';

export const whatsNew = {
  version: APP_VERSION,
  title: 'Documents, frames, and a new starting point.',
  changes: [
    { title: 'Save to the file you opened', text: 'Save updates the same .lam file. Save As chooses a new destination; exporting a copy leaves the linked file alone. External changes are checked before replacement.' },
    { title: 'Hand-drawn animation', text: 'Author each frame as an individual drawing cel. New blank frame and Duplicate to next frame advance the playhead without erasing an existing drawing. Onion skin is enabled; empty frames stay blank.' },
    { title: 'Rig / motion animation', text: 'Keep the drag, pose, and keyframe workflow for vector artwork, characters, and cutouts, with automatic transforms and FK / IK rig controls.' },
    { title: 'A focused start window', text: 'Create either document type, open a .lam file, or continue a recent project. Toggle the window at startup; reopen Start and What’s New from Help at any time.' },
  ],
  note: 'Library autosave and backups remain separate from saving an external file. Direct file saving is available in the desktop app and browsers with file-system permissions; other browsers download a copy.',
};
