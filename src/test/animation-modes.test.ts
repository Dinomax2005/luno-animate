import { beforeEach, describe, expect, it } from 'vitest';
import { createItem, createProject, parseProject } from '../engine/project';
import { sampleCel, sampleItem } from '../engine/animation';
import { decodeLam, encodeLam } from '../engine/lam';
import { projectRecord } from '../engine/library-record';
import { useEditor } from '../store/editor';

const s = () => useEditor.getState();
beforeEach(() => { s().replaceProject(createProject('blank', 'frame-by-frame'), false); useEditor.setState({ busy: false, blockReason: null, interacting: false, dialog: null, toast: null }); });
describe('real hand-drawn documents', () => {
  it('starts with an individual blank cel, a selected drawing layer, and manual editing defaults', () => {
    expect(s().project).toMatchObject({ animationMode: 'frame-by-frame', duration: 2, keyframes: {} });
    expect(s().project.items[0]).toMatchObject({ type: 'drawing', holdCels: false, cels: [{ frame: 0, strokes: [] }] });
    expect(s().selectedId).toBe(s().project.items[0].id); expect(s().tool).toBe('pen');
    expect(s().preferences).toMatchObject({ drawingMode: 'cel', onionSkin: true, autoKey: false, showBones: false });
    expect(projectRecord(s().project).kind).toBe('Frame-by-frame');
  });
  it('draws only the authored frame, never an automatic in-between drawing', () => {
    s().addCelStroke([{ x: 120, y: 100 }, { x: 160, y: 140 }]); const item = s().project.items[0];
    expect(sampleCel(item, 0)?.strokes).toHaveLength(1); expect(sampleCel(item, 1)).toBeUndefined();
    expect(s().project.keyframes).toEqual({});
  });
  it('creates the next blank frame without changing the previous drawing', () => {
    s().addCelStroke([{ x: 120, y: 100 }, { x: 160, y: 140 }]); const original = structuredClone(s().project.items[0].cels![0]);
    s().nextDrawingFrame('blank'); expect(s().frame).toBe(1); expect(sampleCel(s().project.items[0], 1)?.strokes).toEqual([]);
    s().addCelStroke([{ x: 180, y: 100 }, { x: 200, y: 140 }]);
    expect(s().project.items).toHaveLength(1); expect(s().project.items[0].cels![0]).toEqual(original);
    expect(sampleCel(s().project.items[0], 1)?.strokes).toHaveLength(1);
  });
  it('duplicates to the next frame as an independent drawing and grows the timeline', () => {
    s().nextDrawingFrame('blank'); s().addCelStroke([{ x: 10, y: 20 }, { x: 30, y: 40 }]);
    s().nextDrawingFrame('duplicate'); const cels = s().project.items[0].cels!;
    expect(s().frame).toBe(2); expect(s().project.duration).toBe(3); expect(s().project.workArea.end).toBe(2);
    expect(cels[2].strokes).toEqual(cels[1].strokes); expect(cels[2].strokes).not.toBe(cels[1].strokes);
    s().addCelStroke([{ x: 40, y: 20 }, { x: 50, y: 40 }]); expect(s().project.items[0].cels![1].strokes).toHaveLength(1); expect(s().project.items[0].cels![2].strokes).toHaveLength(2);
  });
  it('preserves an existing next-frame cel instead of destructively replacing it', () => {
    s().nextDrawingFrame('blank'); s().addCelStroke([{ x: 1, y: 2 }, { x: 3, y: 4 }]); s().setFrame(0);
    const p = s().project, history = s().history.length; s().nextDrawingFrame('blank');
    expect(s().project).toBe(p); expect(s().history).toHaveLength(history); expect(s().frame).toBe(1); expect(s().toast?.message).toContain('was kept');
  });
  it('next-frame creation is undoable and redoable', () => {
    const p = structuredClone(s().project); s().nextDrawingFrame('blank'); s().undo(); expect(s().project).toEqual(p);
    s().redo(); expect(s().project.items[0].cels).toHaveLength(2);
  });
  it('respects locked layers and the 1800-frame bound', () => {
    s().editItem(s().selectedId!, { locked: true }); const p = s().project; s().nextDrawingFrame('blank'); expect(s().project).toBe(p);
    s().editItem(s().selectedId!, { locked: false }); s().resizeProject({ duration: 1800 }); s().setFrame(1799);
    const full = s().project; s().nextDrawingFrame('duplicate'); expect(s().project).toBe(full); expect(s().frame).toBe(1799); expect(s().toast?.message).toContain('1800');
  });
  it('new drawing layers also use exact-frame cels, and new scenes keep the document mode', () => {
    s().select(null); s().addCelStroke([{ x: 1, y: 2 }, { x: 3, y: 4 }]); expect(s().project.items.at(-1)!.holdCels).toBe(false);
    const firstScene = s().project.sceneId; s().addScene(); expect(s().project.animationMode).toBe('frame-by-frame'); expect(s().project.items[0].holdCels).toBe(false); expect(s().selectedId).toBe(s().project.items[0].id);
    s().switchScene(firstScene); expect(s().selectedId).toBe(s().project.items[0].id);
  });
  it('does not automatically record transform tweens even if an old preference enables auto-key', () => {
    s().setPreference('autoKey', true); s().setFrame(1); s().editItem(s().selectedId!, { x: 100 });
    expect(s().project.keyframes).toEqual({});
  });
  it('persists both the document type and all authored cels through LAM', () => {
    s().addCelStroke([{ x: 10, y: 20 }, { x: 30, y: 40 }]); s().nextDrawingFrame('blank');
    const restored = decodeLam(encodeLam(s().project)); expect(restored).toEqual(s().project); expect(sampleCel(restored.items[0], 1)?.strokes).toEqual([]);
  });
});
describe('rig documents and old projects', () => {
  it('keeps the existing character/drag/automatic-keyframe workflow', () => {
    s().replaceProject(createProject('character'), false); expect(s().project.animationMode).toBe('rigged'); expect(s().tool).toBe('select'); expect(s().preferences.autoKey).toBe(true);
    s().setFrame(12); s().editItem(s().selectedId!, { x: 580 }); const item = s().project.items.find(i => i.id === s().selectedId)!;
    expect(s().project.keyframes[item.id]).toHaveLength(2); expect(sampleItem(item, s().project.keyframes[item.id], 6).x).toBeGreaterThan(480); expect(sampleItem(item, s().project.keyframes[item.id], 6).x).toBeLessThan(580);
  });
  it('defaults older schema-2 documents without an animation type to rigged', () => {
    const old = { ...createProject('character') } as Partial<ReturnType<typeof createProject>>; delete old.animationMode;
    expect(parseProject(JSON.stringify(old)).animationMode).toBe('rigged');
    expect(() => parseProject(JSON.stringify({ ...old, animationMode: 'unsupported' }))).toThrow();
  });
  it('does not reset a user’s tool/auto-key when applying settings to the same document', () => {
    s().replaceProject(createProject('character'), false); s().setPreference('autoKey', false); s().setTool('rig');
    s().replaceProject({ ...s().project, fps: 12 }); expect(s().tool).toBe('rig'); expect(s().preferences.autoKey).toBe(false);
  });
  it('preserves the original held drawing behavior in rig projects', () => {
    s().replaceProject(createProject('blank'), false); s().addCelStroke([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
    expect(sampleCel(s().project.items[0], 15)?.strokes).toHaveLength(1);
    expect(createItem('drawing').holdCels).toBeUndefined();
  });
});
