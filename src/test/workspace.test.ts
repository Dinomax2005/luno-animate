import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspace, defaultLayout, validateLayout, WORKSPACE_KEY } from '../store/workspace';
import { useEditor } from '../store/editor';
import { createItem, createProject, createShape } from '../engine/project';
import { capturePose, sampleItem } from '../engine/animation';
import { sceneNodes, transformPoint } from '../engine/geometry';
import { appCommands, applyWorkspace, executeCommand, shortcutLabel } from '../components/studio/commands';

const s = () => useEditor.getState(), w = () => useWorkspace.getState();
const actions = { onOpen: vi.fn(), onSave: vi.fn(), onImport: vi.fn(), onImportAudio: vi.fn() };
beforeEach(() => {
  s().replaceProject(createProject('blank'), false);
  useEditor.setState({ busy: false, blockReason: null, interacting: false, dialog: null, toast: null, preferences: { ...s().preferences, autoKey: true, theme: 'dark' } });
  w().reset(); localStorage.removeItem(WORKSPACE_KEY);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('independent production workspace preferences', () => {
  it('falls back safely for invalid or missing storage data', () => {
    for (const value of [null, undefined, 'Animation', [], 4]) expect(validateLayout(value)).toEqual(defaultLayout);
    expect(validateLayout({ workspace: 'fake', showLayers: 'false', frameWidth: Infinity })).toEqual(defaultLayout);
  });
  it('bounds every resizable dimension and preserves explicit booleans', () => {
    expect(validateLayout({ workspace: 'Rigging', leftWidth: 999, rightWidth: -2, timelineHeight: 900, frameWidth: 0, showLayers: false, showProperties: false, showTimeline: false, showRulers: false })).toEqual({ ...defaultLayout, workspace: 'Rigging', leftWidth: 380, rightWidth: 240, timelineHeight: 560, frameWidth: 4, showLayers: false, showProperties: false, showTimeline: false, showRulers: false });
  });
  it('persists layout but never serializes artwork, cursor, or temporary focus', () => {
    vi.useFakeTimers(); w().setLayout({ leftWidth: 271, frameWidth: 8 }); w().setCursor({ x: 200, y: 300 }); w().toggleFocus(); vi.advanceTimersByTime(181);
    const saved = JSON.parse(localStorage.getItem(WORKSPACE_KEY)!);
    expect(saved.leftWidth).toBe(271); expect(saved.frameWidth).toBe(8); expect(Object.keys(saved).sort()).toEqual(Object.keys(defaultLayout).sort()); expect(saved).not.toHaveProperty('project');
  });
  it('does not write or create undo entries for cursor motion', () => {
    vi.useFakeTimers(); const project = s().project; w().setCursor({ x: 2, y: 3 }); w().setCursor({ x: 3, y: 4 }); vi.advanceTimersByTime(181);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull(); expect(s().project).toBe(project); expect(s().history).toHaveLength(0);
  });
  it('configures real drawing and rigging tools without changing the document', () => {
    const project = s().project; applyWorkspace('Drawing'); expect(s().tool).toBe('pen'); expect(s().preferences.drawingMode).toBe('cel'); expect(s().preferences.onionSkin).toBe(true); expect(w().timelineHeight).toBe(292);
    applyWorkspace('Rigging'); expect(s().tool).toBe('rig'); expect(s().preferences.inverseKinematics).toBe(true); expect(s().preferences.showBones).toBe(true); expect(w().rightWidth).toBe(320);
    expect(s().project).toBe(project); expect(s().history).toHaveLength(0);
  });
  it('retains panel choices when focus mode is restored', () => {
    w().setLayout({ showLayers: false, rightWidth: 315 }); w().toggleFocus(); w().toggleFocus(); expect(w().showLayers).toBe(false); expect(w().rightWidth).toBe(315);
  });
  it('makes small-screen panels accessible as dismissible overlays', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true })); w().togglePanel('layers'); expect(w().popout).toBe('layers'); expect(w().showLayers).toBe(true); w().togglePanel('properties'); expect(w().popout).toBe('properties'); w().closePopout(); expect(w().popout).toBeNull();
  });
});

