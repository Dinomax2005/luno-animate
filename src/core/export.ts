import type { Document, Scene } from "./model";
import { render, preload } from "./render";
import { decodeAudio } from "./media";
import { strToU8, zipSync } from "fflate";
export interface ExportOptions {
  all: boolean;
  work: boolean;
  longSide: number;
  audio: boolean;
  transparent: boolean;
}
export function plan(
  doc: Document,
  sceneId: string,
  options: Pick<ExportOptions, "all" | "work">,
) {
  return doc.scenes
    .filter((s) => options.all || s.id === sceneId)
    .flatMap((scene) => {
      const [start, end] = options.work ? scene.work : [0, scene.length - 1];
      return Array.from({ length: end - start + 1 }, (_, i) => ({
        scene,
        frame: start + i,
      }));
    });
}
function canvasFor(doc: Document, longSide: number) {
  const scale = Math.min(
      2,
      longSide / Math.max(doc.canvas.width, doc.canvas.height),
    ),
    canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round((doc.canvas.width * scale) / 2) * 2);
  canvas.height = Math.max(2, Math.round((doc.canvas.height * scale) / 2) * 2);
  return canvas;
}
const blob = (canvas: HTMLCanvasElement, type = "image/png") =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image encoding failed."))),
      type,
    ),
  );
