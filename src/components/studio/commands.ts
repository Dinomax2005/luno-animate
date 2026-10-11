import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, Bone, Brush, Check, Copy, DiamondPlus, Download, Expand, Eye, Film, FolderOpen, Grid3X3, Group, History, Home, Image, Layers2, Magnet, Moon, PanelLeft, PanelRight, Pause, Play, Plus, Redo2, RefreshCw, Repeat2, Route, Save, Search, Settings2, Square, Sun, Trash2, Type, Ungroup, Undo2, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEditor } from '../../store/editor';
import { useWorkspace, type WorkspaceName } from '../../store/workspace';
import { isLayerLocked } from '../../engine/geometry';
import { useLaunch } from '../../services/launch';
import { goHome } from '../../services/library';

export interface AppActions { onOpen: () => void; onSave: () => void; onSaveAs?: () => void; onSaveCopy?: () => void; onImport: () => void; onImportAudio: () => void; onImportVideo?: () => void }
export type MenuName = 'File' | 'Edit' | 'Insert' | 'Object' | 'Animation' | 'View' | 'Window' | 'Help';
export const menuNames: MenuName[] = ['File', 'Edit', 'Insert', 'Object', 'Animation', 'View', 'Window', 'Help'];
export interface AppCommand {
  id: string; label: string; menu: MenuName; icon: LucideIcon; shortcut?: string;
  description?: string; separator?: boolean; checked?: boolean;
  enabled?: () => boolean; run: () => void | Promise<unknown>;
}
const s = () => useEditor.getState();
const w = () => useWorkspace.getState();
const editing = () => s().view === 'editor' && !s().busy && !s().blockReason && !s().interacting;
const selection = () => editing() && s().selectedIds.some(id => !isLayerLocked(s().project.items, id));
const dialog = (name: Parameters<ReturnType<typeof useEditor.getState>['setDialog']>[0]) => () => s().setDialog(name);
export function applyWorkspace(name: WorkspaceName) {
  w().preset(name);
  if (name === 'Rigging') { s().setPreference('showBones', true); s().setPreference('inverseKinematics', true); s().setTool('rig'); }
  else if (name === 'Drawing') { s().setPreference('drawingMode', 'cel'); s().setPreference('onionSkin', true); s().setTool('pen'); }
  else { s().setTool('select'); }
}
export function appCommands(actions: AppActions): AppCommand[] {
  const p = s().preferences;
  const commands: AppCommand[] = [
    { id: 'file.new', menu: 'File', label: 'New project', icon: Plus, shortcut: 'Ctrl+N', run: dialog('new') },
    { id: 'file.open', menu: 'File', label: 'Open project…', icon: FolderOpen, shortcut: 'Ctrl+O', run: actions.onOpen },
    { id: 'file.home', menu: 'File', label: 'All projects', icon: Home, shortcut: 'Ctrl+Home', run: goHome, enabled: editing },
    { id: 'file.save', menu: 'File', label: 'Save', icon: Save, shortcut: 'Ctrl+S', description: 'Update the opened .lam file, or choose a destination for a new document', separator: true, run: actions.onSave, enabled: editing },
    { id: 'file.save-as', menu: 'File', label: 'Save As…', icon: Save, shortcut: 'Ctrl+Shift+S', description: 'Choose a .lam file and make it the new Save destination', run: () => actions.onSaveAs?.(), enabled: () => editing() && !!actions.onSaveAs },
    { id: 'file.save-copy', menu: 'File', label: 'Export .lam copy…', icon: Copy, description: 'Portable editable copy; do not change the linked Save destination', run: () => actions.onSaveCopy?.(), enabled: () => editing() && !!actions.onSaveCopy },
    { id: 'file.export', menu: 'File', label: 'Export animation…', icon: Download, shortcut: 'Ctrl+E', description: 'MP4, GIF, PNG, SVG, or sprite atlas', run: dialog('export'), enabled: editing },
    { id: 'file.settings', menu: 'File', label: 'Document settings…', icon: Settings2, separator: true, run: dialog('settings'), enabled: editing },
    { id: 'file.updates', menu: 'File', label: 'Updates & backups', icon: RefreshCw, run: dialog('updates') },
    { id: 'file.desktop', menu: 'File', label: 'Get the desktop app', icon: Download, run: dialog('download') },
    { id: 'edit.undo', menu: 'Edit', label: 'Undo', icon: Undo2, shortcut: 'Ctrl+Z', run: () => s().undo(), enabled: () => editing() && !!s().history.length },
    { id: 'edit.redo', menu: 'Edit', label: 'Redo', icon: Redo2, shortcut: 'Ctrl+Shift+Z', run: () => s().redo(), enabled: () => editing() && !!s().future.length },
    { id: 'edit.copykeys', menu: 'Edit', label: 'Copy selected keyframes', icon: Copy, shortcut: 'Ctrl+C', separator: true, run: () => s().copyKeys(), enabled: () => editing() && !!s().keySelection.length },
    { id: 'edit.pastekeys', menu: 'Edit', label: 'Paste keyframes at playhead', icon: History, shortcut: 'Ctrl+V', run: () => s().pasteKeys(), enabled: () => editing() && !!s().keyClipboard.length },
    { id: 'edit.selectall', menu: 'Edit', label: 'Select all layers', icon: Layers2, shortcut: 'Ctrl+A', separator: true, run: () => s().selectAll(), enabled: editing },
    { id: 'edit.duplicate', menu: 'Edit', label: 'Duplicate selection', icon: Copy, shortcut: 'Ctrl+D', run: () => s().duplicateSelected(), enabled: selection },
    { id: 'edit.delete', menu: 'Edit', label: 'Delete selection', icon: Trash2, shortcut: 'Delete', run: () => s().keySelection.length ? s().deleteKeys() : s().deleteSelected(), enabled: () => selection() || editing() && (!!s().keySelection.length || !!s().selectedAudio) },
    { id: 'insert.scene', menu: 'Insert', label: 'Scene', icon: Plus, shortcut: 'Ctrl+Shift+N', run: () => s().addScene(), enabled: () => editing() && s().project.sceneOrder.length < 32 },
    { id: 'insert.character', menu: 'Insert', label: 'Rigged character', icon: Bone, separator: true, run: () => s().addCharacter(), enabled: editing },
    { id: 'insert.rig', menu: 'Insert', label: 'Cutout rig', icon: Bone, run: () => s().addBlankRig(), enabled: editing },
    { id: 'insert.rectangle', menu: 'Insert', label: 'Rectangle', icon: Square, run: () => s().addShape('rectangle'), enabled: editing },
    { id: 'insert.text', menu: 'Insert', label: 'Text layer', icon: Type, run: () => s().addText(), enabled: editing },
    { id: 'insert.image', menu: 'Insert', label: 'Import artwork…', icon: Image, separator: true, run: actions.onImport, enabled: editing },
    { id: 'insert.video', menu: 'Insert', label: 'Import video…', icon: Film, description: 'Decode MP4 / WebM / MOV footage into embedded editing proxies', run: () => actions.onImportVideo?.(), enabled: () => editing() && !!actions.onImportVideo && s().project.animationMode !== 'frame-by-frame' },
    { id: 'insert.audio', menu: 'Insert', label: 'Import sound…', icon: Volume2, run: actions.onImportAudio, enabled: editing },
    { id: 'object.group', menu: 'Object', label: 'Group selection', icon: Group, shortcut: 'Ctrl+G', run: () => s().groupSelected(), enabled: () => selection() && s().selectedIds.length > 1 },
    { id: 'object.ungroup', menu: 'Object', label: 'Ungroup', icon: Ungroup, shortcut: 'Ctrl+Shift+G', run: () => s().ungroupSelected(), enabled: () => selection() && s().project.items.some(i => s().selectedIds.includes(i.id) && i.type === 'group') },
    { id: 'object.front', menu: 'Object', label: 'Bring forward', icon: Layers2, shortcut: 'Ctrl+]', separator: true, run: () => { if (s().selectedId) s().moveLayer(s().selectedId!, 'up'); }, enabled: selection },
    { id: 'object.back', menu: 'Object', label: 'Send backward', icon: Layers2, shortcut: 'Ctrl+[', run: () => { if (s().selectedId) s().moveLayer(s().selectedId!, 'down'); }, enabled: selection },
    { id: 'animation.play', menu: 'Animation', label: s().playing ? 'Stop playback' : 'Play work area', icon: s().playing ? Pause : Play, shortcut: 'Space', run: () => s().setPlaying(!s().playing), enabled: editing },
    { id: 'animation.key', menu: 'Animation', label: 'Insert keyframe', icon: DiamondPlus, shortcut: 'K', separator: true, run: () => s().addKeyframe(), enabled: () => selection() || editing() && s().selectedCamera },
    { id: 'animation.cel', menu: 'Animation', label: s().project.animationMode === 'frame-by-frame' ? 'Duplicate to next frame' : 'Insert drawing exposure', icon: Brush, shortcut: 'F6', run: () => s().project.animationMode === 'frame-by-frame' ? s().nextDrawingFrame('duplicate') : s().duplicateCel(), enabled: () => editing() && s().project.items.some(i => i.id === s().selectedId && i.type === 'drawing' && !isLayerLocked(s().project.items, i.id)) },
    { id: 'animation.blank', menu: 'Animation', label: s().project.animationMode === 'frame-by-frame' ? 'New blank frame' : 'Insert blank cel', icon: Film, shortcut: 'F7', run: () => s().project.animationMode === 'frame-by-frame' ? s().nextDrawingFrame('blank') : s().blankCel(), enabled: () => editing() && s().project.items.some(i => i.id === s().selectedId && i.type === 'drawing' && !isLayerLocked(s().project.items, i.id)) },
    { id: 'animation.split', menu: 'Animation', label: 'Split clip at playhead', icon: Film, shortcut: 'Ctrl+Shift+D', run: () => { if (s().selectedId) s().editClip(s().selectedId!, 'split', s().frame); }, enabled: () => selection() && s().project.animationMode !== 'frame-by-frame' },
    { id: 'animation.autokey', menu: 'Animation', label: 'Auto-key transforms', icon: DiamondPlus, checked: p.autoKey, separator: true, run: () => s().setPreference('autoKey', !s().preferences.autoKey), enabled: () => editing() && s().project.animationMode !== 'frame-by-frame' },
    { id: 'animation.loop', menu: 'Animation', label: 'Loop playback', icon: Repeat2, checked: p.loop, run: () => s().setPreference('loop', !s().preferences.loop), enabled: editing },
    { id: 'view.fit', menu: 'View', label: 'Fit stage in window', icon: Expand, shortcut: 'Ctrl+0', run: () => { s().setZoom(100); s().setPan({ x: 0, y: 0 }); }, enabled: editing },
    { id: 'view.zoom.in', menu: 'View', label: 'Zoom in', icon: Plus, shortcut: 'Ctrl++', run: () => s().setZoom(s().zoom * 1.25), enabled: editing },
    { id: 'view.zoom.out', menu: 'View', label: 'Zoom out', icon: Search, shortcut: 'Ctrl+-', run: () => s().setZoom(s().zoom / 1.25), enabled: editing },
    { id: 'view.grid', menu: 'View', label: 'Grid', icon: Grid3X3, checked: p.showGrid, separator: true, run: () => s().setPreference('showGrid', !s().preferences.showGrid), enabled: editing },
    { id: 'view.snap', menu: 'View', label: 'Snap to grid', icon: Magnet, checked: p.snapToGrid, run: () => s().setPreference('snapToGrid', !s().preferences.snapToGrid), enabled: editing },
    { id: 'view.rulers', menu: 'View', label: 'Stage rulers', icon: Grid3X3, checked: w().showRulers, run: () => w().setLayout({ showRulers: !w().showRulers }), enabled: editing },
    { id: 'view.bones', menu: 'View', label: 'Rig overlay', icon: Bone, checked: p.showBones, separator: true, run: () => s().setPreference('showBones', !s().preferences.showBones), enabled: editing },
    { id: 'view.motion', menu: 'View', label: 'Motion paths', icon: Route, checked: p.showMotionPath, run: () => s().setPreference('showMotionPath', !s().preferences.showMotionPath), enabled: editing },
    { id: 'view.onion', menu: 'View', label: 'Onion skin', icon: Eye, shortcut: 'U', checked: p.onionSkin, run: () => s().setPreference('onionSkin', !s().preferences.onionSkin), enabled: editing },
    { id: 'view.theme', menu: 'View', label: p.theme === 'dark' ? 'Use light interface' : 'Use dark interface', icon: p.theme === 'dark' ? Sun : Moon, separator: true, run: () => s().setPreference('theme', s().preferences.theme === 'dark' ? 'light' : 'dark') },
    { id: 'window.layers', menu: 'Window', label: 'Layers / Library', icon: PanelLeft, checked: w().showLayers && !w().focused, run: () => w().togglePanel('layers'), enabled: editing },
    { id: 'window.properties', menu: 'Window', label: 'Properties', icon: PanelRight, checked: w().showProperties && !w().focused, run: () => w().togglePanel('properties'), enabled: editing },
    { id: 'window.timeline', menu: 'Window', label: 'Timeline', icon: Film, checked: w().showTimeline && !w().focused, run: () => w().setLayout({ showTimeline: !w().showTimeline }), enabled: editing },
    { id: 'window.focus', menu: 'Window', label: 'Focus stage', icon: Expand, shortcut: 'Tab', checked: w().focused, separator: true, run: () => w().toggleFocus(), enabled: editing },
    ...(['Animation', 'Drawing', 'Rigging', 'Motion', 'Video editing'] as const).map(name => ({ id: `window.workspace.${name.toLowerCase()}`, menu: 'Window' as const, label: `${name} workspace`, icon: name === 'Rigging' ? Bone : name === 'Drawing' ? Brush : Film, checked: w().workspace === name, run: () => applyWorkspace(name), enabled: editing })),
    { id: 'window.reset', menu: 'Window', label: 'Reset workspace layout', icon: RefreshCw, run: () => w().reset(), enabled: editing },
    { id: 'help.start', menu: 'Help', label: 'Start window…', icon: Home, run: dialog('start') },
    { id: 'help.news', menu: 'Help', label: 'What’s New…', icon: Film, run: () => useLaunch.getState().openNews() },
    { id: 'help.commands', menu: 'Help', label: 'Command search…', icon: Search, shortcut: 'Ctrl+Shift+P', run: dialog('commands') },
    { id: 'help.reference', menu: 'Help', label: 'Tools & keyboard reference', icon: Check, shortcut: 'F1', run: dialog('help') },
    { id: 'help.setup', menu: 'Help', label: 'Workspace setup', icon: Settings2, run: dialog('setup') },
  ];
  const align = [ ['left', 'Align left', AlignStartVertical], ['center', 'Align horizontal centers', AlignCenterVertical], ['right', 'Align right', AlignEndVertical], ['top', 'Align top', AlignStartHorizontal], ['middle', 'Align vertical centers', AlignCenterHorizontal], ['bottom', 'Align bottom', AlignEndHorizontal]] as const;
  commands.splice(commands.findIndex(c => c.id === 'animation.play'), 0, ...align.map(([mode, label, icon], n) => ({ id: `object.align.${mode}`, menu: 'Object' as const, label, icon, separator: n === 0, run: () => s().alignSelected(mode), enabled: () => selection() && s().project.items.some(i => s().selectedIds.includes(i.id) && !i.parentId && !i.attachment && !i.locked) })));
  return commands;
}
export async function executeCommand(command: AppCommand) {
  const state = s(); if (state.busy || state.blockReason || state.interacting || command.enabled?.() === false) return;
  (document.activeElement as HTMLElement | null)?.blur?.();
  try { await command.run(); } catch (error) { s().notify(error instanceof Error ? error.message : 'The command could not be completed.', 'error'); }
}
export function shortcutLabel(shortcut?: string) {
  if (!shortcut) return '';
  const mac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) || typeof window !== 'undefined' && window.luno?.platform === 'darwin';
  return mac ? shortcut.replace('Ctrl+', '⌘ ').replace('Shift+', '⇧ ').replace('Alt+', '⌥ ') : shortcut.replace('Ctrl+', 'Ctrl ').replace('Shift+', 'Shift ').replace('Alt+', 'Alt ');
}
