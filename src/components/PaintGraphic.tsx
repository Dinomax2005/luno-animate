import { memo, type ReactNode } from 'react';
import { circlePath, DEFAULT_BRUSH, hexRgb, linePath, num, pixelPath, resamplePoints, rgbHex, ribbonPath, smoothPoints, stampPath, strokeBounds } from '../engine/brushes';
import type { Stroke } from '../engine/types';

/** The stage, onion skins, previews and every export use exactly the same brush geometry. */
export const PaintStroke = memo(function PaintStroke({ stroke, id, erase = false }: { stroke: Stroke; id: string; erase?: boolean }) {
  if (!stroke.brush && !stroke.fill && stroke.mode !== 'erase') return <path d={linePath(stroke.points)} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />;
  const brush = stroke.brush ?? { ...DEFAULT_BRUSH, smoothing: 0 }, color = erase ? '#000000' : stroke.color;
  const pressure = brush.opacityPressure ? stroke.points.reduce((sum, p) => sum + (p.pressure ?? 1), 0) / Math.max(1, stroke.points.length) : 1;
  const opacity = brush.opacity * brush.flow * pressure;
  const blend = !erase && brush.blend !== 'normal' ? { mixBlendMode: brush.blend, isolation: 'isolate' as const } : undefined;
  if (stroke.fill) return <path data-paint-kind="fill" d={stroke.fill.runs.map(([x, y, w]) => `M${num(x)} ${num(y)}h${num(w)}v${num(stroke.fill!.cellSize)}h${num(-w)}Z`).join('')} fill={color} opacity={opacity} shapeRendering="crispEdges" style={blend} />;
  const points = smoothPoints(stroke.points, brush.kind === 'pixel' ? 0 : brush.smoothing), bounds = strokeBounds(stroke);
  if (brush.kind === 'pixel') return <path data-paint-kind="pixel" d={pixelPath(stroke.points, brush, stroke.width)} fill={color} opacity={opacity} shapeRendering="crispEdges" style={blend} />;
  if (['pencil', 'dry', 'chalk', 'spray', 'stipple', 'flat'].includes(brush.kind)) return <path data-paint-kind={brush.kind} d={stampPath(points, brush, stroke.width)} fill={color} opacity={opacity} style={blend} />;
  const variable = brush.sizePressure || brush.taper > 0;
  const geometry = variable ? ribbonPath(resamplePoints(points, Math.max(0.5, stroke.width * 0.08)), brush, stroke.width) : undefined;
  const dot = !variable && points.length && points.every(p => p.x === points[0].x && p.y === points[0].y) ? circlePath(points[0].x, points[0].y, stroke.width / 2) : undefined;
  const d = geometry ?? dot ?? linePath(points), pathProps = { d, fill: geometry || dot ? color : 'none', stroke: geometry || dot ? 'none' : color, strokeWidth: stroke.width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const soft = (1 - brush.hardness) * stroke.width * 0.17;
  const softId = `${id}-soft`;
  const filter = <defs><filter id={softId} filterUnits="userSpaceOnUse" x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={soft} /></filter></defs>;
  if (brush.kind === 'glow' && !erase) {
    const [r, g, b] = hexRgb(color), core = rgbHex(r * 0.4 + 153, g * 0.4 + 153, b * 0.4 + 153);
    return <g data-paint-kind="glow" opacity={opacity} style={blend}>{filter}<path {...pathProps} filter={`url(#${softId})`} strokeWidth={stroke.width * 2.2} /><path {...pathProps} /><path d={dot ?? linePath(points)} fill={dot ? core : 'none'} stroke={dot ? 'none' : core} strokeWidth={stroke.width * 0.22} strokeLinecap="round" strokeLinejoin="round" /></g>;
  }
  return <g data-paint-kind={brush.kind} opacity={opacity} style={blend}>{soft > 0.01 && filter}<path {...pathProps} filter={soft > 0.01 ? `url(#${softId})` : undefined} /></g>;
});

/** Erasers mask only artwork painted before them, never the layer below or later strokes. */
export const CelPaint = memo(function CelPaint({ strokes, id, width, height }: { strokes: readonly Stroke[]; id: string; width: number; height: number }) {
  let content: ReactNode = null; let index = 0;
  let left = -width / 2, top = -height / 2, right = width / 2, bottom = height / 2;
  if (strokes.some(s => s.mode === 'erase')) for (const s of strokes) { const b = strokeBounds(s); left = Math.min(left, b.x); top = Math.min(top, b.y); right = Math.max(right, b.x + b.width); bottom = Math.max(bottom, b.y + b.height); }
  while (index < strokes.length) {
    if (strokes[index].mode !== 'erase') {
      const batch: ReactNode[] = []; while (index < strokes.length && strokes[index].mode !== 'erase') { const at = index++; batch.push(<PaintStroke key={at} id={`${id}-stroke-${at}`} stroke={strokes[at]} />); }
      content = <>{content}{batch}</>;
    } else {
      const erasers: ReactNode[] = [], first = index;
      // Bound mask coordinates to the actual authored geometry, including old strokes outside the paper.
      while (index < strokes.length && strokes[index].mode === 'erase') { const at = index++; erasers.push(<PaintStroke key={at} id={`${id}-erase-${at}`} stroke={strokes[at]} erase />); }
      const maskId = `${id}-mask-${first}`;
      content = <g key={first}><defs><mask id={maskId} maskUnits="userSpaceOnUse" x={left} y={top} width={right - left} height={bottom - top} style={{ maskType: 'luminance' }}><rect x={left} y={top} width={right - left} height={bottom - top} fill="#ffffff" />{erasers}</mask></defs><g mask={`url(#${maskId})`}>{content}</g></g>;
    }
  }
  return <g data-testid="cel-paint" style={{ isolation: 'isolate' }}>{content}</g>;
});
