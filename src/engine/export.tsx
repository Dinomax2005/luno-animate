import { renderToStaticMarkup } from 'react-dom/server';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { SceneArtwork } from '../components/SceneGraphics';
import { zipSync, strToU8 } from 'fflate';
import { activateScene, getScenes } from './project';
import { framePlan, type AnimationExportOptions } from './frame-plan';
import type { Project } from './types';

export function exportSvg(project: Project, frame: number, transparent = false): Blob {
  const svg = renderToStaticMarkup(<SceneArtwork project={project} frame={frame} transparent={transparent} />);
  return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: 'image/svg+xml' });
}
export async function rasterize(project: Project, frame: number, canvas: HTMLCanvasElement, transparent = false) {
  const url = URL.createObjectURL(exportSvg(project, frame, transparent));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Your device does not support canvas exports.');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return context;
  } finally { URL.revokeObjectURL(url); }
}
export async function exportPng(project: Project, frame: number, scale = 1, transparent = false): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(project.width * scale); canvas.height = Math.round(project.height * scale);
  if (Math.max(canvas.width, canvas.height) > 8192) throw new Error('PNG exports are limited to 8192 pixels per side. Choose a smaller scale.');
  await rasterize(project, frame, canvas, transparent);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the PNG image.')), 'image/png'));
}
export async function exportGif(project: Project, onProgress: (progress: number) => void, signal?: AbortSignal, options: AnimationExportOptions = {}): Promise<Blob> {
  const frames = framePlan(project, options); const scenes = new Map(getScenes(project).map(s => [s.id, activateScene(project, s.id)]));
  if (frames.length > 300) throw new Error('GIF exports support up to 300 frames. Choose one scene or a shorter work area.');
  const scale = Math.min(1, 960 / Math.max(project.width, project.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(project.width * scale); canvas.height = Math.round(project.height * scale);
  const gif = GIFEncoder();
  for (let frame = 0; frame < frames.length; frame++) {
    signal?.throwIfAborted();
    const context = await rasterize(scenes.get(frames[frame].sceneId)!, frames[frame].frame, canvas);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const palette = quantize(rgba, 256, { format: 'rgb565' });
    const indexed = applyPalette(rgba, palette, 'rgb565');
    gif.writeFrame(indexed, canvas.width, canvas.height, { palette, delay: 1000 / project.fps, repeat: 0 });
    onProgress((frame + 1) / frames.length);
    // Yield so progress paints and cancel stays responsive during encoding.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  signal?.throwIfAborted(); gif.finish();
  return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' });
}

export async function exportSpritesheet(project: Project, options: AnimationExportOptions, onProgress: (progress: number) => void, signal?: AbortSignal): Promise<Blob> {
  const frames = framePlan(project, options);
  if (frames.length > 256) throw new Error('Sprite sheets support up to 256 frames. Use a shorter work area.');
  const size = Math.min(1, (options.longSide ?? 480) / Math.max(project.width, project.height));
  const width = Math.round(project.width * size), height = Math.round(project.height * size);
  const columns = Math.ceil(Math.sqrt(frames.length * height / width)), rows = Math.ceil(frames.length / columns);
  if (columns * width > 8192 || rows * height > 8192) throw new Error('This sprite sheet would exceed 8192 pixels. Choose smaller frames or a shorter work area.');
  const canvas = document.createElement('canvas'), tile = document.createElement('canvas'); tile.width = width; tile.height = height;
  canvas.width = columns * width; canvas.height = rows * height; const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas export is unavailable.');
  const scenes = new Map(getScenes(project).map(s => [s.id, activateScene(project, s.id)]));
  for (let i = 0; i < frames.length; i++) { signal?.throwIfAborted(); const f = frames[i]; await rasterize(scenes.get(f.sceneId)!, f.frame, tile, true); context.drawImage(tile, i % columns * width, Math.floor(i / columns) * height); onProgress((i + 1) / frames.length); await new Promise(resolve => setTimeout(resolve, 0)); }
  const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not create sprite artwork.')), 'image/png')); signal?.throwIfAborted();
  const metadata = { app: 'Luno Animate', version: 1, image: 'sprites.png', fps: project.fps, width: canvas.width, height: canvas.height,
    frames: frames.map((f, i) => ({ index: i, sceneId: f.sceneId, frame: f.frame + 1, x: i % columns * width, y: Math.floor(i / columns) * height, width, height, duration: 1 / project.fps })) };
  return new Blob([zipSync({ 'sprites.png': new Uint8Array(await png.arrayBuffer()), 'sprites.json': strToU8(JSON.stringify(metadata, null, 2)) })], { type: 'application/zip' });
}
