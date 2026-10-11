import { APP_VERSION } from './version';
export const whatsNew = {
  version: APP_VERSION,
  title: 'Brushes & Paint',
  changes: [
    { title: 'Twelve expressive brushes', text: 'Round, ink, airbrush, pencil, dry paint, chalk, marker, flat nib, pixel, spray, stipple and glow. Every mark retains its own settings. Brush Studio adds stabilization, pressure, taper, tip dynamics, flow and symmetry.' },
    { title: 'Color Studio & brush packs', text: 'HSV and HEX editing, foreground/background colors, four palettes, recent and saved swatches, a scratchpad, custom presets and validated .lunobrush import/export.' },
    { title: 'Paint, erase, fill & sample', text: 'A non-destructive cel eraser, connected-area fill on the active drawing and a composited-stage eyedropper. B/E/F/I select tools; X/D swap or reset colors, [/] resize, and Alt temporarily samples.' },
    { title: 'Editable animated painting', text: 'Add paint layers and edit the current cel’s mark stack. F6/F7, onion skins, Undo/Redo, thumbnails and SVG/PNG/MP4 output use the same saved brush artwork. Open Paint → Brush Studio or Ctrl/⌘ Shift B.' },
  ],
  note: 'Legacy projects still open; advanced painting files require v0.4.0 or later so older readers cannot silently strip their artwork. Fill works on the active cel at up to 1024 px on its longest side. The blue studio, small launcher, three modes, rigs, linked Save, backups and MP4/audio remain. Video still uses bounded 30-second/960px proxies and the 64 MB .lam limit.',
};
