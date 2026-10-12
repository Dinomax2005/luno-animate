import type { Bone, Cel, Channel, Ease, Key, Layer, Transform } from "./model";
export const clamp = (v: number, a: number, b: number) =>
  Math.min(b, Math.max(a, v));
export type Matrix = [number, number, number, number, number, number];
export const unit: Matrix = [1, 0, 0, 1, 0, 0];
export function matrix(t: Transform): Matrix {
  const r = (t.rotation * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  return [c * t.scaleX, s * t.scaleX, -s * t.scaleY, c * t.scaleY, t.x, t.y];
}
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export function invert(m: Matrix): Matrix {
  const d = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(d) < 1e-12) throw new Error("Non-invertible layer.");
  return [
    m[3] / d,
    -m[1] / d,
    -m[2] / d,
    m[0] / d,
    (m[2] * m[5] - m[3] * m[4]) / d,
    (m[1] * m[4] - m[0] * m[5]) / d,
  ];
}
export const point = (m: Matrix, p: { x: number; y: number }) => ({
  x: m[0] * p.x + m[2] * p.y + m[4],
  y: m[1] * p.x + m[3] * p.y + m[5],
});
function cubic(a: number, b: number, t: number) {
  return 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
}
export function ease(kind: Ease, t: number, curve?: Key["curve"]): number {
  t = clamp(t, 0, 1);
  if (kind === "hold") return t === 1 ? 1 : 0;
  if (kind === "smooth") return t * t * (3 - 2 * t);
  if (kind === "in") return t * t;
  if (kind === "out") return 1 - (1 - t) * (1 - t);
  if (kind === "bezier" && curve) {
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 20; i++) {
      const m = (lo + hi) / 2;
      if (cubic(curve[0], curve[2], m) < t) lo = m;
      else hi = m;
    }
    return cubic(curve[1], curve[3], (lo + hi) / 2);
  }
  return t;
}
export function channelAt(
  base: number,
  keys: Key[],
  channel: Channel,
  frame: number,
): number {
  const ks = keys
    .filter((k) => k.values[channel] !== undefined)
    .sort((a, b) => a.frame - b.frame);
  if (!ks.length) return base;
  if (frame <= ks[0].frame) {
    const first = ks[0];
    return first.frame === 0
      ? first.values[channel]!
      : base +
          (first.values[channel]! - base) *
            ease(first.easing, Math.max(0, frame) / first.frame, first.curve);
  }
  const a = ks.filter((k) => k.frame <= frame).at(-1)!,
    b = ks.find((k) => k.frame > frame);
  if (!b) return a.values[channel]!;
  return (
    a.values[channel]! +
    (b.values[channel]! - a.values[channel]!) *
      ease(a.easing, (frame - a.frame) / (b.frame - a.frame), a.curve)
  );
}
export function pose(layer: Layer, frame: number): Transform {
  const result = { ...layer.transform };
  for (const c of [
    "x",
    "y",
    "scaleX",
    "scaleY",
    "rotation",
    "opacity",
  ] as const)
    result[c] = channelAt(result[c], layer.keys, c, frame);
  result.opacity = clamp(result.opacity, 0, 1);
  result.scaleX = clamp(result.scaleX, 0.01, 100);
  result.scaleY = clamp(result.scaleY, 0.01, 100);
  return result;
}
export function celAt(layer: Layer, frame: number): Cel | undefined {
  const cels = layer.cels ?? [];
  return layer.held === false
    ? cels.find((c) => c.frame === frame)
    : cels.filter((c) => c.frame <= frame).sort((a, b) => b.frame - a.frame)[0];
}
export interface WorldBone {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  angle: number;
}
export function bonesAt(layer: Layer, frame: number): WorldBone[] {
  const result = new Map<string, WorldBone>(),
    bones = layer.bones ?? [];
  const visit = (b: Bone): WorldBone => {
    const known = result.get(b.id);
    if (known) return known;
    const parent = b.parent
        ? visit(bones.find((p) => p.id === b.parent)!)
        : null,
      start = parent?.end ?? { x: 0, y: 0 },
      angle =
        (parent?.angle ?? 0) +
        channelAt(b.angle, layer.keys, `bone:${b.id}`, frame),
      rad = (angle * Math.PI) / 180,
      value = {
        id: b.id,
        start,
        end: {
          x: start.x + Math.cos(rad) * b.length,
          y: start.y + Math.sin(rad) * b.length,
        },
        angle,
      };
    result.set(b.id, value);
    return value;
  };
  return bones.map(visit);
}
export function worldMatrix(
  layer: Layer,
  layers: Layer[],
  frame: number,
  visited = new Set<string>(),
): Matrix {
  if (visited.has(layer.id)) throw new Error("Cyclic layer.");
  visited.add(layer.id);
  let parent = unit;
  if (layer.parent) {
    const p = layers.find((l) => l.id === layer.parent);
    if (p) parent = worldMatrix(p, layers, frame, visited);
  } else if (layer.bind) {
    const rig = layers.find((l) => l.id === layer.bind!.rig),
      bone = rig && bonesAt(rig, frame).find((b) => b.id === layer.bind!.bone);
    if (rig && bone)
      parent = multiply(
        worldMatrix(rig, layers, frame, visited),
        matrix({
          x: bone.end.x,
          y: bone.end.y,
          scaleX: 1,
          scaleY: 1,
          rotation: bone.angle,
          opacity: 1,
        }),
      );
  }
  return multiply(parent, matrix(pose(layer, frame)));
}
export function locked(layer: Layer, layers: Layer[]): boolean {
  let current: Layer | undefined = layer;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    if (current.locked) return true;
    seen.add(current.id);
    current = current.parent
      ? layers.find((l) => l.id === current!.parent)
      : undefined;
  }
  return false;
}
export function solveIK(
  layer: Layer,
  boneId: string,
  target: { x: number; y: number },
  frame: number,
): Record<string, number> {
  const copy = {
    ...layer,
    bones: layer.bones?.map((b) => ({
      ...b,
      angle: channelAt(b.angle, layer.keys, `bone:${b.id}`, frame),
    })),
    keys: [],
  };
  const angles: Record<string, number> = {};
  let chain = copy.bones?.find((b) => b.id === boneId);
  const ids: string[] = [];
  while (chain) {
    ids.push(chain.id);
    chain = chain.parent
      ? copy.bones!.find((b) => b.id === chain!.parent)
      : undefined;
  }
  for (let pass = 0; pass < 12; pass++)
    for (const id of ids) {
      const world = bonesAt(copy, 0),
        root = world.find((b) => b.id === id)!,
        tip = world.find((b) => b.id === boneId)!;
      const delta =
          ((Math.atan2(target.y - root.start.y, target.x - root.start.x) -
            Math.atan2(tip.end.y - root.start.y, tip.end.x - root.start.x)) *
            180) /
          Math.PI,
        b = copy.bones!.find((b) => b.id === id)!;
      b.angle = clamp(b.angle + delta, b.min, b.max);
      angles[id] = b.angle;
    }
  return angles;
}
