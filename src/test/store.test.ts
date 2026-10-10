import { beforeEach, describe, expect, it } from 'vitest';
import { useEditor } from '../store/editor';
import { createProject, createShape } from '../engine/project';
import { sampleItem } from '../engine/animation';

beforeEach(() => {
  const project = createProject(); useEditor.getState().replaceProject(project, false);
  useEditor.setState({ preferences: { onboardingComplete: true, autoKey: true, showBones: true, showGrid: false, loop: true, theme: 'light' }, toast: null });
});
describe('editor state and history', () => {
  it('adds, undoes, and redoes an object', () => {
    useEditor.getState().addShape('star'); expect(useEditor.getState().project.items).toHaveLength(5);
    useEditor.getState().undo(); expect(useEditor.getState().project.items).toHaveLength(4);
    useEditor.getState().redo(); expect(useEditor.getState().project.items).toHaveLength(5);
  });
  it('preserves prior project snapshots during edits', () => {
    const before = structuredClone(useEditor.getState().project); const item = before.items.at(-1)!;
    useEditor.getState().editItem(item.id, { x: 10 });
    expect(useEditor.getState().history[0]).toEqual(before);
  });
  it('groups a drag into one undo transaction', () => {
    const s = useEditor.getState(); const id = s.selectedId!;
    s.checkpoint(); s.editItem(id, { x: 100 }, false); s.editItem(id, { x: 200 }, false);
    expect(useEditor.getState().history).toHaveLength(1);
    s.undo(); expect(useEditor.getState().project.items.find(i => i.id === id)!.x).toBe(480);
  });
  it('limits retained undo history to 40 snapshots', () => {
    for (let i = 0; i < 45; i++) useEditor.getState().setName(`Project ${i}`);
    expect(useEditor.getState().history).toHaveLength(40);
  });
  it('clears the redo branch after a new edit', () => {
    const s = useEditor.getState(); s.addShape('ellipse'); s.undo(); s.addShape('star');
    expect(useEditor.getState().future).toHaveLength(0);
  });
  it('does not delete locked layers', () => {
    const s = useEditor.getState(); const ground = s.project.items.find(i => i.locked)!;
    s.select(ground.id); s.deleteSelected(); expect(useEditor.getState().project.items).toHaveLength(4);
  });
  it('duplicates both artwork and its animation with independent IDs', () => {
    const s = useEditor.getState(); s.applyPreset('wave'); s.duplicateSelected();
    const next = useEditor.getState(); const copy = next.project.items.at(-1)!;
    expect(copy.id).not.toBe(s.selectedId); expect(copy.name).toContain('copy');
    expect(next.project.keyframes[copy.id]).toHaveLength(5);
    expect(next.project.keyframes[copy.id][0].values.x).toBe(504);
    expect(next.project.keyframes[copy.id][0].id).not.toBe(next.project.keyframes[s.selectedId!][0].id);
  });
  it('changes layer stacking order', () => {
    const s = useEditor.getState(); const id = s.project.items[1].id;
    s.moveLayer(id, 'up'); expect(useEditor.getState().project.items[2].id).toBe(id);
  });
  it('retains a deleted project through undo', () => {
    const first = useEditor.getState().project; useEditor.getState().replaceProject(createProject('blank'));
    useEditor.getState().undo(); expect(useEditor.getState().project).toEqual(first);
  });
});
describe('animation editing', () => {
  it('automatically captures a pose on a later frame', () => {
    const s = useEditor.getState(); s.setFrame(12); s.editItem(s.selectedId!, { x: 600 });
    expect(useEditor.getState().project.keyframes[s.selectedId!][0]).toMatchObject({ frame: 0, values: { x: 480 } });
    expect(useEditor.getState().project.keyframes[s.selectedId!][1]).toMatchObject({ frame: 12, values: { x: 600 } });
    expect(useEditor.getState().project.items.at(-1)!.x).toBe(480);
  });
  it('records a posed joint into a keyframe', () => {
    const s = useEditor.getState(); s.applyPreset('wave'); s.setFrame(10); s.editBone(s.selectedId!, { rightHand: 30 });
    const project = useEditor.getState().project;
    expect(project.keyframes[s.selectedId!].find(k => k.frame === 10)!.values.bones!.rightHand).toBe(30);
    expect(sampleItem(project.items.at(-1)!, project.keyframes[s.selectedId!], 10).rig!.bones.find(b => b.id === 'rightHand')!.angle).toBe(30);
  });
  it('updates an existing key instead of creating duplicates', () => {
    const s = useEditor.getState(); s.addKeyframe(); s.addKeyframe(); expect(useEditor.getState().project.keyframes[s.selectedId!]).toHaveLength(1);
  });
  it('can move and remove keys', () => {
    const s = useEditor.getState(); s.addKeyframe(); s.moveKeyframe(s.selectedId!, 0, 5);
    expect(useEditor.getState().project.keyframes[s.selectedId!][0].frame).toBe(5);
    s.removeKeyframe(s.selectedId!, 5); expect(useEditor.getState().project.keyframes[s.selectedId!]).toHaveLength(0);
  });
  it('changes easing on the key before the playhead', () => {
    const s = useEditor.getState(); s.applyPreset('wave'); s.setFrame(10); s.setEasing('hold');
    expect(useEditor.getState().project.keyframes[s.selectedId!][0].easing).toBe('hold');
  });
  it('removes invalid keys when duration is shortened', () => {
    const s = useEditor.getState(); s.applyPreset('wave'); s.resizeProject({ duration: 24 });
    expect(useEditor.getState().project.keyframes[s.selectedId!].every(k => k.frame < 24)).toBe(true);
  });
  it('clamps the playhead to valid frames', () => {
    const s = useEditor.getState(); s.setFrame(-10); expect(useEditor.getState().frame).toBe(0);
    s.setFrame(999); expect(useEditor.getState().frame).toBe(71);
  });
  it('adds a parent-linked custom bone', () => {
    const s = useEditor.getState(); s.selectBone('rightHand'); s.addBone();
    const bones = useEditor.getState().project.items.at(-1)!.rig!.bones;
    expect(bones).toHaveLength(16); expect(bones.at(-1)!.parentId).toBe('rightHand');
  });
  it('falls back to a transform motion for non-character objects', () => {
    const s = useEditor.getState(); const item = createShape('ellipse'); s.addItem(item); s.applyPreset('wave');
    expect(useEditor.getState().project.keyframes[item.id][1].values.y).not.toBe(item.y);
  });
});
