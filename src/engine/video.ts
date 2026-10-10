import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeAudio, canEncodeVideo, type AudioCodec, type VideoCodec } from 'mediabunny';
import { activateScene, getScenes } from './project';
import { framePlan, videoDimensions, type AnimationExportOptions } from './frame-plan';
import { decodeClip } from '../services/audio';
import type { Project } from './types';
import { rasterize } from './export';

export interface VideoCapabilities { video: VideoCodec | null; audio: AudioCodec | null; width: number; height: number; note: string }
export async function mp4Capabilities(p: Project, longSide = 1920): Promise<VideoCapabilities> {
  const size = videoDimensions(p, longSide); let video: VideoCodec | null = null, audio: AudioCodec | null = null;
  if (typeof VideoEncoder !== 'undefined') for (const codec of ['avc', 'av1'] as VideoCodec[]) if (await canEncodeVideo(codec, { ...size, frameRate: p.fps, bitrate: 4_000_000 })) { video = codec; break; }
  if (typeof AudioEncoder !== 'undefined') for (const codec of ['aac', 'opus'] as AudioCodec[]) if (await canEncodeAudio(codec, { sampleRate: 48000, numberOfChannels: 2, bitrate: 160_000 })) { audio = codec; break; }
  const note = !video ? 'This device has no compatible MP4 video encoder. Try the current desktop app or Chrome/Edge; GIF and PNG still work.' : video === 'avc' ? audio === 'opus' ? 'H.264 video with Opus sound. For playback, use a modern browser or VLC.' : 'H.264 video, with AAC sound where supported. Plays in standard MP4 players.' : 'This device uses AV1 video in a real MP4 container (and Opus sound if AAC is unavailable). Use a modern browser or VLC; older players may need an AV1 codec.';
  return { video, audio, ...size, note };
}
async function mixAudio(project: Project, options: AnimationExportOptions, length: number, signal?: AbortSignal): Promise<AudioBuffer | null> {
  const scenes = options.scope === 'all' ? getScenes(project) : getScenes(project).filter(s => s.id === project.sceneId);
  if (options.includeAudio === false || !scenes.some(s => s.audio.some(a => !a.muted))) return null;
  const context = new OfflineAudioContext(2, Math.ceil(length * 48000), 48000); let offset = 0;
  const cache = new Map<string, AudioBuffer>();
  for (const scene of scenes) {
    const start = options.workArea ? scene.workArea.start : 0, end = options.workArea ? scene.workArea.end : scene.duration - 1;
    const duration = (end - start + 1) / project.fps;
    for (const clip of scene.audio.filter(c => !c.muted && c.volume > 0)) {
      signal?.throwIfAborted(); const clipStart = (clip.startFrame - start) / project.fps, when = Math.max(0, clipStart);
      const trim = clip.trimStart + Math.max(0, -clipStart); const remaining = Math.min(clip.duration - trim, duration - when);
      if (remaining <= 0) continue;
      let decoded = cache.get(clip.data); if (!decoded) { decoded = await decodeClip(clip, context); cache.set(clip.data, decoded); }
      signal?.throwIfAborted(); const playable = Math.min(remaining, decoded.duration - trim); if (playable <= 0) continue;
      const source = context.createBufferSource(); source.buffer = decoded; const gain = context.createGain(); gain.gain.value = clip.volume;
      source.connect(gain).connect(context.destination); source.start(offset + when, trim, playable);
    }
    offset += duration;
  }
  const buffer = await context.startRendering(); signal?.throwIfAborted();
  // Hard-limit a summed mix so accidental overlaps do not clip the encoder.
  for (let c = 0; c < buffer.numberOfChannels; c++) { const samples = buffer.getChannelData(c); for (let i = 0; i < samples.length; i++) samples[i] = Math.max(-1, Math.min(1, samples[i])); }
  return buffer;
}
export async function exportMp4(project: Project, options: AnimationExportOptions, onProgress: (value: number) => void, signal?: AbortSignal): Promise<Blob> {
  const frames = framePlan(project, options), duration = frames.length / project.fps;
  if (duration > 300 || frames.length > 18000) throw new Error('MP4 exports support up to five minutes / 18,000 frames. Choose a scene or a smaller work area.');
  signal?.throwIfAborted(); const capability = await mp4Capabilities(project, options.longSide);
  if (!capability.video) throw new Error(capability.note);
  const mixed = await mixAudio(project, options, duration, signal); onProgress(0.06);
  if (mixed && !capability.audio) throw new Error('This device cannot encode MP4 audio. Export without sound, or use the current desktop app.');
  const canvas = document.createElement('canvas'); canvas.width = capability.width; canvas.height = capability.height;
  const target = new BufferTarget(), output = new Output({ target, format: new Mp4OutputFormat({ fastStart: 'in-memory' }) });
  const video = new CanvasSource(canvas, { codec: capability.video, bitrate: 4_000_000 });
  output.addVideoTrack(video, { frameRate: project.fps }); output.setMetadataTags({ title: project.name, comment: 'Created with Luno Animate 0.2' });
  const audio = mixed && capability.audio ? new AudioBufferSource({ codec: capability.audio, bitrate: 160_000 }) : null;
  if (audio) output.addAudioTrack(audio);
  const cancel = () => { void output.cancel().catch(() => {}); }; signal?.addEventListener('abort', cancel, { once: true });
  try {
    signal?.throwIfAborted(); await output.start();
    const scenes = new Map(getScenes(project).map(s => [s.id, activateScene(project, s.id)]));
    const renderVideo = async () => {
      for (let n = 0; n < frames.length; n++) {
        signal?.throwIfAborted(); const f = frames[n]; await rasterize(scenes.get(f.sceneId)!, f.frame, canvas);
        await video.add(n / project.fps, 1 / project.fps, { keyFrame: n % (project.fps * 2) === 0 });
        onProgress(0.06 + (n + 1) / frames.length * 0.88);
        if (n % 3 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      video.close();
    };
    const encodeAudio = async () => { if (audio && mixed) { await audio.add(mixed); audio.close(); } };
    await Promise.all([renderVideo(), encodeAudio()]); signal?.throwIfAborted(); onProgress(0.97);
    await output.finalize(); signal?.throwIfAborted();
    if (!target.buffer || target.buffer.byteLength > 150_000_000) throw new Error('The MP4 exceeds the 150 MB export limit. Choose a smaller work area or lower resolution.');
    onProgress(1); return new Blob([target.buffer], { type: 'video/mp4' });
  } catch (error) { if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {}); if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError'); throw error; }
  finally { signal?.removeEventListener('abort', cancel); canvas.width = 0; canvas.height = 0; }
}
