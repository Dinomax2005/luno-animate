import { ALL_FORMATS, AudioBufferSink, BlobSource, CanvasSink, Input } from 'mediabunny';
import { createItem, uid } from '../engine/project';
import type { AudioClip, Project, SceneItem, VideoAsset } from '../engine/types';

export const VIDEO_IMPORT_LIMIT = { bytes: 150_000_000, seconds: 30, longSide: 960, dataCharacters: 24_000_000 } as const;
async function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not embed the video frame.')); reader.readAsDataURL(blob); });
}
function wav(channels: Float32Array[], rate: number): Blob {
  const length = channels[0].length, count = channels.length, bytes = new ArrayBuffer(44 + length * count * 2), view = new DataView(bytes);
  const text = (at: number, value: string) => [...value].forEach((c, n) => view.setUint8(at + n, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, count, true); view.setUint32(24, rate, true); view.setUint32(28, rate * count * 2, true); view.setUint16(32, count * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, length * count * 2, true);
  for (let n = 0; n < length; n++) for (let c = 0; c < count; c++) { const value = Math.max(-1, Math.min(1, channels[c][n])); view.setInt16(44 + (n * count + c) * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true); }
  return new Blob([bytes], { type: 'audio/wav' });
}
/** Decode once into bounded, embedded JPEG proxies. Original files are never changed. */
export async function importVideo(file: File, project: Project, startFrame: number, progress: (value: number, message: string) => void, signal: AbortSignal): Promise<{ asset: VideoAsset; item: SceneItem; audio?: AudioClip }> {
  if (!/\.(mp4|webm|mov|m4v)$/i.test(file.name)) throw new Error('Choose MP4, WebM, MOV, or M4V footage with a supported video codec.');
  if (file.size > VIDEO_IMPORT_LIMIT.bytes) throw new Error('Choose footage smaller than 150 MB.');
  signal.throwIfAborted();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const dispose = () => input.dispose(); signal.addEventListener('abort', dispose, { once: true });
  try {
    progress(0, 'Reading footage…');
    const track = await input.getPrimaryVideoTrack();
    if (!track || !await track.canDecode()) throw new Error('This device cannot decode this video codec. Try H.264 MP4 or VP8/VP9 WebM.');
    const duration = await input.computeDuration(), firstTimestamp = await track.getFirstTimestamp();
    if (!Number.isFinite(duration) || duration <= 0 || duration > VIDEO_IMPORT_LIMIT.seconds) throw new Error('Embedded video editing supports clips up to 30 seconds. Trim longer footage before importing.');
    const frames = Math.ceil(duration * project.fps - 1e-6);
    if (startFrame + frames > 1800) throw new Error('This clip would exceed the 1,800-frame scene limit. Import earlier in the timeline or into another scene.');
    const scale = Math.min(1, VIDEO_IMPORT_LIMIT.longSide / Math.max(track.displayWidth, track.displayHeight));
    const width = Math.max(1, Math.round(track.displayWidth * scale)), height = Math.max(1, Math.round(track.displayHeight * scale));
    const sink = new CanvasSink(track, { width, height, fit: 'contain', poolSize: 2 });
    const timestamps = Array.from({ length: frames }, (_, n) => Math.min(duration - 0.000001, Math.max(firstTimestamp, n / project.fps)));
    // Detached HTML canvas toBlob is an idle task in Chromium: a repainting studio can
    // starve it for seconds per frame. Encode on an OffscreenCanvas when available,
    // with a bounded synchronous fallback instead of waiting for browser idle time.
    const encodedCanvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
    encodedCanvas.width = width; encodedCanvas.height = height;
    const ctx = encodedCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error('This device cannot prepare video frames. Nothing has been imported.');
    const data: string[] = []; let characters = 0;
    for await (const canvas of sink.canvasesAtTimestamps(timestamps)) {
      signal.throwIfAborted(); if (!canvas) throw new Error('The footage contains an undecodable frame. Nothing has been imported.');
      ctx.drawImage(canvas.canvas, 0, 0, width, height);
      const url = encodedCanvas instanceof HTMLCanvasElement ? encodedCanvas.toDataURL('image/jpeg', 0.76) : await asDataUrl(await encodedCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.76 })); characters += url.length;
      if (characters > VIDEO_IMPORT_LIMIT.dataCharacters) throw new Error('The embedded proxy exceeds 24 MB. Use a shorter or smaller clip.');
      data.push(url); progress(data.length / frames * 0.82, `Preparing video · ${data.length} / ${frames} frames`);
    }
    if (data.length !== frames) throw new Error('The footage could not be fully decoded. Nothing has been imported.');
    let audio: AudioClip | undefined;
    const sound = await input.getPrimaryAudioTrack();
    if (sound) {
      progress(0.85, 'Preparing linked sound…');
      if (!await sound.canDecode()) throw new Error('The video’s audio codec is unsupported. Convert its sound to AAC or Opus before importing.');
      const rate = await sound.getSampleRate(), count = await sound.getNumberOfChannels();
      if (rate < 8000 || rate > 96000 || count < 1 || count > 8) throw new Error('Use footage with standard-rate mono or stereo audio.');
      const channels = Array.from({ length: Math.min(2, count) }, () => new Float32Array(Math.ceil(duration * rate)));
      for await (const part of new AudioBufferSink(sound).buffers(0, duration)) {
        signal.throwIfAborted(); const offset = Math.round(part.timestamp * rate);
        for (let c = 0; c < channels.length; c++) { const src = part.buffer.getChannelData(Math.min(c, part.buffer.numberOfChannels - 1)); const skip = Math.max(0, -offset), from = Math.max(0, offset), length = Math.min(src.length - skip, channels[c].length - from); if (length > 0) channels[c].set(src.subarray(skip, skip + length), from); }
      }
      const waveform = Array.from({ length: 192 }, (_, n) => { let peak = 0; const from = Math.floor(n / 192 * channels[0].length), end = Math.floor((n + 1) / 192 * channels[0].length); for (const channel of channels) for (let i = from; i < end; i += Math.max(1, Math.floor((end - from) / 100))) peak = Math.max(peak, Math.abs(channel[i])); return Math.min(1, peak); });
      audio = { id: uid(), name: `${file.name.replace(/\.[^.]+$/, '')} · sound`.slice(0, 100), data: await asDataUrl(wav(channels, rate)), duration, startFrame, endFrame: startFrame + frames, trimStart: 0, volume: 1, muted: false, waveform };
    }
    signal.throwIfAborted();
    const asset: VideoAsset = { id: uid(), name: file.name.slice(0, 100) || 'Footage', width, height, fps: project.fps, frames: data };
    const fit = Math.min(project.width / width, project.height / height);
    const item = createItem('video', { name: file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Footage', width, height, x: project.width / 2, y: project.height / 2, scaleX: fit, scaleY: fit, videoAssetId: asset.id, startFrame, endFrame: startFrame + frames, sourceStart: 0, linkedAudioId: audio?.id });
    progress(1, 'Adding footage to the timeline…'); return { asset, item, audio };
  } catch (error) { if (signal.aborted) throw new DOMException('Video import cancelled.', 'AbortError'); throw error; }
  finally { signal.removeEventListener('abort', dispose); input.dispose(); }
}