export async function exportImage(
  doc: Document,
  scene: Scene,
  frame: number,
  longSide: number,
  transparent: boolean,
): Promise<Blob> {
  const canvas = canvasFor(doc, longSide);
  await preload(doc, scene, frame);
  render(canvas, doc, scene, frame, { transparent });
  return blob(canvas);
}
export async function exportSvg(
  doc: Document,
  scene: Scene,
  frame: number,
  longSide: number,
  transparent: boolean,
) {
  const canvas = canvasFor(doc, longSide);
  await preload(doc, scene, frame);
  render(canvas, doc, scene, frame, { transparent });
  return new Blob(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image width="100%" height="100%" href="${canvas.toDataURL("image/png")}"/></svg>`,
    ],
    { type: "image/svg+xml" },
  );
}
export async function exportSequence(
  doc: Document,
  sceneId: string,
  options: ExportOptions,
  progress: (p: number) => void,
  signal: AbortSignal,
) {
  const frames = plan(doc, sceneId, options);
  if (frames.length > 300)
    throw new Error(
      "PNG sequence limit: 300 frames per archive. Use a work area or export scenes separately.",
    );
  const canvas = canvasFor(doc, Math.min(1280, options.longSide)),
    files: Record<string, Uint8Array> = {};
  let total = 0;
  for (let i = 0; i < frames.length; i++) {
    signal.throwIfAborted();
    await preload(doc, frames[i].scene, frames[i].frame);
    render(canvas, doc, frames[i].scene, frames[i].frame, {
      transparent: options.transparent,
    });
    files[`frame-${String(i + 1).padStart(5, "0")}.png`] = new Uint8Array(
      await (await blob(canvas)).arrayBuffer(),
    );
    total += files[`frame-${String(i + 1).padStart(5, "0")}.png`].length;
    if (total > 100_000_000)
      throw new Error("PNG archive exceeds 100 MB. Export a shorter range.");
    progress((i + 1) / frames.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  files["sequence.json"] = strToU8(
    JSON.stringify(
      {
        fps: doc.canvas.fps,
        width: canvas.width,
        height: canvas.height,
        frames: frames.map((f) => ({
          scene: f.scene.name,
          frame: f.frame + 1,
        })),
      },
      null,
      2,
    ),
  );
  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
}
async function mix(
  doc: Document,
  frames: ReturnType<typeof plan>,
  signal: AbortSignal,
): Promise<AudioBuffer | null> {
  if (!frames.some((f) => f.scene.sounds.some((s) => !s.muted && s.gain)))
    return null;
  const context = new OfflineAudioContext(
      2,
      Math.ceil((frames.length / doc.canvas.fps) * 48000),
      48000,
    ),
    decoded = new Map<string, AudioBuffer>();
  let i = 0;
  while (i < frames.length) {
    const scene = frames[i].scene,
      first = frames[i].frame,
      start = i;
    while (i < frames.length && frames[i].scene.id === scene.id) i++;
    const length = i - start,
      last = first + length;
    for (const sound of scene.sounds) {
      signal.throwIfAborted();
      if (sound.muted || !sound.gain) continue;
      const at = Math.max(first, sound.start),
        end = Math.min(last, sound.end);
      if (end <= at) continue;
      let buffer = decoded.get(sound.asset);
      if (!buffer) {
        const asset = doc.assets.find((a) => a.id === sound.asset)!;
        buffer = await decodeAudio(asset, context);
        decoded.set(sound.asset, buffer);
      }
      const offset = sound.trim + (at - sound.start) / doc.canvas.fps,
        duration = Math.min(
          (end - at) / doc.canvas.fps,
          buffer.duration - offset,
        );
      if (duration <= 0) continue;
      const source = context.createBufferSource(),
        gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = sound.gain;
      source.connect(gain).connect(context.destination);
      source.start((start + at - first) / doc.canvas.fps, offset, duration);
    }
  }
  return context.startRendering();
}
export type Movie = "mp4" | "webm";

/** Which video/audio encoders this device offers for the requested container. */
export async function movieCapabilities(
  doc: Document,
  longSide: number,
  kind: Movie = "mp4",
) {
  const m = await import("mediabunny"),
    canvas = canvasFor(doc, longSide),
    video = (kind === "mp4" ? "avc" : "vp9") as "avc" | "vp9",
    audio = await m.getFirstEncodableAudioCodec(
      kind === "mp4" ? ["aac", "opus"] : ["opus", "vorbis"],
      { numberOfChannels: 2, sampleRate: 48000, bitrate: 128_000 },
    ),
    capable = await m.canEncodeVideo(video, {
      width: canvas.width,
      height: canvas.height,
      bitrate: kind === "mp4" ? 5_000_000 : 3_000_000,
    });
  return {
    video: capable ? video : null,
    audio,
    width: canvas.width,
    height: canvas.height,
  };
}
export async function mp4Capabilities(doc: Document, longSide: number) {
  return movieCapabilities(doc, longSide, "mp4");
}
export async function exportMovie(
  doc: Document,
  sceneId: string,
  options: ExportOptions,
  kind: Movie,
  progress: (p: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  const label = kind === "mp4" ? "MP4" : "WebM",
    frames = plan(doc, sceneId, options);
  if (frames.length / doc.canvas.fps > 120)
    throw new Error(
      `${label} render limit: 120 seconds per job. Use a shorter work area.`,
    );
  if (frames.length > 1800)
    throw new Error(
      `${label} render limit: 1,800 frames per job. Export a shorter work area or individual scenes.`,
    );
  const m = await import("mediabunny"),
    canvas = canvasFor(doc, options.longSide),
    target = new m.BufferTarget(),
    cap = await movieCapabilities(doc, options.longSide, kind);
  if (!cap.video)
    throw new Error(
      kind === "mp4"
        ? "H.264 encoding is unavailable on this device. Try WebM, the desktop build, or a PNG sequence."
        : "VP9 encoding is unavailable on this device. Try MP4 or a PNG sequence.",
    );
  const sound = options.audio ? await mix(doc, frames, signal) : null;
  if (sound && !cap.audio)
    throw new Error(
      `No supported ${label} audio encoder is available. Disable sound or use another device.`,
    );
  const output = new m.Output({
      format:
        kind === "mp4"
          ? new m.Mp4OutputFormat({ fastStart: "in-memory" })
          : new m.WebMOutputFormat(),
      target,
    }),
    video = new m.CanvasSource(canvas, {
      codec: cap.video,
      bitrate: kind === "mp4" ? 5_000_000 : 3_000_000,
    });
  output.addVideoTrack(video, { frameRate: doc.canvas.fps });
  let audio: InstanceType<typeof m.AudioBufferSource> | undefined;
  if (sound && cap.audio) {
    audio = new m.AudioBufferSource({ codec: cap.audio, bitrate: 128_000 });
    output.addAudioTrack(audio);
  }
  output.setMetadataTags({ title: doc.title });
  try {
    await output.start();
    if (audio && sound) await audio.add(sound);
    for (let i = 0; i < frames.length; i++) {
      signal.throwIfAborted();
      await preload(doc, frames[i].scene, frames[i].frame);
      render(canvas, doc, frames[i].scene, frames[i].frame);
      await video.add(i / doc.canvas.fps, 1 / doc.canvas.fps);
      progress((i + 1) / frames.length);
      if (i % 8 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    signal.throwIfAborted();
    await output.finalize();
    if (!target.buffer) throw new Error("The encoder produced no output.");
    return new Blob([target.buffer], {
      type: kind === "mp4" ? "video/mp4" : "video/webm",
    });
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  }
}
export function exportMp4(
  doc: Document,
  sceneId: string,
  options: ExportOptions,
  progress: (p: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  return exportMovie(doc, sceneId, options, "mp4", progress, signal);
}

export interface SpriteSheet {
  image: Blob;
  atlas: Blob;
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  frames: number;
}

/**
 * One PNG holding every rendered frame in a grid, plus a JSON companion that
 * names each cell. Game engines and web players read the pair directly.
 */
export async function exportSpriteSheet(
  doc: Document,
  sceneId: string,
  options: ExportOptions,
  columns: number,
  progress: (p: number) => void,
  signal: AbortSignal,
): Promise<SpriteSheet> {
  const frames = plan(doc, sceneId, options);
  if (frames.length > 400)
    throw new Error(
      "Sprite sheet limit: 400 frames per sheet. Use a work area or export scenes separately.",
    );
  const single = canvasFor(doc, Math.min(1024, options.longSide)),
    cell = Math.max(8, Math.round(single.width / 2) * 2),
    cellHeight = Math.max(8, Math.round(single.height / 2) * 2),
    across = Math.max(1, Math.min(columns, frames.length)),
    down = Math.ceil(frames.length / across),
    sheet = document.createElement("canvas");
  sheet.width = cell * across;
  sheet.height = cellHeight * down;
  if (
    sheet.width * sheet.height > 64_000_000 ||
    sheet.width > 16384 ||
    sheet.height > 16384
  )
    throw new Error(
      "That sheet would exceed 16384 px or 64 megapixels. Reduce the resolution, the column count or the range.",
    );
  const context = sheet.getContext("2d")!;
  const cells: { frame: number; scene: string; x: number; y: number }[] = [];
  for (let i = 0; i < frames.length; i++) {
    signal.throwIfAborted();
    await preload(doc, frames[i].scene, frames[i].frame);
    single.width = cell;
    single.height = cellHeight;
    context.clearRect(
      (i % across) * cell,
      Math.floor(i / across) * cellHeight,
      cell,
      cellHeight,
    );
    render(single, doc, frames[i].scene, frames[i].frame, {
      transparent: options.transparent,
    });
    context.drawImage(
      single,
      (i % across) * cell,
      Math.floor(i / across) * cellHeight,
    );
    cells.push({
      frame: frames[i].frame,
      scene: frames[i].scene.name,
      x: (i % across) * cell,
      y: Math.floor(i / across) * cellHeight,
    });
    progress((i + 1) / frames.length);
    if (i % 4 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  const image = await blob(sheet);
  const atlas = new Blob(
    [
      JSON.stringify(
        {
          format: "pegbar-studio-sprite",
          schema: 1,
          image: "spritesheet",
          width: sheet.width,
          height: sheet.height,
          cell: { width: cell, height: cellHeight },
          columns: across,
          rows: down,
          fps: doc.canvas.fps,
          frames: cells,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  return {
    image,
    atlas,
    columns: across,
    rows: down,
    frameWidth: cell,
    frameHeight: cellHeight,
    frames: frames.length,
  };
}
