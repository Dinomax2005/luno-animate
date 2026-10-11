import { uid } from './project';
import type { KeyChannel, Keyframe, KeyRef, Pose } from './types';

export const keyChannels: { property: KeyChannel; label: string }[] = [
  { property: 'x', label: 'Position X' }, { property: 'y', label: 'Position Y' },
  { property: 'scaleX', label: 'Scale X' }, { property: 'scaleY', label: 'Scale Y' },
  { property: 'rotation', label: 'Rotation' }, { property: 'opacity', label: 'Opacity' },
  { property: 'bones', label: 'Rig pose' }, { property: 'blur', label: 'Blur' },
  { property: 'brightness', label: 'Brightness' }, { property: 'saturation', label: 'Saturation' },
];
export const animatedChannels = (keys: Keyframe[]) => keyChannels.filter(c => keys.some(k => k.values[c.property] !== undefined));
export const sameKeyRef = (a: KeyRef, b: KeyRef) => a.itemId === b.itemId && a.frame === b.frame && a.channel === b.channel;
export function channelValues(key: Keyframe, channel?: KeyChannel): Pose {
  if (!channel) return { ...key.values, ...(key.values.bones ? { bones: { ...key.values.bones } } : {}) };
  const value = key.values[channel]; return value === undefined ? {} : { [channel]: channel === 'bones' ? { ...(value as Record<string, number>) } : value };
}
/** Delete a lane's channel, not the other transforms, effects, or rig pose at that frame. */
export function removeKeyChannel(keys: Keyframe[], frame: number, channel?: KeyChannel): Keyframe[] {
  const key = keys.find(k => k.frame === frame); if (!key || channel && key.values[channel] === undefined) return keys;
  if (!channel) return keys.filter(k => k !== key);
  const values = { ...key.values }; delete values[channel];
  return Object.keys(values).length ? keys.map(k => k === key ? { ...k, values } : k) : keys.filter(k => k !== key);
}
/** Merge overlapping values. Easing is still shared by channels at a frame in LAM v2. */
export function mergeChannelKey(keys: Keyframe[], incoming: Keyframe): Keyframe[] {
  if (!Object.keys(incoming.values).length) return keys;
  const existing = keys.find(k => k.frame === incoming.frame);
  const unrelated = existing && Object.keys(existing.values).some(p => incoming.values[p as KeyChannel] === undefined || p === 'bones' && Object.keys(existing.values.bones ?? {}).some(b => incoming.values.bones?.[b] === undefined));
  const metadata = unrelated ? existing : incoming;
  const values = { ...existing?.values, ...incoming.values, ...(existing?.values.bones && incoming.values.bones ? { bones: { ...existing.values.bones, ...incoming.values.bones } } : {}) };
  const merged: Keyframe = { id: existing?.id ?? incoming.id, frame: incoming.frame, easing: metadata!.easing, ...(metadata!.bezier ? { bezier: [...metadata!.bezier] as [number, number, number, number] } : {}), values };
  return [...keys.filter(k => k.frame !== incoming.frame), merged].sort((a, b) => a.frame - b.frame);
}
export function moveKeyChannel(keys: Keyframe[], from: number, to: number, channel?: KeyChannel): Keyframe[] {
  if (!Number.isFinite(to) || to < 0) return keys; to = Math.round(to);
  const original = keys.find(k => k.frame === from);
  if (!original || from === to || channel && original.values[channel] === undefined) return keys;
  const incoming = { ...original, id: channel ? uid() : original.id, frame: to, values: channelValues(original, channel) };
  return mergeChannelKey(removeKeyChannel(keys, from, channel), incoming);
}
