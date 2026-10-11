import { totalFrames, getScenes } from './project';
import type { Project, ProjectRecord } from './types';
export function projectRecord(p: Project, previous?: ProjectRecord, thumbnail?: string | null): ProjectRecord {
  const time = Date.now(); const items = getScenes(p).flatMap(s => s.items);
  return { id: p.id, name: p.name, createdAt: previous?.createdAt ?? time, updatedAt: time, starred: previous?.starred ?? false,
    deletedAt: previous?.deletedAt ?? null, thumbnail: thumbnail === undefined ? previous?.thumbnail ?? null : thumbnail,
    width: p.width, height: p.height, fps: p.fps, frames: totalFrames(p), scenes: p.sceneOrder.length,
    kind: p.animationMode === 'video-editing' ? 'Video editing' : p.animationMode === 'frame-by-frame' || items.some(i => i.type === 'drawing') ? 'Frame-by-frame' : items.some(i => i.type === 'character') ? 'Character animation' : items.some(i => i.type === 'text') ? 'Motion design' : '2D animation' };
}
