import type { Easing, Keyframe, Pose, Preset, Project, SceneItem } from './types';
import { uid } from './project';

export const ease = (t: number, easing: Easing): number => {
  if (easing === 'hold') return 0;
  if (easing === 'ease-in-out') return t * t * (3 - 2 * t);
  if (easing === 'ease-out') return 1 - (1 - t) ** 3;
  return t;
};

function sampleChannel(keys: Keyframe[], frame: number, get: (pose: Pose) => number | undefined, base: number, angular = false) {
  const channel = keys.filter(k => get(k.values) !== undefined).sort((a, b) => a.frame - b.frame);
  if (!channel.length) return base;
  if (frame <= channel[0].frame) return get(channel[0].values)!;
  const after = channel.find(k => k.frame > frame);
  if (!after) return get(channel[channel.length - 1].values)!;
  const before = channel[channel.indexOf(after) - 1];
  const a = get(before.values)!;
  const b = get(after.values)!;
  const t = ease((frame - before.frame) / (after.frame - before.frame), before.easing);
  const delta = angular ? ((b - a + 540) % 360 + 360) % 360 - 180 : b - a;
  return a + delta * t;
}

export function sampleItem(item: SceneItem, keys: Keyframe[], frame: number): SceneItem {
  const sampled = { ...item };
  for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const) {
    sampled[key] = sampleChannel(keys, frame, p => p[key], item[key], key === 'rotation');
  }
  if (item.rig) {
    sampled.rig = { ...item.rig, bones: item.rig.bones.map(b => ({
      ...b,
      angle: sampleChannel(keys, frame, p => p.bones?.[b.id], b.angle, true),
    })) };
  }
  return sampled;
}

export function capturePose(item: SceneItem): Pose {
  return {
    x: item.x, y: item.y, rotation: item.rotation, scaleX: item.scaleX, scaleY: item.scaleY, opacity: item.opacity,
    ...(item.rig ? { bones: Object.fromEntries(item.rig.bones.map(b => [b.id, b.angle])) } : {}),
  };
}

export function createPreset(item: SceneItem, preset: Preset, duration: number): Keyframe[] {
  const base = capturePose(item);
  const count = Math.min(5, duration);
  const frames = Array.from({ length: count }, (_, index) => Math.round(index / (count - 1) * (duration - 1)));
  const keys = frames.map((frame, index) => {
    const phase = index / (count - 1) * Math.PI * 2;
    let values: Pose = { ...base, bones: base.bones ? { ...base.bones } : undefined };
    if (preset === 'wave' && item.rig) {
      values.bones = { ...base.bones, rightArm: -55 + Math.sin(phase) * 9, rightHand: -70 + Math.sin(phase + Math.PI / 2) * 24, head: Math.sin(phase) * 5 };
      values.y = item.y + Math.sin(phase) * 3;
    } else if (preset === 'bounce' || (preset === 'wave' && !item.rig)) {
      values = { ...values, y: item.y - Math.abs(Math.sin(phase)) * 75, scaleY: item.scaleY * (index % 2 === 0 ? 0.95 : 1.04), scaleX: item.scaleX * (index % 2 === 0 ? 1.04 : 0.97) };
    } else if (preset === 'walk' && item.rig) {
      values.bones = { ...base.bones, leftLeg: -90 + Math.sin(phase) * 24, rightLeg: 90 - Math.sin(phase) * 24, leftFoot: Math.max(0, Math.sin(phase)) * -25, rightFoot: Math.max(0, -Math.sin(phase)) * 25, leftArm: -65 - Math.sin(phase) * 20, rightArm: 65 + Math.sin(phase) * 20, rightHand: 12 };
      values.y = item.y - Math.abs(Math.sin(phase)) * 8;
    } else if (preset === 'spin') {
      values.rotation = item.rotation + index / (count - 1) * 360;
    } else {
      values.x = item.x + Math.sin(phase) * 80;
    }
    return { id: uid(), frame, easing: 'ease-in-out' as Easing, values };
  });
  return keys;
}

export function sampleProject(project: Project, frame: number) {
  return project.items.filter(item => item.visible).map(item => sampleItem(item, project.keyframes[item.id] ?? [], frame));
}
