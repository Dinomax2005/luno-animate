import type { Document, Scene } from "../core/model";
import { decodeAudio } from "../core/media";
export class PlaybackAudio {
  private context: AudioContext | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private generation = 0;
  private playing = false;
  private scene = "";
  private document = "";
  private started = 0;
  private frame = 0;
  private cache = new Map<string, Promise<AudioBuffer>>();
  stop() {
    this.generation++;
    for (const node of this.sources)
      try {
        node.stop();
      } catch {
        /* Already stopped. */
      }
    this.sources = [];
    this.playing = false;
  }
  update(
    document: Document,
    scene: Scene,
    frame: number,
    playing: boolean,
    onError: (message: string) => void,
  ) {
    if (this.document !== document.id) {
      this.stop();
      this.cache.clear();
      this.document = document.id;
    }
    if (!playing) {
      if (this.playing) this.stop();
      return;
    }
    const expected =
      this.frame +
      ((performance.now() - this.started) / 1000) * document.canvas.fps;
    if (
      this.playing &&
      this.scene === scene.id &&
      Math.abs(expected - frame) < 3
    )
      return;
    this.stop();
    this.playing = true;
    this.scene = scene.id;
    this.frame = frame;
    this.started = performance.now();
    const token = this.generation;
    this.context ??= new AudioContext();
    const context = this.context;
    void context
      .resume()
      .then(async () => {
        for (const clip of scene.sounds) {
          if (clip.muted || !clip.gain || frame >= clip.end) continue;
          const asset = document.assets.find((a) => a.id === clip.asset);
          if (!asset) continue;
          let decoded = this.cache.get(asset.id);
          if (!decoded) {
            decoded = decodeAudio(asset, context);
            this.cache.set(asset.id, decoded);
          }
          const buffer = await decoded;
          if (token !== this.generation) return;
          const currentFrame =
              this.frame +
              ((performance.now() - this.started) / 1000) * document.canvas.fps,
            at = Math.max(currentFrame, clip.start),
            offset = clip.trim + (at - clip.start) / document.canvas.fps,
            duration = Math.min(
              (clip.end - at) / document.canvas.fps,
              buffer.duration - offset,
            );
          if (duration <= 0) continue;
          const source = context.createBufferSource(),
            gain = context.createGain();
          source.buffer = buffer;
          gain.gain.value = clip.gain;
          source.connect(gain).connect(context.destination);
          source.start(
            context.currentTime +
              Math.max(0, (at - currentFrame) / document.canvas.fps),
            offset,
            duration,
          );
          this.sources.push(source);
        }
      })
      .catch(() =>
        onError(
          "Audio playback is unavailable. Click Play again or check this device’s audio permissions.",
        ),
      );
  }
  dispose() {
    this.stop();
    void this.context?.close();
    this.context = null;
    this.cache.clear();
  }
}
