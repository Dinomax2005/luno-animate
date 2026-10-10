import { forwardKinematics, radians } from './rig';
import { sampleItem } from './animation';
import type { Point, Project, SceneItem } from './types';
export type Matrix = [number, number, number, number, number, number];
export const identity = (): Matrix => [1, 0, 0, 1, 0, 0];
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
export function transformPoint(m: Matrix, p: Point): Point { return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }; }
export function inverse(m: Matrix): Matrix {
  const d = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(d) < 1e-10) return identity();
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
}
export function localMatrix(i: Pick<SceneItem, 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY'>): Matrix {
  const r = radians(i.rotation), c = Math.cos(r), s = Math.sin(r);
  return [c * i.scaleX, s * i.scaleX, -s * i.scaleY, c * i.scaleY, i.x, i.y];
}
export const parentOf = (item: SceneItem) => item.parentId ?? item.attachment?.characterId ?? null;
export function isLayerLocked(items: SceneItem[], id: string | null) {
  const map = new Map(items.map(i => [i.id, i])), seen = new Set<string>();
  let item = id ? map.get(id) : undefined;
  while (item) { if (item.locked || seen.has(item.id)) return true; seen.add(item.id); const parent = parentOf(item); item = parent ? map.get(parent) : undefined; }
  return false;
}
/** Hierarchies paint as coherent stacks; child ordering is the document's layer order. */
export function orderedItems(items: SceneItem[], reverse = false): SceneItem[] {
  const result: SceneItem[] = [], visited = new Set<string>(), children = new Map<string | null, SceneItem[]>();
  for (const item of items) { const parent = parentOf(item); const siblings = children.get(parent) ?? []; siblings.push(item); children.set(parent, siblings); }
  const visit = (item: SceneItem) => { if (visited.has(item.id)) return; visited.add(item.id); result.push(item); const list = children.get(item.id) ?? []; for (const child of reverse ? [...list].reverse() : list) visit(child); };
  const roots = children.get(null) ?? []; for (const root of reverse ? [...roots].reverse() : roots) visit(root);
  return result;
}
export interface RenderNode { item: SceneItem; matrix: Matrix; parentMatrix: Matrix; opacity: number; visible: boolean; locked: boolean }
export function sceneNodes(project: Project, frame: number): RenderNode[] {
  const sampled = new Map(project.items.map(i => [i.id, sampleItem(i, project.keyframes[i.id] ?? [], frame)]));
  const cache = new Map<string, RenderNode>(); const resolving = new Set<string>();
  const resolve = (item: SceneItem): RenderNode => {
    const known = cache.get(item.id); if (known) return known;
    if (resolving.has(item.id)) throw new Error('The layer hierarchy contains a cycle.');
    resolving.add(item.id);
    let parentMatrix = identity(), opacity = item.opacity, visible = item.visible, locked = item.locked;
    const parentId = item.parentId ?? item.attachment?.characterId;
    const parent = parentId ? sampled.get(parentId) : undefined;
    if (parent) {
      const p = resolve(parent); parentMatrix = p.matrix; opacity *= p.opacity; visible = visible && p.visible; locked = locked || p.locked;
      if (item.attachment && parent.rig) {
        const bone = forwardKinematics(parent.rig).find(b => b.id === item.attachment!.boneId);
        if (bone) {
          const anchor = item.attachment.anchor;
          parentMatrix = multiply(parentMatrix, localMatrix({ x: bone.start.x + (bone.end.x - bone.start.x) * anchor, y: bone.start.y + (bone.end.y - bone.start.y) * anchor, rotation: bone.worldAngle, scaleX: 1, scaleY: 1 }));
        }
      }
    }
    const node = { item, matrix: multiply(parentMatrix, localMatrix(item)), parentMatrix, opacity, visible, locked };
    cache.set(item.id, node); resolving.delete(item.id); return node;
  };
  return orderedItems(project.items).map(i => resolve(sampled.get(i.id)!));
}
export const matrixString = (m: Matrix) => `matrix(${m.join(' ')})`;
export function itemBounds(item: SceneItem) {
  return item.type === 'character' ? { x: -126, y: -152, w: 264, h: 370 } : { x: -item.width / 2, y: -item.height / 2, w: item.width, h: item.height };
}
