import { describe, expect, it } from 'vitest';
import { adaptCanvas, createCharacter, createItem, createProject, createShape, parseProject, serializeProject } from '../engine/project';
import { capturePose, createPreset, ease, sampleItem, sampleProject } from '../engine/animation';
import { createMiloRig, forwardKinematics, poseJoint, radians, solveTwoBoneIK } from '../engine/rig';
import { safeName } from '../engine/files';
import type { Keyframe, Rig } from '../engine/types';

const key = (frame: number, x: number, easing: Keyframe['easing'] = 'linear'): Keyframe => ({ id: String(frame), frame, easing, values: { x } });
describe('forward kinematics', () => {
  it('keeps all connected bones at their defined lengths', () => {
    const world = forwardKinematics(createMiloRig());
    expect(world).toHaveLength(15);
    for (const b of world) {
      expect(Math.hypot(b.end.x - b.start.x, b.end.y - b.start.y)).toBeCloseTo(b.length);
      const parent = world.find(p => p.id === b.parentId);
      if (parent) expect(b.start).toEqual(parent.end);
    }
  });
  it('does not depend on the order of bones', () => {
    const rig = createMiloRig();
    const first = forwardKinematics(rig).find(b => b.id === 'rightHand');
    rig.bones.reverse();
    expect(forwardKinematics(rig).find(b => b.id === 'rightHand')!.end).toEqual(first!.end);
  });
  it('rotates all children when a parent rotates', () => {
    const rig: Rig = { origin: { x: 10, y: 5 }, bones: [ { id: 'a', name: 'A', parentId: null, length: 10, angle: 0 }, { id: 'b', name: 'B', parentId: 'a', length: 5, angle: 0 } ] };
    const world = forwardKinematics(rig, { a: 90 });
    expect(world[1].end.x).toBeCloseTo(10); expect(world[1].end.y).toBeCloseTo(20);
  });
  it('rejects cyclic hierarchies', () => {
    const rig = createMiloRig(); rig.bones[0].parentId = 'head';
    expect(() => forwardKinematics(rig)).toThrow('cycle');
  });
  it('does not read inherited pose properties', () => {
    const rig: Rig = { origin: { x: 0, y: 0 }, bones: [{ id: 'toString', name: 'Bone', parentId: null, length: 10, angle: 0 }] };
    expect(forwardKinematics(rig)[0].end.x).toBeCloseTo(10);
  });
});
describe('inverse kinematics', () => {
  it.each([1, -1])('reaches a target with bend direction %s', bend => {
    const origin = { x: 10, y: 20 }, target = { x: 80, y: 55 };
    const solution = solveTwoBoneIK(origin, target, 65, 57, bend);
    const x = origin.x + 65 * Math.cos(radians(solution.upperAngle)) + 57 * Math.cos(radians(solution.upperAngle + solution.lowerAngle));
    const y = origin.y + 65 * Math.sin(radians(solution.upperAngle)) + 57 * Math.sin(radians(solution.upperAngle + solution.lowerAngle));
    expect(x).toBeCloseTo(target.x); expect(y).toBeCloseTo(target.y);
  });
  it('clamps unreachable targets without stretching', () => {
    const result = solveTwoBoneIK({ x: 0, y: 0 }, { x: 1000, y: 0 }, 40, 30);
    expect(Number.isFinite(result.upperAngle)).toBe(true);
    const x = 40 * Math.cos(radians(result.upperAngle)) + 30 * Math.cos(radians(result.upperAngle + result.lowerAngle));
    expect(x).toBeCloseTo(70, 2);
  });
  it('handles a target at the origin without NaN', () => {
    const result = solveTwoBoneIK({ x: 0, y: 0 }, { x: 0, y: 0 }, 40, 30);
    expect(Number.isFinite(result.upperAngle) && Number.isFinite(result.lowerAngle)).toBe(true);
  });
  it('updates two linked bones when a hand is posed', () => {
    const rig = createMiloRig(); const target = { x: 100, y: -60 };
    const angles = poseJoint(rig, 'rightHand', target);
    expect(Object.keys(angles)).toEqual(['rightArm', 'rightHand']);
    const end = forwardKinematics(rig, angles).find(b => b.id === 'rightHand')!.end;
    expect(end.x).toBeCloseTo(target.x); expect(end.y).toBeCloseTo(target.y);
  });
  it('supports direct single-joint rotation when IK is disabled', () => {
    expect(Object.keys(poseJoint(createMiloRig(), 'rightHand', { x: 100, y: -60 }, false))).toEqual(['rightHand']);
  });
});
describe('animation sampling', () => {
  it('interpolates position between keys', () => {
    expect(sampleItem(createShape('ellipse'), [key(0, 0), key(10, 100)], 5).x).toBe(50);
  });
  it('clamps before and after the first and last keys', () => {
    const item = createShape('ellipse'); const keys = [key(5, 10), key(10, 100)];
    expect(sampleItem(item, keys, 0).x).toBe(10); expect(sampleItem(item, keys, 20).x).toBe(100);
  });
  it('samples sparse channels independently', () => {
    const keys: Keyframe[] = [key(0, 0), { id: 'y', frame: 5, easing: 'linear', values: { y: 90 } }, key(10, 100)];
    const sampled = sampleItem(createShape('ellipse'), keys, 5);
    expect(sampled.x).toBe(50); expect(sampled.y).toBe(90);
  });
  it('holds a pose until the next key', () => {
    const keys = [key(0, 10, 'hold'), key(10, 100)]; const item = createShape('ellipse');
    expect(sampleItem(item, keys, 9).x).toBe(10); expect(sampleItem(item, keys, 10).x).toBe(100);
  });
  it('uses the short angular path across 180 degrees', () => {
    const keys: Keyframe[] = [{ ...key(0, 0), values: { rotation: 170 } }, { ...key(10, 0), values: { rotation: -170 } }];
    expect(sampleItem(createShape('ellipse'), keys, 5).rotation).toBe(180);
  });
  it('interpolates individual bone angles without mutating the rest rig', () => {
    const item = createCharacter(); const original = item.rig!.bones.find(b => b.id === 'head')!.angle;
    const keys: Keyframe[] = [{ ...key(0, 0), values: { bones: { head: 0 } } }, { ...key(10, 0), values: { bones: { head: 40 } } }];
    expect(sampleItem(item, keys, 5).rig!.bones.find(b => b.id === 'head')!.angle).toBe(20);
    expect(item.rig!.bones.find(b => b.id === 'head')!.angle).toBe(original);
  });
  it.each(['wave', 'walk', 'bounce', 'spin'] as const)('creates a valid %s motion preset', preset => {
    const keys = createPreset(createCharacter(), preset, 72);
    expect(keys).toHaveLength(5); expect(keys[0].frame).toBe(0); expect(keys.at(-1)!.frame).toBe(71);
    expect(keys.every(k => Object.values(k.values.bones ?? {}).every(Number.isFinite))).toBe(true);
  });
  it.each([2, 3, 4])('makes unique keyframes for a short %s-frame project', duration => {
    const item = createCharacter(); const keys = createPreset(item, 'wave', duration);
    expect(new Set(keys.map(k => k.frame)).size).toBe(keys.length);
    expect(keys.length).toBe(duration);
  });
  it('captures complete poses and filters hidden layers', () => {
    const item = createCharacter(); expect(Object.keys(capturePose(item).bones!)).toHaveLength(15);
    const p = createProject(); p.items[0].visible = false;
    expect(sampleProject(p, 0)).toHaveLength(3);
  });
  it('has smooth easing endpoints', () => {
    expect(ease(0, 'ease-in-out')).toBe(0); expect(ease(1, 'ease-in-out')).toBe(1); expect(ease(.5, 'ease-in-out')).toBe(.5);
    expect(ease(.5, 'ease-out')).toBe(.875);
  });
});
describe('project format and import boundaries', () => {
  it('resizes a canvas without breaking the composition or rig alignment', () => {
    const project = createProject(); const character = project.items.at(-1)!;
    project.keyframes[character.id] = createPreset(character, 'wave', project.duration);
    const portrait = adaptCanvas(project, 1080, 1920);
    const resized = portrait.items.at(-1)!;
    const ground = portrait.items[0];
    const oldDistance = project.items[0].y - character.y;
    expect(ground.y - resized.y).toBeCloseTo(oldDistance * 1.125);
    expect(resized.scaleX).toBe(resized.scaleY);
    expect(portrait.keyframes[character.id][0].values.x).toBeCloseTo(resized.x);
    expect(project.width).toBe(960);
  });
  it('round-trips projects without changing content', () => {
    const p = createProject(); const item = p.items.at(-1)!; p.keyframes[item.id] = createPreset(item, 'wave', p.duration);
    expect(parseProject(serializeProject(p))).toEqual(p);
  });
  it('rejects unknown versions', () => { const p = { ...createProject(), version: 99 }; expect(() => parseProject(JSON.stringify(p))).toThrow('supported'); });
  it('rejects duplicate layer IDs', () => { const p = createProject(); p.items.push(p.items[0]); expect(() => parseProject(serializeProject(p))).toThrow('duplicate'); });
  it('rejects cyclic rigs', () => { const p = createProject(); p.items.at(-1)!.rig!.bones[0].parentId = 'head'; expect(() => parseProject(serializeProject(p))).toThrow('hierarchy'); });
  it('rejects missing bone parents', () => { const p = createProject(); p.items.at(-1)!.rig!.bones[0].parentId = 'missing'; expect(() => parseProject(serializeProject(p))).toThrow('hierarchy'); });
  it('rejects keys beyond the duration', () => { const p = createProject(); p.keyframes[p.items[0].id] = [key(100, 0)]; expect(() => parseProject(serializeProject(p))).toThrow('keyframes'); });
  it('rejects remote or executable image content', () => { const p = createProject('blank'); p.items.push(createItem('image', { imageData: 'https://example.com/tracking.png' })); expect(() => parseProject(serializeProject(p))).toThrow('supported'); });
  it('rejects unreasonable canvas dimensions', () => { const p = { ...createProject(), width: 999999 }; expect(() => parseProject(JSON.stringify(p))).toThrow('supported'); });
  it('rejects reserved IDs', () => { const p = createProject(); p.items[0].id = '__proto__'; expect(() => parseProject(serializeProject(p))).toThrow('supported'); });
  it('sanitizes file names without creating empty names', () => { expect(safeName('../evil/<project>:!')).toBe('evilproject'); expect(safeName('💚')).toBe('Luno animation'); });
});
