import { renderToStaticMarkup } from 'react-dom/server';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { SceneArtwork } from '../components/SceneGraphics';
import type { Project } from './types';

export function exportSvg(project: Project, frame: number, transparent = false): Blob {
  const svg = renderToStaticMarkup(<SceneArtwork project={project} frame={frame} transparent={transparent} />);
  return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: 'image/svg+xml' });
}
async function rasterize(project: Project, frame: number, canvas: HTMLCanvasElement, transparent = false) {
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
export async function exportGif(project: Project, onProgress: (progress: number) => void, signal?: AbortSignal): Promise<Blob> {
  if (project.duration > 300) throw new Error('GIF exports support up to 300 frames. Shorten your project duration in Settings.');
  const scale = Math.min(1, 960 / Math.max(project.width, project.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(project.width * scale); canvas.height = Math.round(project.height * scale);
  const gif = GIFEncoder();
  for (let frame = 0; frame < project.duration; frame++) {
    signal?.throwIfAborted();
    const context = await rasterize(project, frame, canvas);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const palette = quantize(rgba, 256, { format: 'rgb565' });
    const indexed = applyPalette(rgba, palette, 'rgb565');
    gif.writeFrame(indexed, canvas.width, canvas.height, { palette, delay: 1000 / project.fps, repeat: 0 });
    onProgress((frame + 1) / project.duration);
    // Yield so progress paints and cancel stays responsive during encoding.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  signal?.throwIfAborted(); gif.finish();
  return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' });
}
