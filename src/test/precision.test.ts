import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clipMoveBounds, clipTrimBounds, editClip, snapClipEdit, videoFrameData } from '../engine/clips';
import { animatedChannels, mergeChannelKey, moveKeyChannel, removeKeyChannel } from '../engine/keyframes';
import { createItem, createProject, parseProject } from '../engine/project';
import type { Keyframe, Project } from '../engine/types';
import { useEditor } from '../store/editor';
import { defaultLayout, layoutForWorkspace, useWorkspace, validateWorkspaceProfiles, WORKSPACE_KEY, WORKSPACE_PROFILES_KEY } from '../store/workspace';
const s = () => useEditor.getState(), w = () => useWorkspace.getState();
const jpeg = 'data:image/jpeg;base64,/9j/2Q==';
function footage(): Project {
  const p = createProject('blank', 'video-editing'); p.fps = 10; p.duration = 40; p.workArea = { start: 0, end: 39 };
  p.media = [{ id: 'asset', name: 'Source', width: 100, height: 100, fps: 10, frames: Array.from({ length: 20 }, () => jpeg) }];
  p.items = [createItem('video', { id: 'clip', name: 'Clip', videoAssetId: 'asset', linkedAudioId: 'sound', sourceStart: 0, startFrame: 5, endFrame: 25 })];
  p.audio = [{ id: 'sound', name: 'Linked sound', data: 'data:audio/wav;base64,UklGRg==', duration: 2, startFrame: 5, endFrame: 25, trimStart: 0, volume: 1, muted: false, waveform: [0, .5, 0] }]; return p;
}
function keyed(): Project {
  const p = createProject('character'), item = p.items.find(i => i.rig)!; p.items = [item];
  const bone = item.rig!.bones[0].id;
  p.keyframes[item.id] = [
    { id: 'first', frame: 0, easing: 'linear', values: { x: 10, y: 20, opacity: 1, bones: { [bone]: 25 } } },
    { id: 'target', frame: 10, easing: 'hold', values: { y: 150, blur: 5, bones: { [bone]: 35 } } },
  ]; return p;
}
beforeEach(() => {
  s().replaceProject(createProject('blank'), false);
  useEditor.setState({ busy: false, blockReason: null, interacting: false, dialog: null, keySelection: [], keyClipboard: [], preferences: { ...s().preferences, autoKey: true } });
  useWorkspace.setState({ ...defaultLayout, profiles: {}, focused: false, popout: null, cursor: null });
});
afterEach(() => vi.useRealTimers());

