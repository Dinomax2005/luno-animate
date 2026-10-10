import type { Bone, Point, Rig, WorldBone } from './types';

export const radians = (degrees: number) => degrees * Math.PI / 180;
export const degrees = (rad: number) => rad * 180 / Math.PI;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function createMiloRig(): Rig {
  const bone = (id: string, name: string, parentId: string | null, length: number, angle: number): Bone => ({ id, name, parentId, length, angle });
  return {
    origin: { x: 0, y: 68 },
    bones: [
      bone('root', 'Root', null, 0, 0),
      bone('spine', 'Body', 'root', 82, -90),
      bone('head', 'Head', 'spine', 60, 0),
      bone('leftShoulder', 'Left shoulder', 'spine', 46, -90),
      bone('leftArm', 'Left upper arm', 'leftShoulder', 65, -68),
      bone('leftHand', 'Left forearm', 'leftArm', 57, -18),
      bone('rightShoulder', 'Right shoulder', 'spine', 46, 90),
      bone('rightArm', 'Right upper arm', 'rightShoulder', 65, -38),
      bone('rightHand', 'Right forearm', 'rightArm', 57, -78),
      bone('leftHip', 'Left hip', 'root', 25, 180),
      bone('leftLeg', 'Left thigh', 'leftHip', 70, -85),
      bone('leftFoot', 'Left shin', 'leftLeg', 65, -10),
      bone('rightHip', 'Right hip', 'root', 25, 0),
      bone('rightLeg', 'Right thigh', 'rightHip', 70, 82),
      bone('rightFoot', 'Right shin', 'rightLeg', 65, 12),
    ],
  };
}

/** Forward kinematics; hierarchy order is intentionally not significant. */
export function forwardKinematics(rig: Rig, pose: Record<string, number> = {}): WorldBone[] {
  const computed = new Map<string, WorldBone>();
  const visiting = new Set<string>();
  const byId = new Map(rig.bones.map(b => [b.id, b]));
  const resolve = (bone: Bone): WorldBone => {
    if (computed.has(bone.id)) return computed.get(bone.id)!;
    if (visiting.has(bone.id)) throw new Error('Bone hierarchy contains a cycle.');
    visiting.add(bone.id);
    const parentBone = bone.parentId ? byId.get(bone.parentId) : undefined;
    const parent = parentBone ? resolve(parentBone) : undefined;
    const start = parent ? parent.end : rig.origin;
    const angle = Object.hasOwn(pose, bone.id) ? pose[bone.id] : bone.angle;
    const worldAngle = (parent?.worldAngle ?? 0) + angle;
    const end = {
      x: start.x + Math.cos(radians(worldAngle)) * bone.length,
      y: start.y + Math.sin(radians(worldAngle)) * bone.length,
    };
    const result = { ...bone, angle, start, end, worldAngle };
    visiting.delete(bone.id);
    computed.set(bone.id, result);
    return result;
  };
  return rig.bones.map(resolve);
}

export function solveTwoBoneIK(origin: Point, target: Point, upper: number, lower: number, bend = 1) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = clamp(Math.hypot(dx, dy), Math.abs(upper - lower) + 0.0001, upper + lower - 0.0001);
  const offset = Math.acos(clamp((upper * upper + distance * distance - lower * lower) / (2 * upper * distance), -1, 1));
  const elbow = Math.PI - Math.acos(clamp((upper * upper + lower * lower - distance * distance) / (2 * upper * lower), -1, 1));
  return { upperAngle: degrees(Math.atan2(dy, dx) - bend * offset), lowerAngle: degrees(bend * elbow) };
}

/** Dragging a hand/foot solves the whole limb; other joints use direct rotation. */
export function poseJoint(rig: Rig, boneId: string, target: Point, useIK = true): Record<string, number> {
  const world = forwardKinematics(rig);
  const bone = world.find(b => b.id === boneId);
  if (!bone || bone.length === 0) return {};
  const parent = world.find(b => b.id === bone.parentId);
  if (useIK && parent && parent.length > 0 && /Hand|Foot/.test(boneId)) {
    const grandparent = world.find(b => b.id === parent.parentId);
    const bend = bone.angle >= 0 ? 1 : -1;
    const result = solveTwoBoneIK(parent.start, target, parent.length, bone.length, bend);
    return { [parent.id]: result.upperAngle - (grandparent?.worldAngle ?? 0), [bone.id]: result.lowerAngle };
  }
  return { [boneId]: degrees(Math.atan2(target.y - bone.start.y, target.x - bone.start.x)) - (parent?.worldAngle ?? 0) };
}
