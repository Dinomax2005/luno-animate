import { z } from 'zod';
import { createMiloRig } from './rig';
import type { Project, SceneItem, ShapeKind } from './types';

export const uid = () => globalThis.crypto?.randomUUID?.() ?? `luno-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createItem(type: SceneItem['type'], options: Partial<SceneItem> = {}): SceneItem {
  return {
    id: uid(), name: type === 'character' ? 'Milo' : 'Shape', type,
    x: 480, y: 285, width: 150, height: 150, scaleX: 1, scaleY: 1, rotation: 0,
    opacity: 1, visible: true, locked: false, fill: '#b7a5e8', stroke: 'none', strokeWidth: 3,
    ...options,
  };
}
export function createCharacter(x = 480, y = 282): SceneItem {
  return createItem('character', { name: 'Milo', x, y, width: 245, height: 350, fill: '#c5b1ed', rig: createMiloRig() });
}
export function createShape(shape: ShapeKind, x = 480, y = 300): SceneItem {
  const colors = { rectangle: '#c5b1ed', ellipse: '#f0b88e', star: '#e9c669', sparkle: '#e9c669', ground: '#e9e7dd' };
  return createItem('shape', { shape, name: shape[0].toUpperCase() + shape.slice(1), x, y, width: 100, height: 100, fill: colors[shape] });
}
export function createProject(template: 'character' | 'shapes' | 'blank' = 'character'): Project {
  const project: Project = {
    version: 1, id: uid(), name: 'A little hello', width: 960, height: 600, fps: 24, duration: 72,
    background: '#fffdf7', items: [], keyframes: {},
  };
  if (template === 'character') {
    const ground = createShape('ground', 480, 493);
    ground.name = 'Ground'; ground.width = 210; ground.height = 26; ground.locked = true;
    const orbit = createShape('ellipse', 695, 203);
    orbit.name = 'Little orbit'; orbit.width = 46; orbit.height = 46; orbit.fill = '#f0b793';
    const sparkle = createShape('sparkle', 296, 247);
    sparkle.name = 'Sparkle'; sparkle.width = 42; sparkle.height = 42; sparkle.fill = '#dac56e';
    const milo = createCharacter();
    project.items = [ground, sparkle, orbit, milo];
  }
  if (template === 'shapes') {
    const ball = createShape('ellipse'); ball.name = 'Bouncy ball'; ball.fill = '#c5b1ed';
    const ground = createShape('ground', 480, 420); ground.width = 280; ground.height = 25; ground.locked = true;
    project.items = [ground, ball];
  }
  return project;
}

const finite = z.number().finite();
const point = z.object({ x: finite.min(-100000).max(100000), y: finite.min(-100000).max(100000) });
const id = z.string().min(1).max(100).refine(v => !['__proto__', 'prototype', 'constructor', 'toString', 'valueOf'].includes(v));
const color = z.string().regex(/^(#[0-9a-fA-F]{3,8}|none|transparent)$/);
const bone = z.object({ id, name: z.string().max(100), parentId: id.nullable(), length: finite.min(0).max(10000), angle: finite.min(-100000).max(100000) });
const pose = z.object({
  x: finite.min(-100000).max(100000).optional(), y: finite.min(-100000).max(100000).optional(), scaleX: finite.min(0.01).max(100).optional(), scaleY: finite.min(0.01).max(100).optional(),
  rotation: finite.optional(), opacity: finite.min(0).max(1).optional(), bones: z.record(id, finite.min(-100000).max(100000)).optional(),
});
export const projectSchema = z.object({
  version: z.literal(1), id, name: z.string().min(1).max(100),
  width: z.number().int().min(64).max(4096), height: z.number().int().min(64).max(4096),
  fps: z.number().int().min(1).max(60), duration: z.number().int().min(2).max(1800), background: color,
  items: z.array(z.object({
    id, name: z.string().min(1).max(100), type: z.enum(['character', 'shape', 'path', 'image']),
    shape: z.enum(['rectangle', 'ellipse', 'star', 'sparkle', 'ground']).optional(),
    x: finite.min(-100000).max(100000), y: finite.min(-100000).max(100000), width: finite.min(1).max(10000), height: finite.min(1).max(10000),
    scaleX: finite.min(0.01).max(100), scaleY: finite.min(0.01).max(100), rotation: finite, opacity: finite.min(0).max(1),
    visible: z.boolean(), locked: z.boolean(), fill: color, stroke: color, strokeWidth: finite.min(0).max(100),
    points: z.array(point).max(20000).optional(),
    imageData: z.string().max(28_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/).optional(),
    rig: z.object({ origin: point, bones: z.array(bone).max(200) }).optional(),
  })).max(500),
  keyframes: z.record(id, z.array(z.object({ id, frame: z.number().int().min(0).max(1799), easing: z.enum(['linear', 'ease-in-out', 'ease-out', 'hold']), values: pose })).max(1800)),
});

export function parseProject(raw: string): Project {
  if (raw.length > 40_000_000) throw new Error('This project is too large (40 MB maximum).');
  const result = projectSchema.safeParse(JSON.parse(raw));
  if (!result.success) throw new Error('This is not a supported Luno project. Please choose a valid .luno file.');
  const project = result.data;
  const ids = new Set(project.items.map(i => i.id));
  if (ids.size !== project.items.length) throw new Error('The project contains duplicate layer IDs.');
  for (const [itemId, keys] of Object.entries(project.keyframes)) {
    if (!ids.has(itemId) || keys.some(k => k.frame >= project.duration)) throw new Error('The project contains invalid keyframes.');
    if (new Set(keys.map(k => k.frame)).size !== keys.length) throw new Error('The project has duplicate frames in a layer.');
  }
  for (const item of project.items) {
    if (item.type === 'character' && !item.rig) throw new Error('A character is missing its rig.');
    if (item.type === 'image' && !item.imageData) throw new Error('An image layer is missing its artwork.');
    if (!item.rig) continue;
    const bones = new Map(item.rig.bones.map(b => [b.id, b]));
    if (bones.size !== item.rig.bones.length) throw new Error('The rig contains duplicate bones.');
    for (const b of item.rig.bones) {
      const seen = new Set([b.id]);
      let parent = b.parentId;
      while (parent) {
        if (seen.has(parent) || !bones.has(parent)) throw new Error('The bone hierarchy is invalid.');
        seen.add(parent); parent = bones.get(parent)!.parentId;
      }
    }
  }
  return project as Project;
}

export const serializeProject = (project: Project) => JSON.stringify(project, null, 2);

export function adaptCanvas(project: Project, width: number, height: number): Project {
  const s = Math.min(width / project.width, height / project.height);
  const x = (value: number) => (value - project.width / 2) * s + width / 2;
  const y = (value: number) => (value - project.height / 2) * s + height / 2;
  return {
    ...project, width, height,
    items: project.items.map(item => ({ ...item, x: x(item.x), y: y(item.y), scaleX: item.scaleX * s, scaleY: item.scaleY * s })),
    keyframes: Object.fromEntries(Object.entries(project.keyframes).map(([id, keys]) => {
      return [id, keys.map(k => ({ ...k, values: { ...k.values,
        ...(k.values.x !== undefined ? { x: x(k.values.x) } : {}), ...(k.values.y !== undefined ? { y: y(k.values.y) } : {}),
        ...(k.values.scaleX !== undefined ? { scaleX: k.values.scaleX * s } : {}),
        ...(k.values.scaleY !== undefined ? { scaleY: k.values.scaleY * s } : {}),
      } }))];
    })),
  };
}