describe('restorable, non-destructive source handles', () => {
  it('restores both ends and linked sound, without restoring by Undo or copying assets', () => {
    const p = footage(); let n = editClip(p, 'clip', 'trim-in', 10); n = editClip(n, 'clip', 'trim-out', 14);
    expect(n.items[0]).toMatchObject({ startFrame: 10, endFrame: 15, sourceStart: .5 });
    expect(n.audio[0]).toMatchObject({ startFrame: 10, endFrame: 15, trimStart: .5 });
    n = editClip(n, 'clip', 'trim-in', 5); n = editClip(n, 'clip', 'trim-out', 24);
    expect(n.items).toEqual(p.items); expect(n.audio).toEqual(p.audio); expect(n.media).toBe(p.media); expect(parseProject(JSON.stringify(n))).toEqual(n);
  });
  it('does not extend before the source in, beyond the source out, or beyond the scene', () => {
    const p = footage(); expect(clipTrimBounds(p, p.items[0])).toEqual({ minStart: 5, maxEnd: 25 });
    expect(editClip(p, 'clip', 'trim-in', -100)).toBe(p); expect(editClip(p, 'clip', 'trim-out', 100)).toBe(p);
    const n = editClip(editClip(p, 'clip', 'trim-in', 10), 'clip', 'trim-out', 11);
    expect(editClip(n, 'clip', 'trim-in', -100).items[0].startFrame).toBe(5);
    expect(editClip(n, 'clip', 'trim-out', 100).items[0].endFrame).toBe(25);
  });
  it('bounds restored handles by linked sound as well as video', () => {
    const p = footage(); p.items[0] = { ...p.items[0], startFrame: 10, endFrame: 15, sourceStart: 1 };
    p.audio[0] = { ...p.audio[0], startFrame: 10, endFrame: 15, trimStart: .5, duration: 1.5 };
    expect(clipTrimBounds(p, p.items[0])).toEqual({ minStart: 5, maxEnd: 20 });
    const n = editClip(p, 'clip', 'trim-in', 0); expect(n.items[0].sourceStart).toBe(.5); expect(n.audio[0].trimStart).toBe(0);
  });
  it('retains the last valid proxy frame when asset and scene FPS differ', () => {
    const p = footage(); p.media[0] = { ...p.media[0], fps: 12, frames: p.media[0].frames.slice(0, 13) };
    p.items[0].endFrame = 10; p.audio = []; delete p.items[0].linkedAudioId;
    const n = editClip(p, 'clip', 'trim-out', 39); expect(n.items[0].endFrame).toBe(16);
    expect(videoFrameData(n, n.items[0], 15)).toBe(jpeg); expect(videoFrameData(n, n.items[0], 16)).toBeUndefined();
  });
  it('treats either edge click as a no-op and creates no undo checkpoint', () => {
    const p = footage(); s().replaceProject(p, false); s().editClip('clip', 'trim-in', 5); s().editClip('clip', 'trim-out', 24);
    expect(s().project).toBe(p); expect(s().history).toHaveLength(0);
  });
  it('preserves keys/cels outside a trimmed range and uses them to bound movement', () => {
    const p = footage(); p.items[0].cels = [{ frame: 2, strokes: [] }]; p.keyframes.clip = [{ id: 'outside', frame: 35, easing: 'linear', values: { x: 10 } }];
    expect(clipMoveBounds(p, p.items[0])).toEqual({ minStart: 3, maxStart: 1769 });
    const n = editClip(p, 'clip', 'trim-out', 11); expect(n.keyframes).toBe(p.keyframes); expect(n.items[0].cels).toBe(p.items[0].cels);
  });
});

describe('magnetic alignment and an exact bypass', () => {
  it('snaps a moved clip’s trailing boundary to its neighbor', () => {
    const p = footage(); p.items.push(createItem('shape', { name: 'Neighbor', startFrame: 30, endFrame: 40 }));
    const n = snapClipEdit(p, p.items[0], 'move', 8, 0, 2);
    expect(n).toMatchObject({ at: 10, range: { start: 10, end: 30 }, snap: { frame: 30, label: 'Neighbor' } });
    expect(editClip(p, 'clip', 'move', n.at).items[0]).toMatchObject({ startFrame: 10, endFrame: 30 });
  });
  it('prefers the nearest valid playhead and leaves exact edits unsnapped when bypassed', () => {
    const p = footage(); expect(snapClipEdit(p, p.items[0], 'move', 8, 9, 2).at).toBe(9);
    expect(snapClipEdit(p, p.items[0], 'move', 8, 9, 0)).toMatchObject({ at: 8, snap: null });
  });
  it('snaps exclusive trim-out boundaries but refuses unavailable source frames', () => {
    const p = footage(); let n = snapClipEdit(p, p.items[0], 'trim-out', 20, 22, 2);
    expect(n).toMatchObject({ at: 21, range: { start: 5, end: 22 }, snap: { frame: 22 } });
    n = snapClipEdit(p, p.items[0], 'trim-out', 26, 28, 3); expect(n.range.end).toBe(25); expect(n.snap?.frame).not.toBe(28);
  });
  it('uses the actual pixel-tolerant pointer position before integer-frame quantization', () => {
    const p = footage(), n = snapClipEdit(p, p.items[0], 'trim-out', 20.7, 22, .4);
    expect(n).toMatchObject({ at: 21, range: { start: 5, end: 22 }, snap: { frame: 22 } });
    expect(snapClipEdit(p, p.items[0], 'trim-out', 20.4, 22, .4).snap).toBeNull();
  });
  it('does not snap back to the clip’s own linked sound', () => {
    const p = footage(), n = snapClipEdit(p, p.items[0], 'move', 7, 35, 2);
    expect(n.at).toBe(7); expect(n.snap).toBeNull();
  });
});

