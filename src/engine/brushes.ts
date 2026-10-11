import type { BrushKind, BrushPreset, BrushStyle, Point, Stroke, SceneItem } from './types';

export const BRUSH_KINDS = ['round', 'ink', 'airbrush', 'pencil', 'dry', 'chalk', 'marker', 'flat', 'pixel', 'spray', 'stipple', 'glow'] as const;
export const MAX_BRUSH_SIZE = 256;
export const MAX_BRUSH_SAMPLES = 2048;
export const DEFAULT_BRUSH: BrushStyle = {
  kind: 'round', opacity: 1, flow: 1, hardness: 1, spacing: 0.16, smoothing: 0.35,
  sizePressure: false, opacityPressure: false, taper: 0, angle: 0, roundness: 1,
  scatter: 0, grain: 0, pixelSize: 1, seed: 1, blend: 'normal',
};
const preset = (kind: BrushKind, name: string, category: BrushPreset['category'], size: number, description: string, patch: Partial<BrushStyle> = {}): BrushPreset => ({
  id: kind, name, category, size, description, brush: { ...DEFAULT_BRUSH, kind, ...patch },
});
export const BRUSH_PRESETS: readonly BrushPreset[] = [
  preset('round', 'Studio Round', 'Essentials', 12, 'Clean round tip. A dependable brush for blocking in.', { smoothing: 0.3 }),
  preset('ink', 'Smooth Ink', 'Essentials', 8, 'Stabilized curves, tapered ends, pressure-sensitive linework.', { smoothing: 0.75, sizePressure: true, taper: 0.18 }),
  preset('airbrush', 'Soft Airbrush', 'Essentials', 64, 'Soft edges for shading. Layer strokes to build tone.', { hardness: 0.15, flow: 0.45, smoothing: 0.6 }),
  preset('marker', 'Felt Marker', 'Essentials', 28, 'Translucent color with multiply blending.', { opacity: 0.65, blend: 'multiply', smoothing: 0.5 }),
  preset('flat', 'Calligraphy', 'Essentials', 28, 'An angled flat nib for broad and narrow marks.', { angle: 40, roundness: 0.2, spacing: 0.08, smoothing: 0.65, sizePressure: true }),
  preset('pencil', 'Graphite', 'Texture', 6, 'Seeded grain for pencil-like sketching.', { grain: 0.65, flow: 0.75, spacing: 0.15, sizePressure: true }),
  preset('dry', 'Dry Bristle', 'Texture', 34, 'Broken bristle marks with visible gaps.', { grain: 0.8, roundness: 0.45, spacing: 0.22, smoothing: 0.4 }),
  preset('chalk', 'Chalk', 'Texture', 24, 'Rough, opaque texture for expressive drawing.', { grain: 0.6, spacing: 0.18, flow: 0.8, smoothing: 0.3 }),
  preset('pixel', 'Pixel Square', 'Pixel & FX', 8, 'Grid-aligned square pixels. No stroke smoothing.', { pixelSize: 4, spacing: 0.1, smoothing: 0 }),
  preset('spray', 'Scatter Spray', 'Pixel & FX', 64, 'Deterministic scattered dots. Scatter controls the spread.', { scatter: 0.8, grain: 0.8, spacing: 0.28, flow: 0.75 }),
  preset('stipple', 'Stipple', 'Pixel & FX', 14, 'Spaced ink dots for detail and stippled shading.', { scatter: 0.15, spacing: 0.65, grain: 0.2 }),
  preset('glow', 'Neon Glow', 'Pixel & FX', 16, 'A bright core and soft colored glow for animation.', { hardness: 0.2, smoothing: 0.75, blend: 'screen' }),
];
export function brushPreset(id: string, custom: readonly BrushPreset[] = []): BrushPreset {
  return custom.find(p => p.id === id) ?? BRUSH_PRESETS.find(p => p.id === id) ?? BRUSH_PRESETS[0];
}
export function brushLabel(kind: BrushKind): string { return BRUSH_PRESETS.find(p => p.brush.kind === kind)?.name ?? 'Studio Round'; }
const finite = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
/** Defensive normalization is also used for old or partially saved preferences. Project imports are strict. */
export function normalizeBrush(value: unknown): BrushStyle {
  const v = value && typeof value === 'object' ? value as Partial<BrushStyle> : {};
  return {
    kind: BRUSH_KINDS.includes(v.kind as BrushKind) ? v.kind! : 'round',
    opacity: finite(v.opacity, 1, 0.01, 1), flow: finite(v.flow, 1, 0.01, 1), hardness: finite(v.hardness, 1, 0, 1),
    spacing: finite(v.spacing, 0.16, 0.02, 2), smoothing: finite(v.smoothing, 0.35, 0, 1), taper: finite(v.taper, 0, 0, 1),
    angle: finite(v.angle, 0, -180, 180), roundness: finite(v.roundness, 1, 0.05, 1), scatter: finite(v.scatter, 0, 0, 1), grain: finite(v.grain, 0, 0, 1),
    pixelSize: Math.round(finite(v.pixelSize, 1, 1, 64)), seed: Math.round(finite(v.seed, 1, 0, 4294967295)),
    sizePressure: v.sizePressure === true, opacityPressure: v.opacityPressure === true,
    blend: v.blend === 'multiply' || v.blend === 'screen' ? v.blend : 'normal',
  };
}
export const num = (v: number) => String(Math.round(v * 1000) / 1000);
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
export function inputPressure(pointerType: string, pressure: number) {
  // Mice report 0.5 while pressed. That is not a real pen-pressure signal.
  return pointerType === 'pen' && Number.isFinite(pressure) ? Math.max(0.05, Math.min(1, pressure)) : 1;
}
export function stabilizePoint(previous: Point, next: Point, amount: number): Point {
  const weight = 1 - Math.max(0, Math.min(0.85, amount * 0.65));
  return { x: previous.x + (next.x - previous.x) * weight, y: previous.y + (next.y - previous.y) * weight, pressure: next.pressure ?? 1 };
}
/** Smooth cubic interpolation preserves the original endpoints; pixels deliberately bypass it. */
export function smoothPoints(points: readonly Point[], amount: number, limit = MAX_BRUSH_SAMPLES): Point[] {
  if (!points.length) return [];
  const step = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(limit / 4))));
  const source = points.filter((_, i) => i % step === 0); if (source.at(-1) !== points.at(-1)) source.push(points.at(-1)!);
  if (!amount || source.length < 3) return source;
  const result: Point[] = [source[0]], tension = amount / 6;
  for (let i = 0; i < source.length - 1; i++) {
    const a = source[Math.max(0, i - 1)], b = source[i], c = source[i + 1], d = source[Math.min(source.length - 1, i + 2)];
    const c1 = { x: b.x + (c.x - a.x) * tension, y: b.y + (c.y - a.y) * tension }, c2 = { x: c.x - (d.x - b.x) * tension, y: c.y - (d.y - b.y) * tension };
    for (let j = 1; j <= 4; j++) { const t = j / 4, s = 1 - t; result.push({ x: s ** 3 * b.x + 3 * s ** 2 * t * c1.x + 3 * s * t ** 2 * c2.x + t ** 3 * c.x, y: s ** 3 * b.y + 3 * s ** 2 * t * c1.y + 3 * s * t ** 2 * c2.y + t ** 3 * c.y, pressure: (b.pressure ?? 1) * s + (c.pressure ?? 1) * t }); }
  }
  return result.length > limit ? [...result.slice(0, limit - 1), points.at(-1)!] : result;
}
export function linePath(points: readonly Point[]) { return points.map((p, i) => `${i ? 'L' : 'M'}${num(p.x)} ${num(p.y)}`).join(''); }
export function resamplePoints(points: readonly Point[], spacing: number, limit = MAX_BRUSH_SAMPLES): Point[] {
  if (points.length < 2) return [...points];
  let length = 0; for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const step = Math.max(0.25, spacing, length / (limit - 1)), result: Point[] = [points[0]]; let remaining = step;
  for (let i = 1; i < points.length && result.length < limit - 1; i++) {
    const a = points[i - 1], b = points[i], distance = Math.hypot(b.x - a.x, b.y - a.y); if (!distance) continue;
    let at = remaining;
    while (at <= distance && result.length < limit - 1) { const t = at / distance; result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, pressure: (a.pressure ?? 1) + ((b.pressure ?? 1) - (a.pressure ?? 1)) * t }); at += step; }
    remaining = at - distance;
  }
  if (result.at(-1)?.x !== points.at(-1)!.x || result.at(-1)?.y !== points.at(-1)!.y) result.push(points.at(-1)!);
  return result;
}
export function widthAt(brush: BrushStyle, pressure: number, index: number, count: number, width: number) {
  const edge = count < 3 ? 1 : Math.min(index / (count - 1), 1 - index / (count - 1));
  const taper = brush.taper ? Math.min(1, Math.max(0.08, edge / Math.max(0.01, brush.taper * 0.5))) : 1;
  return Math.max(0.1, width * (brush.sizePressure ? 0.12 + 0.88 * Math.max(0, Math.min(1, pressure)) : 1) * taper);
}
export function circlePath(x: number, y: number, r: number): string { return `M${num(x - r)} ${num(y)}a${num(r)} ${num(r)} 0 1 0 ${num(r * 2)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-r * 2)} 0Z`; }
export function rectPath(x: number, y: number, w: number, h: number): string { return `M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}Z`; }
export function ribbonPath(points: readonly Point[], brush: BrushStyle, width: number): string {
  if (!points.length) return '';
  if (points.length < 2 || points.every(p => p.x === points[0].x && p.y === points[0].y)) return circlePath(points[0].x, points[0].y, widthAt(brush, points[0].pressure ?? 1, 0, 1, width) / 2);
  const left: Point[] = [], right: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
    const angle = Math.atan2(after.y - before.y, after.x - before.x) + Math.PI / 2, r = widthAt(brush, p.pressure ?? 1, i, points.length, width) / 2;
    const dx = Math.cos(angle) * r, dy = Math.sin(angle) * r; left.push({ x: p.x + dx, y: p.y + dy }); right.push({ x: p.x - dx, y: p.y - dy });
  }
  const end = points.at(-1)!, first = points[0];
  return `${linePath([...left, ...right.reverse()])}Z${circlePath(first.x, first.y, widthAt(brush, first.pressure ?? 1, 0, points.length, width) / 2)}${circlePath(end.x, end.y, widthAt(brush, end.pressure ?? 1, points.length - 1, points.length, width) / 2)}`;
}
/** Deterministic stamp geometry. One compact path rather than thousands of DOM elements. */
export function stampPath(points: readonly Point[], brush: BrushStyle, width: number): string {
  const textured = ['pencil', 'dry', 'chalk', 'spray', 'stipple'].includes(brush.kind);
  const samples = resamplePoints(points, Math.max(0.5, width * brush.spacing), textured ? 768 : MAX_BRUSH_SAMPLES), random = seededRandom(brush.seed);
  const pieces: string[] = [];
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i], size = widthAt(brush, p.pressure ?? 1, i, samples.length, width), angle = brush.angle * Math.PI / 180;
    if (brush.kind === 'flat') {
      const a = size / 2, b = size * brush.roundness / 2, c = Math.cos(angle), s = Math.sin(angle);
      const corners = [[-a, -b], [a, -b], [a, b], [-a, b]].map(([x, y]) => ({ x: p.x + x * c - y * s, y: p.y + x * s + y * c })); pieces.push(`${linePath(corners)}Z`); continue;
    }
    const count = brush.kind === 'spray' ? 7 : brush.kind === 'stipple' ? 1 : 4;
    for (let j = 0; j < count; j++) {
      if (brush.kind !== 'stipple' && random() < brush.grain * 0.2) continue;
      const a = random() * Math.PI * 2, spread = Math.sqrt(random()) * size * (brush.kind === 'spray' ? 0.5 + brush.scatter * 0.45 : brush.kind === 'stipple' ? brush.scatter : 0.48);
      const x = p.x + Math.cos(a) * spread, y = p.y + Math.sin(a) * spread;
      const r = Math.max(0.15, size * (brush.kind === 'spray' ? 0.012 + random() * 0.02 : brush.kind === 'stipple' ? 0.2 : brush.kind === 'pencil' ? 0.045 : brush.kind === 'chalk' ? 0.04 + random() * 0.07 : 0.025));
      pieces.push(brush.kind === 'dry' ? rectPath(x, y, Math.max(0.3, size * 0.1), Math.max(0.3, size * 0.025)) : circlePath(x, y, r));
    }
  }
  return pieces.join('');
}
export const MAX_PIXEL_CELLS = 8192;
export function pixelPath(points: readonly Point[], brush: BrushStyle, width: number): string {
  if (!points.length) return '';
  const grid = brush.pixelSize, cells = new Set<string>(), pieces: string[] = [];
  const add = (x: number, y: number, pressure: number) => {
    const size = Math.max(grid, Math.round(widthAt(brush, pressure, 0, 1, width) / grid) * grid), key = `${x},${y},${size}`;
    if (cells.has(key)) return; cells.add(key); pieces.push(rectPath(x * grid - Math.floor(size / grid / 2) * grid, y * grid - Math.floor(size / grid / 2) * grid, size, size));
  };
  // Integer Bresenham traversal keeps diagonal strokes connected, even at one document pixel.
  add(Math.floor(points[0].x / grid), Math.floor(points[0].y / grid), points[0].pressure ?? 1);
  for (let i = 1; i < points.length && cells.size < MAX_PIXEL_CELLS; i++) {
    const a = points[i - 1], b = points[i]; let x = Math.floor(a.x / grid), y = Math.floor(a.y / grid);
    const endX = Math.floor(b.x / grid), endY = Math.floor(b.y / grid), dx = Math.abs(endX - x), dy = -Math.abs(endY - y), sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1, count = Math.max(dx, -dy, 1);
    let error = dx + dy, step = 0;
    while (cells.size < MAX_PIXEL_CELLS) {
      const t = Math.min(1, step / count); add(x, y, (a.pressure ?? 1) * (1 - t) + (b.pressure ?? 1) * t);
      if (x === endX && y === endY) break; const e = error * 2; if (e >= dy) { error += dy; x += sx; } if (e <= dx) { error += dx; y += sy; } step++;
    }
  }
  return pieces.join('');
}
export const MAX_CEL_PAINT_WORK = 160000;
export const MAX_SCENE_PAINT_WORK = 640000;
/** Conservative render-work estimate protects imported and newly authored procedural brushes. */
export function paintWork(stroke: Stroke): number {
  if (stroke.fill) return stroke.fill.runs.length * 5;
  if (!stroke.brush) return 0; const b = stroke.brush;
  let length = 0; for (let i = 1; i < stroke.points.length; i++) length += Math.hypot(stroke.points[i].x - stroke.points[i - 1].x, stroke.points[i].y - stroke.points[i - 1].y);
  if (b.kind === 'pixel') return Math.min(MAX_PIXEL_CELLS, Math.ceil(length / b.pixelSize) + stroke.points.length) * 5;
  const samples = Math.ceil(length / Math.max(0.25, stroke.width * b.spacing)) + 2;
  if (['pencil', 'dry', 'chalk', 'spray', 'stipple'].includes(b.kind)) return Math.min(768, samples) * (b.kind === 'spray' ? 7 : b.kind === 'stipple' ? 1 : 4) * 4;
  if (b.kind === 'flat') return Math.min(MAX_BRUSH_SAMPLES, samples) * 5;
  return Math.min(MAX_BRUSH_SAMPLES, stroke.points.length * 4 + 2) * 3;
}
/** Conservative upper bound across vector paint and the most detailed cel on each layer. */
export function scenePaintWork(items: SceneItem[]): number {
  let total = 0;
  for (const item of items) {
    if (item.brush && item.type === 'path' && item.points) total += paintWork({ points: item.points, brush: item.brush, width: item.strokeWidth, color: item.stroke });
    if (item.type === 'drawing') { let largest = 0; for (const cel of item.cels ?? []) largest = Math.max(largest, cel.strokes.reduce((sum, stroke) => sum + paintWork(stroke), 0)); total += largest; }
  }
  return total;
}
export function strokeBounds(stroke: Stroke) {
  const points = stroke.points; let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const p of points) { left = Math.min(left, p.x); right = Math.max(right, p.x); top = Math.min(top, p.y); bottom = Math.max(bottom, p.y); }
  if (!points.length) left = top = right = bottom = 0;
  const pad = stroke.width * (stroke.brush?.kind === 'glow' ? 3 : 1.5);
  return { x: left - pad, y: top - pad, width: Math.max(1, right - left + 2 * pad), height: Math.max(1, bottom - top + 2 * pad) };
}
export function mirrorStrokes(stroke: Stroke, symmetry: 'none' | 'vertical' | 'horizontal' | 'both', width: number, height: number): Stroke[] {
  const output = [stroke], axes: [boolean, boolean][] = symmetry === 'both' ? [[true, false], [false, true], [true, true]] : symmetry === 'vertical' ? [[true, false]] : symmetry === 'horizontal' ? [[false, true]] : [];
  for (const [x, y] of axes) output.push({ ...stroke, points: stroke.points.map(p => ({ ...p, x: x ? width - p.x : p.x, y: y ? height - p.y : p.y })), ...(stroke.brush ? { brush: { ...stroke.brush, angle: x !== y ? -stroke.brush.angle : stroke.brush.angle } } : {}) });
  return output;
}
export function hexRgb(hex: string): [number, number, number] {
  const raw = hex.replace('#', ''); const v = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) || 0) as [number, number, number];
}
export function rgbHex(r: number, g: number, b: number): string { return `#${[r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`; }
export function hsvHex(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs((h / 60 % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
export function hexHsv(hex: string): [number, number, number] {
  const [r, g, b] = hexRgb(hex).map(c => c / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = !d ? 0 : max === r ? 60 * ((g - b) / d % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return [(h + 360) % 360, max ? d / max : 0, max];
}
export const COLOR_PALETTES: Record<string, readonly string[]> = {
  Studio: ['#0b1020', '#ffffff', '#718096', '#cbd5e1', '#235c9c', '#77b8ff', '#43b5aa', '#7ee3d0', '#542f85', '#bba3ee', '#db4568', '#ffabc1', '#be5536', '#f0b793', '#d7a13f', '#f9dc82'],
  Earth: ['#302721', '#624a39', '#92745d', '#c7a98a', '#f3e5d0', '#434f3b', '#6b7c56', '#a7b58b', '#704536', '#ad6650', '#d4a275', '#dfc694', '#304855', '#537789', '#8ba9b6', '#cdd5d1'],
  Pastel: ['#fff4e6', '#ffe0c5', '#ffcfca', '#edb7cf', '#d7c4ec', '#c6c9f3', '#bbd7f4', '#bce7ef', '#b8e4d8', '#cce7bf', '#e6e6b0', '#f7e4ae', '#7c647d', '#637887', '#749682', '#a58c6b'],
  'Pixel 16': ['#140c1c', '#442434', '#30346d', '#4e4a4e', '#854c30', '#346524', '#d04648', '#757161', '#597dce', '#d27d2c', '#8595a1', '#6daa2c', '#d2aa99', '#6dc2ca', '#dad45e', '#deeed6'],
};
