import { sampleItem } from './animation';
import { isLayerLocked } from './geometry';
import { getScenes, uid } from './project';
import type { AudioClip, Keyframe, Project, SceneItem } from './types';

export const clipRange = (item: SceneItem, duration: number) => ({ start: item.startFrame ?? 0, end: item.endFrame ?? duration });
export const clipActive = (item: SceneItem, frame: number) => frame >= (item.startFrame ?? 0) && frame < (item.endFrame ?? Infinity);
export function videoFrameData(project: Project, item: SceneItem, frame: number): string | undefined {
  if (!clipActive(item, frame)) return;
  const asset = project.media?.find(m => m.id === item.videoAssetId); if (!asset) return;
  const index = Math.floor(((item.sourceStart ?? 0) + (frame - (item.startFrame ?? 0)) / project.fps) * asset.fps + 1e-7);
  return asset.frames[index];
}
export function pruneMedia(project: Project): Project {
  const used = new Set(getScenes(project).flatMap(s => s.items.map(i => i.videoAssetId)));
  return { ...project, media: project.media.filter(m => used.has(m.id)) };
}
export type ClipEdit = 'trim-in' | 'trim-out' | 'split' | 'move';
/** Non-destructive edits. Asset frames are shared; boundaries are [start, end). */
export function editClip(project: Project, id: string, kind: ClipEdit, at: number): Project {
  const original = project.items.find(i => i.id === id);
  if (!original || original.type === 'group' || isLayerLocked(project.items, id) || !Number.isFinite(at)) return project;
  const { start, end } = clipRange(original, project.duration);
  const frame = Math.round(at), keys = project.keyframes[id] ?? [];
  const audio = project.audio.find(a => a.id === original.linkedAudioId);
  let item = { ...original }, tracks = project.audio, keyframes = project.keyframes;
  const replaceAudio = (patch: Partial<AudioClip>) => { if (audio) tracks = tracks.map(a => a.id === audio.id ? { ...a, ...patch } : a); };
  if (kind === 'trim-in') {
    const next = Math.max(start, Math.min(end - 1, frame)); if (next === start) return project;
    item = { ...item, startFrame: next, endFrame: end, ...(item.type === 'video' ? { sourceStart: (item.sourceStart ?? 0) + (next - start) / project.fps } : {}) };
    replaceAudio({ startFrame: next, trimStart: (audio?.trimStart ?? 0) + (next - start) / project.fps, endFrame: end });
  } else if (kind === 'trim-out') {
    const next = Math.max(start + 1, Math.min(end, frame + 1)); if (next === end) return project;
    item = { ...item, startFrame: start, endFrame: next }; replaceAudio({ endFrame: next });
  } else if (kind === 'move') {
    // Preserve every authored key/cel; do not silently clamp or discard them.
    const keyFrames = [...keys.map(k => k.frame), ...(original.cels?.map(c => c.frame) ?? [])];
    const low = Math.min(start, ...keyFrames), high = Math.max(end - 1, ...keyFrames);
    const delta = Math.max(-low, Math.min(1799 - high, frame - start)); if (!delta) return project;
    item = { ...item, startFrame: start + delta, endFrame: end + delta, ...(item.cels ? { cels: item.cels.map(c => ({ ...c, frame: c.frame + delta })) } : {}) };
    keyframes = { ...keyframes, [id]: keys.map(k => ({ ...k, frame: k.frame + delta })) }; replaceAudio({ startFrame: start + delta, endFrame: end + delta });
  } else {
    if (frame <= start || frame >= end || project.items.length >= 500 || audio && project.audio.length >= 32) return project;
    const rightId = uid(), rightAudioId = audio ? uid() : undefined;
    const right: SceneItem = { ...original, id: rightId, name: `${original.name} · 02`.slice(0, 100), startFrame: frame, endFrame: end, linkedAudioId: rightAudioId,
      ...(original.type === 'video' ? { sourceStart: (original.sourceStart ?? 0) + (frame - start) / project.fps } : {}) };
    const left = { ...original, startFrame: start, endFrame: frame };
    const items = project.items.flatMap(i => i.id === id ? [left, right] : [i]);
    tracks = audio ? tracks.flatMap(a => a.id === audio.id ? [{ ...a, endFrame: frame }, { ...a, id: rightAudioId!, name: `${a.name} · 02`.slice(0, 100), startFrame: frame, endFrame: end, trimStart: a.trimStart + (frame - start) / project.fps }] : [a]) : tracks;
    return { ...project, items, audio: tracks, keyframes: { ...keyframes, [rightId]: keys.map(k => ({ ...k, id: uid(), values: { ...k.values } })) } };
  }
  const duration = kind === 'move' ? Math.max(project.duration, item.endFrame ?? 0, ...(keyframes[id] ?? []).map(k => k.frame + 1), ...(item.cels ?? []).map(c => c.frame + 1)) : project.duration;
  return { ...project, duration, workArea: { ...project.workArea, end: Math.max(project.workArea.end, (item.endFrame ?? 0) - 1) }, items: project.items.map(i => i.id === id ? item : i), audio: tracks, keyframes };
}
/** Fade only writes opacity channels and merges with existing pose/effect keys. */
export function fadeClip(project: Project, id: string, kind: 'in' | 'out', seconds = 0.5): Project {
  const item = project.items.find(i => i.id === id); if (!item || isLayerLocked(project.items, id)) return project;
  const { start, end } = clipRange(item, project.duration);
  if (end - start < 2) return project;
  const length = Math.max(1, Math.min(end - start - 1, Math.round(seconds * project.fps)));
  const keys: Keyframe[] = [...(project.keyframes[id] ?? [])];
  const opacity = sampleItem(item, keys, kind === 'in' ? start + length : end - 1 - length).opacity;
  for (const [frame, value] of kind === 'in' ? [[start, 0], [start + length, opacity]] : [[end - 1 - length, opacity], [end - 1, 0]]) {
    const existing = keys.find(k => k.frame === frame);
    const key = { id: existing?.id ?? uid(), frame, easing: 'ease-in-out' as const, values: { ...existing?.values, opacity: value } };
    const index = keys.findIndex(k => k.frame === frame); if (index < 0) keys.push(key); else keys[index] = key;
  }
  return { ...project, keyframes: { ...project.keyframes, [id]: keys.sort((a, b) => a.frame - b.frame) } };
}
