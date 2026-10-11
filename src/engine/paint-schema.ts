import { z } from 'zod';
import { BRUSH_KINDS, MAX_BRUSH_SIZE } from './brushes';

const finite = z.number().finite();
export const paintColorSchema = z.string().regex(/^#[a-f0-9]{6}$/i);
export const paintPointSchema = z.object({ x: finite.min(-100000).max(100000), y: finite.min(-100000).max(100000), pressure: finite.min(0).max(1).optional() });
export const brushSchema = z.object({
  kind: z.enum(BRUSH_KINDS), opacity: finite.min(0.01).max(1), flow: finite.min(0.01).max(1), hardness: finite.min(0).max(1),
  spacing: finite.min(0.02).max(2), smoothing: finite.min(0).max(1), sizePressure: z.boolean(), opacityPressure: z.boolean(),
  taper: finite.min(0).max(1), angle: finite.min(-180).max(180), roundness: finite.min(0.05).max(1), scatter: finite.min(0).max(1), grain: finite.min(0).max(1),
  pixelSize: finite.int().min(1).max(64), seed: finite.int().min(0).max(4294967295), blend: z.enum(['normal', 'multiply', 'screen']),
});
export const fillSchema = z.object({ cellSize: finite.min(0.01).max(64), runs: z.array(z.tuple([finite.min(-100000).max(100000), finite.min(-100000).max(100000), finite.min(0.01).max(20000)])).min(1).max(50000) });
export const strokeSchema = z.object({
  points: z.array(paintPointSchema).min(2).max(20000), color: z.string().regex(/^(#[0-9a-fA-F]{3,8}|none|transparent)$/), width: finite.min(0.5).max(MAX_BRUSH_SIZE),
  brush: brushSchema.optional(), mode: z.enum(['paint', 'erase']).optional(), fill: fillSchema.optional(),
}).refine(s => !s.fill || s.mode !== 'erase', 'A fill cannot also be an eraser.');
export const customPresetSchema = z.object({
  id: z.string().regex(/^custom-[a-zA-Z0-9_-]{1,80}$/), name: z.string().trim().min(1).max(48), category: z.literal('Custom'),
  size: finite.min(1).max(MAX_BRUSH_SIZE), brush: brushSchema, description: z.string().max(200),
});
export const paintSettingsSchema = z.object({
  updatedAt: finite.int().min(0).max(Number.MAX_SAFE_INTEGER).default(0), foregroundColor: paintColorSchema.optional(), brushSize: finite.min(1).max(MAX_BRUSH_SIZE).optional(), brush: brushSchema, presetId: z.string().max(100), backgroundColor: paintColorSchema, symmetry: z.enum(['none', 'vertical', 'horizontal', 'both']),
  palette: z.enum(['Studio', 'Earth', 'Pastel', 'Pixel 16']), recentColors: z.array(paintColorSchema).max(16), savedColors: z.array(paintColorSchema).max(32),
  customPresets: z.array(customPresetSchema).max(24), fillTolerance: finite.int().min(0).max(100),
}).refine(s => new Set(s.customPresets.map(p => p.id)).size === s.customPresets.length, 'Duplicate custom brush identifiers.');
export const brushPackSchema = z.object({ format: z.literal('luno-brushes'), version: z.literal(1), brushes: z.array(customPresetSchema).min(1).max(24), colors: z.array(paintColorSchema).max(32) });
/** Shared strict validator for the browser library and the native backup/settings boundary. */
export function validatePaintSettings(value: unknown) { return paintSettingsSchema.parse(value); }