describe('context-aware application commands', () => {
  it('has unique IDs, real menu categories, and searchable workspace commands', () => {
    const commands = appCommands(actions); expect(new Set(commands.map(c => c.id)).size).toBe(commands.length); expect(new Set(commands.map(c => c.menu)).size).toBe(9); expect(commands.find(c => c.id === 'window.workspace.rigging')?.label).toBe('Rigging workspace');
  });
  it('disables unavailable undo, redo, and object commands', () => {
    const commands = appCommands(actions); for (const id of ['edit.undo', 'edit.redo', 'edit.duplicate', 'object.group']) expect(commands.find(c => c.id === id)!.enabled!()).toBe(false);
  });
  it('blocks execution during exports, restore, and pointer transactions', async () => {
    const run = vi.fn(), command = { id: 'test', label: 'Test', menu: 'Edit' as const, icon: appCommands(actions)[0].icon, run };
    for (const patch of [{ busy: true }, { busy: false, blockReason: 'Saving' }, { blockReason: null, interacting: true }]) { useEditor.setState(patch); await executeCommand(command); }
    expect(run).not.toHaveBeenCalled(); useEditor.setState({ interacting: false }); await executeCommand(command); expect(run).toHaveBeenCalledTimes(1);
  });
  it('reports command failures without altering the document', async () => {
    const before = s().project, command = { ...appCommands(actions)[0], run: () => { throw new Error('Operation failed'); } }; await executeCommand(command); expect(s().toast?.message).toBe('Operation failed'); expect(s().toast?.tone).toBe('error'); expect(s().project).toBe(before);
  });
  it('preserves the plus key in zoom shortcut labels', () => { expect(shortcutLabel('Ctrl++')).toContain('+'); });
});

describe('stage selection and spatial keyboard nudging', () => {
  it('initializes a consistent single selection for imported/template documents', () => {
    s().replaceProject(createProject('character'), false); expect(s().selectedIds).toEqual([s().selectedId]);
  });
  it('nudges every unlocked selected layer in a single undo transaction', () => {
    const a = createShape('rectangle', 10, 20), b = createShape('ellipse', 50, 60); const project = createProject('blank'); project.items = [a, b]; s().replaceProject(project, false); s().select(a.id); s().toggleSelect(b.id); s().nudgeSelected(10, -1);
    expect(s().project.items.map(i => [i.x, i.y])).toEqual([[20, 19], [60, 59]]); expect(s().history).toHaveLength(1); expect(s().frame).toBe(0); s().undo(); expect(s().project.items).toEqual(project.items); expect(s().selectedIds).toEqual([a.id, b.id]);
  });
  it('respects inherited locks and creates no useless undo checkpoint', () => {
    const parent = createItem('group', { locked: true }), child = createShape('rectangle'); child.parentId = parent.id; const project = createProject('blank'); project.items = [parent, child]; s().replaceProject(project, false); s().select(child.id); s().nudgeSelected(1, 0); expect(s().project.items[1]).toEqual(child); expect(s().history).toHaveLength(0);
  });
  it('converts world-space deltas through rotated/scaled parent transforms', () => {
    const parent = createItem('group', { rotation: 90, scaleX: 2, scaleY: 2 }), child = createShape('rectangle', 30, 40); child.parentId = parent.id; const project = createProject('blank'); project.items = [parent, child]; s().replaceProject(project, false); s().select(child.id);
    const origin = () => transformPoint(sceneNodes(s().project, 0).find(n => n.item.id === child.id)!.matrix, { x: 0, y: 0 }); const before = origin(); s().nudgeSelected(10, 0); expect(origin().x - before.x).toBeCloseTo(10); expect(origin().y - before.y).toBeCloseTo(0);
  });
  it('does not move descendants twice when any selected ancestor moves', () => {
    const root = createItem('group', { x: 100 }), middle = createItem('group', { parentId: root.id }), child = createShape('rectangle', 10, 20); child.parentId = middle.id; const project = createProject('blank'); project.items = [root, middle, child]; s().replaceProject(project, false); s().select(root.id); s().toggleSelect(child.id); s().nudgeSelected(1, 0);
    expect(s().project.items.find(i => i.id === root.id)!.x).toBe(101); expect(s().project.items.find(i => i.id === child.id)!.x).toBe(10); expect(s().history).toHaveLength(1);
  });
  it('nudges the sampled pose at the current frame, not the base transform', () => {
    const item = createShape('rectangle', 100, 120), project = createProject('blank'); project.items = [item]; project.keyframes[item.id] = [{ id: 'key-0', frame: 0, easing: 'linear', values: capturePose(item) }, { id: 'key-20', frame: 20, easing: 'linear', values: { ...capturePose(item), x: 200 } }]; s().replaceProject(project, false); s().select(item.id); s().setFrame(10); s().nudgeSelected(1, 0);
    const after = s().project; expect(sampleItem(after.items[0], after.keyframes[item.id], 10).x).toBe(151); expect(after.items[0].x).toBe(100); expect(after.keyframes[item.id]).toHaveLength(3); expect(s().history).toHaveLength(1);
  });
  it('ignores invalid deltas and blocks nudging during protected operations', () => {
    s().addShape('rectangle'); const before = s().project, history = s().history.length; s().nudgeSelected(NaN, 0); s().nudgeSelected(0, Infinity); s().nudgeSelected(0, 0); useEditor.setState({ busy: true }); s().nudgeSelected(1, 0); expect(s().project).toBe(before); expect(s().history).toHaveLength(history);
  });
});
