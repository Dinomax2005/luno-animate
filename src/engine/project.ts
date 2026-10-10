import { z } from 'zod';
import { createMiloRig } from './rig';
import type { Project, Scene, SceneContent, SceneItem, ShapeKind, Template } from './types';

export const uid = () => globalThis.crypto?.randomUUID?.() ?? `luno-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const MAX_PROJECT_BYTES = 64_000_000;
export function createItem(type: SceneItem['type'], options: Partial<SceneItem> = {}): SceneItem {
  return { id: uid(), name: type === 'character' ? 'Milo' : type === 'text' ? 'Text' : 'Shape', type,
    x: 480, y: 285, width: 150, height: 150, scaleX: 1, scaleY: 1, rotation: 0,
    opacity: 1, visible: true, locked: false, fill: '#b7a5e8', stroke: 'none', strokeWidth: 3, ...options };
}
export function createCharacter(x = 480, y = 282): SceneItem {
  return createItem('character', { name: 'Milo', x, y, width: 245, height: 350, fill: '#c5b1ed', rig: createMiloRig() });
}
export function createShape(shape: ShapeKind, x = 480, y = 300): SceneItem {
  const colors = { rectangle: '#c5b1ed', ellipse: '#f0b88e', star: '#e9c669', sparkle: '#e9c669', ground: '#e9e7dd' };
  return createItem('shape', { shape, name: shape[0].toUpperCase() + shape.slice(1), x, y, width: 100, height: 100, fill: colors[shape] });
}
export function createText(x = 480, y = 300, text = 'A little imagination.'): SceneItem {
  return createItem('text', { name: 'Your words', x, y, width: 620, height: 84, text, fontSize: 56, fontWeight: 600, textAlign: 'middle', fill: '#496853' });
}
export function createScene(width: number, height: number, name = 'Scene 01'): Scene {
  return { id: uid(), name, duration: 72, background: '#fffdf7', items: [], keyframes: {},
    camera: { x: width / 2, y: height / 2, zoom: 1, rotation: 0, keys: [] }, audio: [], workArea: { start: 0, end: 71 } };
}
export function activeScene(p: Project): Scene {
  return { id: p.sceneId, name: p.sceneName, duration: p.duration, background: p.background, items: p.items,
    keyframes: p.keyframes, camera: p.camera, audio: p.audio, workArea: p.workArea };
}
export function getScenes(p: Project): Scene[] {
  const map = new Map([activeScene(p), ...p.scenes].map(s => [s.id, s]));
  return p.sceneOrder.map(id => map.get(id)!).filter(Boolean);
}
export function activateScene(p: Project, id: string): Project {
  if (id === p.sceneId) return p;
  const next = p.scenes.find(s => s.id === id);
  if (!next) throw new Error('This scene could not be found.');
  return { ...p, ...next, id: p.id, name: p.name, sceneId: next.id, sceneName: next.name,
    scenes: [...p.scenes.filter(s => s.id !== id), activeScene(p)] };
}
export const totalFrames = (p: Project) => getScenes(p).reduce((sum, s) => sum + s.duration, 0);
export function createProject(template: Template = 'character'): Project {
  const scene = createScene(960, 600);
  const project: Project = { ...scene, version: 2, id: uid(), name: template === 'title' ? 'Words in motion' : template === 'cutout' ? 'My cutout character' : template === 'blank' ? 'Untitled animation' : 'A little hello',
    width: 960, height: 600, fps: 24, sceneId: scene.id, sceneName: scene.name, sceneOrder: [scene.id], scenes: [] };
  if (template === 'character') {
    const ground = createShape('ground', 480, 493); Object.assign(ground, { name: 'Ground', width: 210, height: 26, locked: true });
    const orbit = createShape('ellipse', 695, 203); Object.assign(orbit, { name: 'Little orbit', width: 46, height: 46, fill: '#f0b793' });
    const sparkle = createShape('sparkle', 296, 247); Object.assign(sparkle, { name: 'Sparkle', width: 42, height: 42, fill: '#dac56e' });
    project.items = [ground, sparkle, orbit, createCharacter()];
  }
  if (template === 'shapes') {
    const ball = createShape('ellipse'); Object.assign(ball, { name: 'Bouncy ball', fill: '#c5b1ed' });
    const ground = createShape('ground', 480, 420); Object.assign(ground, { width: 280, height: 25, locked: true });
    project.items = [ground, ball];
  }
  if (template === 'title') {
    const text = createText(); const sub = createText(480, 380, 'Made with a little Luno.'); Object.assign(sub, { name: 'Subtitle', fontSize: 22, fontWeight: 400, height: 40 });
    project.items = [text, sub];
  }
  if (template === 'cutout') project.items = [{ ...createCharacter(), name: 'My rig', characterStyle: 'skeleton' }];
  return project;
}
const finite = z.number().finite();
const point = z.object({ x: finite.min(-100000).max(100000), y: finite.min(-100000).max(100000) });
const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/).refine(v => !['__proto__', 'prototype', 'constructor', 'toString', 'valueOf'].includes(v));
const color = z.string().regex(/^(#[0-9a-fA-F]{3,8}|none|transparent)$/);
const frame = z.number().int().min(0).max(1799);
const bone = z.object({ id, name: z.string().max(100), parentId: id.nullable(), length: finite.min(0).max(10000), angle: finite.min(-100000).max(100000), locked: z.boolean().optional(), minAngle: finite.min(-3600).max(3600).optional(), maxAngle: finite.min(-3600).max(3600).optional() });
const pose = z.object({ x: point.shape.x.optional(), y: point.shape.y.optional(), scaleX: finite.min(0.01).max(100).optional(), scaleY: finite.min(0.01).max(100).optional(), rotation: finite.optional(), opacity: finite.min(0).max(1).optional(), bones: z.record(id, finite.min(-100000).max(100000)).optional() });
const keyframe = z.object({ id, frame, easing: z.enum(['linear', 'ease-in-out', 'ease-out', 'ease-in', 'hold', 'back-out', 'bounce-out', 'elastic-out', 'bezier']), values: pose,
  bezier: z.tuple([finite.min(0).max(1), finite.min(-3).max(3), finite.min(0).max(1), finite.min(-3).max(3)]).optional() });
const itemSchema = z.object({
  id, name: z.string().min(1).max(100), type: z.enum(['character', 'shape', 'path', 'image', 'text', 'group', 'drawing']),
  shape: z.enum(['rectangle', 'ellipse', 'star', 'sparkle', 'ground']).optional(), parentId: id.nullable().optional(),
  attachment: z.object({ characterId: id, boneId: id, anchor: finite.min(0).max(1) }).optional(),
  x: point.shape.x, y: point.shape.y, width: finite.min(1).max(10000), height: finite.min(1).max(10000),
  scaleX: finite.min(0.01).max(100), scaleY: finite.min(0.01).max(100), rotation: finite, opacity: finite.min(0).max(1),
  visible: z.boolean(), locked: z.boolean(), fill: color, stroke: color, strokeWidth: finite.min(0).max(100),
  points: z.array(point).max(20000).optional(), imageData: z.string().max(40_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/).optional(),
  rig: z.object({ origin: point, bones: z.array(bone).max(200) }).optional(), characterStyle: z.enum(['milo', 'skeleton']).optional(),
  text: z.string().max(4000).optional(), fontSize: finite.min(4).max(600).optional(), fontWeight: finite.min(100).max(900).optional(), textAlign: z.enum(['start', 'middle', 'end']).optional(),
  cels: z.array(z.object({ frame, strokes: z.array(z.object({ points: z.array(point).min(2).max(20000), color, width: finite.min(0.5).max(100) })).max(500) })).max(1800).optional(),
  holdCels: z.boolean().optional(), blendMode: z.enum(['normal', 'multiply', 'screen', 'overlay']).optional(),
});
const audioSchema = z.object({ id, name: z.string().min(1).max(100), data: z.string().max(40_000_000).regex(/^data:audio\/(mpeg|mp3|wav|x-wav|wave|ogg|mp4|aac|flac|webm);base64,[a-zA-Z0-9+/=]+$/), duration: finite.min(0.01).max(7200), startFrame: frame, trimStart: finite.min(0).max(7200), volume: finite.min(0).max(2), muted: z.boolean(), waveform: z.array(finite.min(0).max(1)).max(512) });
const sceneFields = { duration: z.number().int().min(2).max(1800), background: color, items: z.array(itemSchema).max(500), keyframes: z.record(id, z.array(keyframe).max(1800)),
  camera: z.object({ x: point.shape.x, y: point.shape.y, zoom: finite.min(0.05).max(20), rotation: finite, keys: z.array(keyframe).max(1800) }), audio: z.array(audioSchema).max(32), workArea: z.object({ start: frame, end: frame }) };
export const projectSchema = z.object({ version: z.literal(2), id, name: z.string().min(1).max(100), width: z.number().int().min(64).max(4096), height: z.number().int().min(64).max(4096), fps: z.number().int().min(1).max(60),
  sceneId: id, sceneName: z.string().min(1).max(100), sceneOrder: z.array(id).min(1).max(32), scenes: z.array(z.object({ id, name: z.string().min(1).max(100), ...sceneFields })).max(31), ...sceneFields });

function validateScene(scene: SceneContent) {
  const items = new Map(scene.items.map(i => [i.id, i]));
  if (items.size !== scene.items.length) throw new Error('The project contains duplicate layer IDs.');
  const validateKeys = (keys: { frame: number }[]) => {
    if (keys.some(k => k.frame >= scene.duration) || new Set(keys.map(k => k.frame)).size !== keys.length) throw new Error('The project contains invalid or duplicate keyframes.');
  };
  for (const [itemId, keys] of Object.entries(scene.keyframes)) {
    if (!items.has(itemId)) throw new Error('A keyframe refers to a missing layer.');
    validateKeys(keys);
    for (const key of keys) if (key.values.bones && Object.keys(key.values.bones).some(id => !items.get(itemId)?.rig?.bones.some(b => b.id === id))) throw new Error('A keyframe refers to a missing bone.');
  }
  validateKeys(scene.camera.keys);
  if (scene.workArea.start > scene.workArea.end || scene.workArea.end >= scene.duration) throw new Error('The scene work area is invalid.');
  for (const clip of scene.audio) if (clip.startFrame >= scene.duration || clip.trimStart >= clip.duration) throw new Error('An audio clip has invalid timing.');
  if (new Set(scene.audio.map(a => a.id)).size !== scene.audio.length) throw new Error('Duplicate audio clip IDs.');
  for (const item of scene.items) {
    if (item.type === 'character' && !item.rig) throw new Error('A character is missing its rig.');
    if (item.type === 'image' && !item.imageData) throw new Error('An image layer is missing its artwork.');
    if (item.type === 'drawing') validateKeys(item.cels ?? []);
    if (item.attachment && item.parentId) throw new Error('A layer cannot be in a group and attached to a bone at the same time.');
    let current: SceneItem | undefined = item; const seen = new Set<string>();
    while (current) {
      if (seen.has(current.id)) throw new Error('The layer hierarchy contains a cycle.');
      seen.add(current.id);
      if (current.parentId) {
        const parent = items.get(current.parentId);
        if (parent?.type !== 'group') throw new Error('A layer refers to a missing group.');
        current = parent;
      } else if (current.attachment) {
        const parent = items.get(current.attachment.characterId);
        if (parent?.type !== 'character' || !parent.rig?.bones.some(b => b.id === current!.attachment!.boneId)) throw new Error('A layer refers to a missing rig or bone.');
        current = parent;
      } else current = undefined;
    }
    if (!item.rig) continue;
    const bones = new Map(item.rig.bones.map(b => [b.id, b]));
    if (bones.size !== item.rig.bones.length) throw new Error('The rig contains duplicate bones.');
    for (const b of item.rig.bones) {
      if (b.minAngle !== undefined && b.maxAngle !== undefined && b.minAngle > b.maxAngle) throw new Error('A joint limit is invalid.');
      const visited = new Set([b.id]); let parent = b.parentId;
      while (parent) {
        if (visited.has(parent) || !bones.has(parent)) throw new Error('The bone hierarchy is invalid.');
        visited.add(parent); parent = bones.get(parent)!.parentId;
      }
    }
  }
}
export function parseProject(raw: string, allowLegacy = true): Project {
  if (raw.length > MAX_PROJECT_BYTES) throw new Error('This project is too large (64 MB maximum).');
  let source: unknown;
  try { source = JSON.parse(raw); } catch { throw new Error('This is not a supported Luno project.'); }
  // Lossless migration of the original .luno format. Never overwrite its source file.
  if (allowLegacy && source && typeof source === 'object' && 'version' in source && source.version === 1) {
    const old = source as Record<string, unknown>; const sceneId = uid();
    source = { ...old, version: 2, sceneId, sceneName: 'Scene 01', sceneOrder: [sceneId], scenes: [],
      camera: { x: Number(old.width) / 2, y: Number(old.height) / 2, zoom: 1, rotation: 0, keys: [] }, audio: [], workArea: { start: 0, end: Number(old.duration) - 1 } };
  }
  const result = projectSchema.safeParse(source);
  if (!result.success) throw new Error('This is not a supported Luno project. Choose a valid .lam (or legacy .luno) file.');
  const p = result.data as Project;
  const sceneIds = [p.sceneId, ...p.scenes.map(s => s.id)];
  if (new Set(sceneIds).size !== sceneIds.length || new Set(p.sceneOrder).size !== sceneIds.length || p.sceneOrder.length !== sceneIds.length || p.sceneOrder.some(id => !sceneIds.includes(id))) throw new Error('The scene order is invalid.');
  for (const scene of getScenes(p)) validateScene(scene);
  return p;
}
export const serializeProject = (project: Project) => JSON.stringify(project, null, 2);
export function adaptCanvas(project: Project, width: number, height: number): Project {
  const s = Math.min(width / project.width, height / project.height);
  const x = (v: number) => (v - project.width / 2) * s + width / 2;
  const y = (v: number) => (v - project.height / 2) * s + height / 2;
  const adapt = (scene: SceneContent): SceneContent => ({ ...scene,
    items: scene.items.map(i => i.parentId || i.attachment ? i : ({ ...i, x: x(i.x), y: y(i.y), scaleX: i.scaleX * s, scaleY: i.scaleY * s })),
    keyframes: Object.fromEntries(Object.entries(scene.keyframes).map(([id, keys]) => [id, scene.items.find(i => i.id === id)?.parentId || scene.items.find(i => i.id === id)?.attachment ? keys : keys.map(k => ({ ...k, values: { ...k.values,
      ...(k.values.x !== undefined ? { x: x(k.values.x) } : {}), ...(k.values.y !== undefined ? { y: y(k.values.y) } : {}),
      ...(k.values.scaleX !== undefined ? { scaleX: k.values.scaleX * s } : {}), ...(k.values.scaleY !== undefined ? { scaleY: k.values.scaleY * s } : {}) } }))])),
    camera: { ...scene.camera, x: x(scene.camera.x), y: y(scene.camera.y), keys: scene.camera.keys.map(k => ({ ...k, values: { ...k.values, ...(k.values.x !== undefined ? { x: x(k.values.x) } : {}), ...(k.values.y !== undefined ? { y: y(k.values.y) } : {}) } })) },
  });
  return { ...project, ...adapt(project), width, height, scenes: project.scenes.map(scene => ({ ...scene, ...adapt(scene) })) };
}