describe('property-lane editing without unrelated channel loss', () => {
  it('lists only authored channels, including rig poses', () => {
    const p = keyed(); expect(animatedChannels(p.keyframes[p.items[0].id]).map(c => c.property)).toEqual(['x', 'y', 'opacity', 'bones', 'blur']);
  });
  it('moves one property into an occupied key and preserves both rig poses and other values', () => {
    const p = keyed(), keys = p.keyframes[p.items[0].id], n = moveKeyChannel(keys, 0, 10, 'x');
    expect(n[0].values).toEqual({ y: 20, opacity: 1, bones: keys[0].values.bones });
    expect(n[1].values).toEqual({ ...keys[1].values, x: 10 }); expect(n[1].easing).toBe('hold');
    expect(keys[0].values.x).toBe(10); expect(n[0].id).not.toBe(n[1].id);
  });
  it('removes a channel and removes the physical key only when its final value is deleted', () => {
    const keys: Keyframe[] = [{ id: 'a', frame: 0, easing: 'linear', values: { x: 1, y: 2 } }];
    const n = removeKeyChannel(keys, 0, 'x'); expect(n[0].values).toEqual({ y: 2 });
    expect(removeKeyChannel(n, 0, 'y')).toEqual([]); expect(removeKeyChannel(keys, 0, 'blur')).toBe(keys);
  });
  it('gives a split-out property a fresh ID, and moving nowhere is a no-op', () => {
    const p = keyed(), keys = p.keyframes[p.items[0].id], n = moveKeyChannel(keys, 0, 5, 'x');
    expect(n[1].values).toEqual({ x: 10 }); expect(n[1].id).not.toBe(keys[0].id);
    expect(moveKeyChannel(keys, 0, 0, 'x')).toBe(keys); expect(moveKeyChannel(keys, 0, NaN, 'x')).toBe(keys);
  });
  it('merges whole-key overlaps without discarding destination effects or rig values', () => {
    const keys: Keyframe[] = [{ id: 'a', frame: 10, easing: 'bezier', bezier: [.2, 0, .8, 1], values: { blur: 2, bones: { a: 10, b: 20 } } }];
    const n = mergeChannelKey(keys, { id: 'b', frame: 10, easing: 'linear', values: { x: 10, bones: { a: 90 } } });
    expect(n[0].values).toEqual({ blur: 2, x: 10, bones: { a: 90, b: 20 } }); expect(n[0].bezier).toEqual(keys[0].bezier);
  });
  it('copies only selected lanes, merges paste, and undoes the paste in one transaction', () => {
    const p = keyed(), id = p.items[0].id; s().replaceProject(p, false); s().select(id); s().selectKey(id, 0, false, 'x'); s().selectKey(id, 0, true, 'opacity'); s().copyKeys();
    expect(s().keyClipboard).toHaveLength(1); expect(s().keyClipboard[0].key.values).toEqual({ x: 10, opacity: 1 });
    s().setFrame(10); s().pasteKeys(); const n = s().project;
    expect(n.keyframes[id][1].values).toEqual({ ...p.keyframes[id][1].values, x: 10, opacity: 1 }); expect(s().history).toHaveLength(1); expect(parseProject(JSON.stringify(n))).toEqual(n);
    s().undo(); expect(s().project).toEqual(p);
  });
  it('deletes selected property keys without touching unselected channels', () => {
    const p = keyed(), id = p.items[0].id; s().replaceProject(p, false); s().selectKey(id, 0, false, 'x'); s().deleteKeys();
    expect(s().project.keyframes[id][0].values).toEqual({ y: 20, opacity: 1, bones: p.keyframes[id][0].values.bones }); expect(s().history).toHaveLength(1);
  });
  it('canonicalizes mixed whole-key and property selections', () => {
    const p = keyed(), id = p.items[0].id; s().replaceProject(p, false); s().selectKey(id, 0); s().selectKey(id, 0, true, 'x'); expect(s().keySelection).toEqual([{ itemId: id, frame: 0 }]);
    s().selectKey(id, 0, false, 'x'); s().selectKey(id, 0, true, 'y'); s().selectKey(id, 0, true); expect(s().keySelection).toEqual([{ itemId: id, frame: 0 }]);
  });
  it('refuses locked or protected channel edits without useless history', () => {
    const p = keyed(), id = p.items[0].id; p.items[0].locked = true; s().replaceProject(p, false); s().selectKey(id, 0, false, 'x'); s().deleteKeys(); s().moveKeyframe(id, 0, 5, 'x');
    expect(s().project).toBe(p); expect(s().history).toHaveLength(0);
    p.items[0].locked = false; useEditor.setState({ busy: true }); s().removeKeyframe(id, 0, 'x'); expect(s().history).toHaveLength(0);
  });
  it('records a continuous animated-property gesture as one undoable edit', () => {
    const p = keyed(), id = p.items[0].id; s().replaceProject(p, false); s().select(id); s().setFrame(10); s().checkpoint();
    for (const value of [.8, .6, .4]) s().editMotionProperty('opacity', value, false);
    expect(s().project.keyframes[id][1].values).toMatchObject({ opacity: .4, y: 150 }); expect(s().history).toHaveLength(1); s().undo(); expect(s().project).toEqual(p);
  });
});

