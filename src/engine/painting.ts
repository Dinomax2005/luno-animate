import type { FillRegion, Point } from './types';
import { hexRgb, rgbHex } from './brushes';

export const MAX_FILL_PIXELS = 1_048_576;
export const MAX_FILL_RUNS = 50000;
/** Four-connected scanline flood fill. Source pixels are never mutated, including on cancellation/failure. */
export function floodFill(data: Uint8ClampedArray, width: number, height: number, at: Point, color: string, tolerance = 12, opacity = 1): [number, number, number][] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_FILL_PIXELS || data.length !== width * height * 4) throw new Error('Paint fill exceeds its bounded working surface.');
  const x = Math.floor(at.x), y = Math.floor(at.y); if (x < 0 || y < 0 || x >= width || y >= height) return [];
  const pixel = (y * width + x) * 4, source = [data[pixel], data[pixel + 1], data[pixel + 2], data[pixel + 3]], target = [...hexRgb(color), Math.round(opacity * 255)];
  if (source.every((v, i) => v === target[i])) return [];
  const threshold = Math.max(0, Math.min(100, tolerance)) * 2.55, visited = new Uint8Array(width * height), stack = [y * width + x], runs: [number, number, number][] = [];
  const matches = (p: number) => { const i = p * 4; if (Math.abs(data[i + 3] - source[3]) > threshold) return false; return source[3] === 0 && data[i + 3] === 0 || Math.max(Math.abs(data[i] - source[0]), Math.abs(data[i + 1] - source[1]), Math.abs(data[i + 2] - source[2])) <= threshold; };
  while (stack.length) {
    const p = stack.pop()!; if (visited[p] || !matches(p)) continue;
    const row = Math.floor(p / width), col = p % width; let left = col, right = col;
    while (left > 0 && !visited[row * width + left - 1] && matches(row * width + left - 1)) left--;
    while (right < width - 1 && !visited[row * width + right + 1] && matches(row * width + right + 1)) right++;
    runs.push([left, row, right - left + 1]); if (runs.length > MAX_FILL_RUNS) throw new Error('This fill is too detailed. Increase the tolerance or simplify this cel.');
    for (let c = left; c <= right; c++) visited[row * width + c] = 1;
    for (const yy of [row - 1, row + 1]) if (yy >= 0 && yy < height) {
      let previousMatched = false;
      for (let c = left; c <= right; c++) { const n = yy * width + c, matched = !visited[n] && matches(n); if (matched && !previousMatched) stack.push(n); previousMatched = matched; }
    }
  }
  return runs;
}
export function fillRegion(runs: [number, number, number][], width: number, height: number, scale: number): FillRegion {
  return { cellSize: 1 / scale, runs: runs.map(([x, y, w]) => [x / scale - width / 2, y / scale - height / 2, w / scale]) };
}
export function sampledColor(data: Uint8ClampedArray, width: number, height: number, at: Point): string | null {
  const x = Math.floor(at.x), y = Math.floor(at.y); if (x < 0 || y < 0 || x >= width || y >= height) return null;
  const i = (y * width + x) * 4; if (data[i + 3] === 0) return null;
  return rgbHex(data[i], data[i + 1], data[i + 2]);
}
