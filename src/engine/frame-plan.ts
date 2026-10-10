import { getScenes } from './project';
import type { Project } from './types';
export interface AnimationExportOptions { scope?: 'scene' | 'all'; workArea?: boolean; longSide?: number; includeAudio?: boolean }
export interface PlannedFrame { sceneId: string; frame: number }
export function framePlan(p: Project, options: AnimationExportOptions = {}): PlannedFrame[] {
  const scenes = options.scope === 'all' ? getScenes(p) : getScenes(p).filter(s => s.id === p.sceneId);
  return scenes.flatMap(scene => { const start = options.workArea ? scene.workArea.start : 0, end = options.workArea ? scene.workArea.end : scene.duration - 1; return Array.from({ length: end - start + 1 }, (_, f) => ({ sceneId: scene.id, frame: start + f })); });
}
export function videoDimensions(p: Project, longSide = 1920) { const scale = Math.min(1, longSide / Math.max(p.width, p.height)); return { width: Math.max(2, Math.round(p.width * scale / 2) * 2), height: Math.max(2, Math.round(p.height * scale / 2) * 2) }; }