describe('independent remembered workspace profiles', () => {
  it('restores each mode’s own dock dimensions, visibility, zoom, and snapping', () => {
    const project = s().project; w().preset('Motion'); w().setLayout({ rightWidth: 355, timelineHeight: 420, frameWidth: 16, timelineSnap: false, showLayers: false });
    w().preset('Video editing'); w().setLayout({ rightWidth: 290, frameWidth: 6 }); w().preset('Motion');
    expect(w()).toMatchObject({ rightWidth: 355, timelineHeight: 420, frameWidth: 16, timelineSnap: false, showLayers: false });
    w().preset('Video editing'); expect(w()).toMatchObject({ rightWidth: 290, frameWidth: 6 }); expect(s().project).toBe(project); expect(s().history).toHaveLength(0);
  });
  it('resets only the current profile, leaving other workspaces customized', () => {
    w().preset('Video editing'); w().setLayout({ rightWidth: 360 }); w().preset('Motion'); w().setLayout({ rightWidth: 355 }); w().reset();
    expect(w()).toMatchObject(layoutForWorkspace('Motion')); w().preset('Video editing'); expect(w().rightWidth).toBe(360);
  });
  it('persists sanitized profiles separately from the backward-compatible active layout', () => {
    vi.useFakeTimers(); w().preset('Motion'); w().setLayout({ frameWidth: 20 }); w().preset('Video editing'); w().setLayout({ timelineSnap: false }); vi.advanceTimersByTime(181);
    const profiles = JSON.parse(localStorage.getItem(WORKSPACE_PROFILES_KEY)!); expect(profiles.Motion.frameWidth).toBe(20); expect(profiles['Video editing'].timelineSnap).toBe(false);
    expect(Object.keys(JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)).sort()).toEqual(Object.keys(defaultLayout).sort());
    expect(JSON.stringify(profiles)).not.toMatch(/cursor|project|focused|popout/);
  });
  it('rejects unknown profiles, bounds corrupt dimensions, and keeps contextual defaults', () => {
    const profiles = validateWorkspaceProfiles({ Motion: { rightWidth: 999, timelineSnap: 'yes' }, 'Video editing': {}, bogus: { project: 'art' } });
    expect(profiles.Motion).toMatchObject({ workspace: 'Motion', rightWidth: 460, timelineSnap: true, frameWidth: 8 });
    expect(profiles['Video editing']).toEqual(layoutForWorkspace('Video editing')); expect(profiles).not.toHaveProperty('bogus');
    expect(validateWorkspaceProfiles(null)).toEqual({}); expect(validateWorkspaceProfiles([])).toEqual({});
  });
});
