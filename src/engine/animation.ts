import type { Camera, DrawingCel, Easing, Keyframe, Pose, Preset, Project, SceneItem } from './types';
import { uid } from './project';

export const ease = (t: number, easing: Easing, bezier: [number, number, number, number] = [0.42, 0, 0.58, 1]): number => {
  if (t <= 0) return 0; if (t >= 1) return easing === 'hold' ? 0 : 1;
  if (easing === 'hold') return 0;
  if (easing === 'ease-in-out') return t * t * (3 - 2 * t);
  if (easing === 'ease-out') return 1 - (1 - t) ** 3;
  if (easing === 'ease-in') return t ** 3;
  if (easing === 'back-out') return 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
  if (easing === 'bounce-out') {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t - 1.5 / d) ** 2 + 0.75;
    if (t < 2.5 / d) return n * (t - 2.25 / d) ** 2 + 0.9375;
    return n * (t - 2.625 / d) ** 2 + 0.984375;
  }
  if (easing === 'elastic-out') return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
  if (easing === 'bezier') {
    const [x1, y1, x2, y2] = bezier;
    const curve = (u: number, a: number, b: number) => 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u * u * b + u ** 3;
    let lo = 0, hi = 1;
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (curve(mid, x1, x2) < t) lo = mid; else hi = mid; }
    return curve((lo + hi) / 2, y1, y2);
  }
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
  const t = ease((frame - before.frame) / (after.frame - before.frame), before.easing, before.bezier);
  const delta = angular ? ((b - a + 540) % 360 + 360) % 360 - 180 : b - a;
  return a + delta * t;
}

export const effectDefaults = { blur: 0, brightness: 1, saturation: 1 } as const;
export function sampleItem(item: SceneItem, keys: Keyframe[], frame: number): SceneItem {
  const sampled = { ...item };
  for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const) {
    const value = sampleChannel(keys, frame, p => p[key], item[key], key === 'rotation');
    sampled[key] = key === 'opacity' ? Math.max(0, Math.min(1, value)) : key === 'scaleX' || key === 'scaleY' ? Math.max(0.01, Math.min(100, value)) : value;
  }
  for (const key of ['blur', 'brightness', 'saturation'] as const) sampled[key] = Math.max(0, Math.min(key === 'blur' ? 50 : 3, sampleChannel(keys, frame, p => p[key], item[key] ?? effectDefaults[key])));
  if (item.rig) {
    sampled.rig = { ...item.rig, bones: item.rig.bones.map(b => ({
      ...b,
      angle: Math.max(b.minAngle ?? -Infinity, Math.min(b.maxAngle ?? Infinity, sampleChannel(keys, frame, p => p.bones?.[b.id], b.angle, true))),
    })) };
  }
  return sampled;
}

export function capturePose(item: SceneItem): Pose {
  return {
    x: item.x, y: item.y, rotation: item.rotation, scaleX: item.scaleX, scaleY: item.scaleY, opacity: item.opacity, blur: item.blur ?? 0, brightness: item.brightness ?? 1, saturation: item.saturation ?? 1,
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
    } else if (preset === 'float') {
      values.y = item.y - Math.sin(phase) * 24; values.rotation = item.rotation + Math.sin(phase) * 6;
    } else if (preset === 'pulse') {
      values.scaleX = item.scaleX * (1 + Math.sin(phase) * 0.12); values.scaleY = item.scaleY * (1 + Math.sin(phase) * 0.12);
    } else if (preset === 'fade') {
      values.opacity = index === 0 || index === count - 1 ? 0 : item.opacity;
    } else if (preset === 'slide') {
      values.x = item.x + (index === 0 ? -200 : 0); values.opacity = index === 0 ? 0 : item.opacity;
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

export function sampleCamera(camera: Camera, frame: number): Camera {
  return { ...camera, x: sampleChannel(camera.keys, frame, p => p.x, camera.x), y: sampleChannel(camera.keys, frame, p => p.y, camera.y),
    zoom: Math.max(0.05, Math.min(20, sampleChannel(camera.keys, frame, p => p.scaleX, camera.zoom))), rotation: sampleChannel(camera.keys, frame, p => p.rotation, camera.rotation, true) };
}
export function sampleCel(item: SceneItem, frame: number): DrawingCel | undefined {
  const cels = [...(item.cels ?? [])].sort((a, b) => a.frame - b.frame);
  return item.holdCels === false ? cels.find(c => c.frame === frame) : [...cels].reverse().find(c => c.frame <= frame);
}
