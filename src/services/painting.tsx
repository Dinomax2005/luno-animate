import { renderToStaticMarkup } from 'react-dom/server';
import { CelPaint } from '../components/PaintGraphic';
import { sampleCel } from '../engine/animation';
import { rasterize } from '../engine/export';
import { floodFill, fillRegion, sampledColor } from '../engine/painting';
import type { BrushStyle, Point, Project, SceneItem, Stroke } from '../engine/types';

async function drawingPixels(item: SceneItem, frame: number, pixelSize: number) {
  const scale = Math.min(1 / pixelSize, 1024 / Math.max(item.width, item.height));
  const width = Math.max(1, Math.floor(item.width * scale)), height = Math.max(1, Math.floor(item.height * scale));
  // A square working pixel remains square even when layer dimensions are not divisible by its size.
  const actualScale = scale;
  const markup = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`${-item.width / 2} ${-item.height / 2} ${width / actualScale} ${height / actualScale}`}><CelPaint strokes={sampleCel(item, frame)?.strokes ?? []} id="fill-source" width={item.width} height={item.height} /></svg>);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const image = new Image(); image.src = url;
    await Promise.race([image.decode(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('The painting surface took too long to prepare. No artwork was changed.')), 12000); })]);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('Canvas painting is unavailable.');
    context.drawImage(image, 0, 0, width, height); return { data: context.getImageData(0, 0, width, height).data, width, height, scale: actualScale };
  } finally { clearTimeout(timer); URL.revokeObjectURL(url); }
}
/** Bucket is scoped to one cel. It never rasterizes or replaces other layers, originals or prior frames. */
export async function bucketStroke(item: SceneItem, frame: number, local: Point, color: string, brush: BrushStyle, tolerance: number): Promise<Stroke | null> {
  const surface = await drawingPixels(item, frame, brush.kind === 'pixel' ? brush.pixelSize : 1);
  const runs = floodFill(surface.data, surface.width, surface.height, { x: (local.x + item.width / 2) * surface.scale, y: (local.y + item.height / 2) * surface.scale }, color, tolerance, brush.opacity * brush.flow);
  if (!runs.length) return null;
  const fill = fillRegion(runs, item.width, item.height, surface.scale);
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x, y, w] of fill.runs) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + w); bottom = Math.max(bottom, y + fill.cellSize); }
  return { points: [{ x: left, y: top }, { x: right, y: bottom }], color, width: 1, brush: { ...brush, opacityPressure: false, sizePressure: false }, mode: 'paint', fill };
}
export async function pickStageColor(project: Project, frame: number, point: Point): Promise<string | null> {
  const scale = Math.min(1, 2048 / Math.max(project.width, project.height)), canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(project.width * scale)); canvas.height = Math.max(1, Math.round(project.height * scale));
  const context = await rasterize(project, frame, canvas);
  return sampledColor(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { x: point.x * scale, y: point.y * scale });
}
