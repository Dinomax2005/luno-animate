import type { AudioClip, Project } from '../engine/types';
import { uid } from '../engine/project';
export const AUDIO_LIMIT_SECONDS = 300;
async function metadataDuration(blob: Blob): Promise<number> {
  const url = URL.createObjectURL(blob), audio = new Audio(); audio.preload = 'metadata';
  try { return await new Promise((resolve, reject) => { const timer = setTimeout(() => { audio.removeAttribute('src'); reject(new Error('Could not read this audio file.')); }, 15_000); audio.onloadedmetadata = () => { clearTimeout(timer); Number.isFinite(audio.duration) && audio.duration > 0 ? resolve(audio.duration) : reject(new Error('Choose an audio file with a finite duration.')); }; audio.onerror = () => { clearTimeout(timer); reject(new Error('This audio format is not supported by your device.')); }; audio.src = url; }); }
  finally { audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); }
}
export async function audioFromFile(file: File, startFrame: number): Promise<AudioClip> {
  if (file.size > 20_000_000) throw new Error('Choose an audio file smaller than 20 MB.');
  const ext = file.name.split('.').at(-1)?.toLowerCase();
  const mime = ({ mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', webm: 'audio/webm' } as Record<string, string>)[ext ?? ''];
  if (!mime) throw new Error('Choose MP3, WAV, OGG, M4A, AAC, FLAC, or WebM audio.');
  const blob = new Blob([await file.arrayBuffer()], { type: mime });
  if (await metadataDuration(blob) > AUDIO_LIMIT_SECONDS) throw new Error('Audio clips support up to five minutes. Trim a longer recording before importing.');
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    if (buffer.duration > AUDIO_LIMIT_SECONDS) throw new Error('This audio clip is too long.');
    const waveform = Array.from({ length: 192 }, (_, n) => {
      const start = Math.floor(n / 192 * buffer.length), end = Math.max(start + 1, Math.floor((n + 1) / 192 * buffer.length)); let peak = 0;
      for (let c = 0; c < buffer.numberOfChannels; c++) { const channel = buffer.getChannelData(c); for (let i = start; i < end; i += Math.max(1, Math.floor((end - start) / 100))) peak = Math.max(peak, Math.abs(channel[i])); }
      return Math.min(1, peak);
    });
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
    return { id: uid(), name: file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Sound', data, duration: buffer.duration, startFrame, trimStart: 0, volume: 1, muted: false, waveform };
  } finally { await context.close(); }
}
/** Realtime sound follows scene playback and seeks on loop/scrub without starting during editing. */
export class AudioPlayback {
  private tracks = new Map<string, { data: string; element: HTMLAudioElement }>();
  private warned = false;
  update(project: Project, frame: number, playing: boolean, onError: () => void) {
    for (const [id, track] of this.tracks) if (!project.audio.some(a => a.id === id)) { track.element.pause(); track.element.removeAttribute('src'); this.tracks.delete(id); }
    for (const clip of project.audio) {
      let track = this.tracks.get(clip.id);
      if (!track || track.data !== clip.data) { track?.element.pause(); const element = new Audio(clip.data); element.preload = 'metadata'; track = { data: clip.data, element }; this.tracks.set(clip.id, track); }
      const element = track.element, time = (frame - clip.startFrame) / project.fps + clip.trimStart;
      const active = playing && !clip.muted && frame >= clip.startFrame && time < clip.duration && frame < (clip.endFrame ?? Infinity);
      element.volume = Math.min(1, clip.volume);
      if (!active) { element.pause(); continue; }
      if (Math.abs(element.currentTime - time) > 0.15) { try { element.currentTime = time; } catch { /* Metadata is still loading. */ } }
      if (element.paused) void element.play().catch(() => { if (!this.warned) { this.warned = true; onError(); } });
    }
  }
  dispose() { for (const t of this.tracks.values()) { t.element.pause(); t.element.removeAttribute('src'); } this.tracks.clear(); }
}
export async function decodeClip(clip: AudioClip, context: BaseAudioContext): Promise<AudioBuffer> {
  const blob = await (await fetch(clip.data)).blob();
  if (await metadataDuration(blob) > AUDIO_LIMIT_SECONDS) throw new Error(`“${clip.name}” is longer than five minutes. Trim it before exporting.`);
  const buffer = await context.decodeAudioData(await blob.arrayBuffer());
  if (buffer.duration > AUDIO_LIMIT_SECONDS) throw new Error('An audio clip exceeds the export limit.');
  return buffer;
}
