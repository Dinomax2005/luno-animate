import type { Layer, Scene } from "./model";
import { bonesAt, point, worldMatrix, type Matrix } from "./motion";
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function localBounds(l: Layer, frame: number): Bounds {
  if (l.kind === "rig") {
    const bones = bonesAt(l, frame),
      xs = bones.flatMap((b) => [b.start.x, b.end.x]),
      ys = bones.flatMap((b) => [b.start.y, b.end.y]);
    const x = Math.min(...xs) - 30,
      y = Math.min(...ys) - 30;
    return {
      x,
      y,
      width: Math.max(...xs) - x + 30,
      height: Math.max(...ys) - y + 30,
    };
  }
  return {
    x: -l.width / 2,
    y: -l.height / 2,
    width: l.width,
    height: l.height,
  };
}
export function transformedBounds(b: Bounds, m: Matrix): Bounds {
  const ps = [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x, y: b.y + b.height },
      { x: b.x + b.width, y: b.y + b.height },
    ].map((p) => point(m, p)),
    x = Math.min(...ps.map((p) => p.x)),
    y = Math.min(...ps.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...ps.map((p) => p.x)) - x,
    height: Math.max(...ps.map((p) => p.y)) - y,
  };
}
export function worldBounds(l: Layer, scene: Scene, frame: number): Bounds {
  return transformedBounds(
    localBounds(l, frame),
    worldMatrix(l, scene.layers, frame),
  );
}
export const contains = (b: Bounds, p: { x: number; y: number }) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
