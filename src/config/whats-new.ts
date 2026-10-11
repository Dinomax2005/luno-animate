import { APP_VERSION } from './version';
export const whatsNew = {
  version: APP_VERSION,
  title: 'Motion, footage, and a red eclipse.',
  changes: [
    { title: 'A layer-based motion studio', text: 'Rig / motion now uses clip-based layer timing, individual property keyframes, editable Bézier handles, and animated blur, brightness, and saturation. FK / IK rigging and cutout attachments stay available.' },
    { title: 'Video editing documents', text: 'Import supported MP4, WebM, MOV, or M4V footage, then move, trim, split, and fade clips. Linked sound follows the edits. Add vector artwork, rigged characters, and animated titles over the footage.' },
    { title: 'A real startup screen', text: 'Starting up Luno Animations appears while your local library and workspace are prepared. Startup failures offer a retry instead of leaving you behind an endless loading screen.' },
    { title: 'A new solar eclipse identity', text: 'The red eclipse replaces the old green moon in the app icon, startup screen, favicon, and Windows installer artwork. The workspace now uses a red accent palette in dark and light themes.' },
  ],
  note: 'Video is embedded as portable JPEG proxies up to 960 px and 30 seconds per clip, within the 64 MB .lam limit. Existing projects, linked-file Save, manual drawing frames, autosave, backups, and MP4/audio exports are retained.',
};
