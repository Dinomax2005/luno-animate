import { rasterSize } from "./raster";
import { uid, type Asset } from "./model";
export function bytesToData(bytes: Uint8Array, type: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read media."));
    reader.readAsDataURL(
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type }),
    );
  });
}
export function dataBytes(data: string): Uint8Array {
  const raw = atob(data.slice(data.indexOf(",") + 1));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const title = (file: File) =>
  file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Media";
export async function importImage(file: File): Promise<Asset> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 16_000_000
  )
    throw new Error("Use a PNG, JPEG or WebP image up to 16 MB.");
  rasterSize(new Uint8Array(await file.arrayBuffer()));
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 16_000_000)
      throw new Error("Resize images larger than 16 megapixels first.");
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/webp", 0.92);
    if (data.length > 5_000_000)
      throw new Error("Image is too detailed for the embedded asset limit.");
    return {
      id: uid(),
      kind: "image",
      name: title(file),
      data,
      width: canvas.width,
      height: canvas.height,
      duration: 0,
      fps: 0,
      frames: [],
      waveform: [],
    };
  } finally {
    bitmap.close();
  }
}
export function wav(buffer: AudioBuffer): Uint8Array {
  const channels = Math.min(2, buffer.numberOfChannels),
    frames = buffer.length,
    bytes = new Uint8Array(44 + frames * channels * 2),
    v = new DataView(bytes.buffer);
  const str = (at: number, value: string) =>
    [...value].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, bytes.length - 8, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, bytes.length - 44, true);
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < channels; c++) {
      const x = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
      v.setInt16(
        44 + (i * channels + c) * 2,
        Math.round(x * (x < 0 ? 32768 : 32767)),
        true,
      );
    }
  return bytes;
}
async function audioAsset(buffer: AudioBuffer, name: string): Promise<Asset> {
  if (buffer.duration > 120)
    throw new Error(
      "Audio import supports 120-second embedded clips. Trim the source first.",
    );
  const channels = Math.min(2, buffer.numberOfChannels),
    context = new OfflineAudioContext(
      channels,
      Math.max(1, Math.ceil(buffer.duration * 22050)),
      22050,
    ),
    source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  const normalized = await context.startRendering(),
    data = await bytesToData(wav(normalized), "audio/wav"),
    waveform: number[] = [];
  const samples = normalized.getChannelData(0),
    step = Math.max(1, Math.floor(samples.length / 256));
  for (let i = 0; i < 256; i++) {
    let peak = 0;
    for (
      let j = i * step;
      j < Math.min((i + 1) * step, samples.length);
      j += Math.max(1, Math.floor(step / 50))
    )
      peak = Math.max(peak, Math.abs(samples[j]));
    waveform.push(Math.min(1, peak));
  }
  return {
    id: uid(),
    kind: "audio",
    name,
    data,
    width: 0,
    height: 0,
    duration: normalized.duration,
    fps: 0,
    frames: [],
    waveform,
  };
}
export async function importAudio(file: File): Promise<Asset> {
  if (file.size > 32_000_000) throw new Error("Audio input limit: 32 MB.");
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    return await audioAsset(buffer, title(file));
  } finally {
    await context.close();
  }
}
export async function importVideo(
  file: File,
  progress: (p: number) => void,
  signal: AbortSignal,
): Promise<{ video: Asset; audio?: Asset; audioNote: string }> {
  if (file.size > 100_000_000) throw new Error("Video input limit: 100 MB.");
  const m = await import("mediabunny"),
    input = new m.Input({
      source: new m.BlobSource(file),
      formats: m.ALL_FORMATS,
    });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode()))
      throw new Error("This video codec cannot be decoded on this device.");
    if (track.displayWidth * track.displayHeight > 16_000_000)
      throw new Error("Resize video larger than 16 megapixels first.");
    const duration = await track.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0 || duration > 30)
      throw new Error(
        "Video proxies support up to 30 seconds. Trim the source first.",
      );
    const scale = Math.min(
        1,
        960 / Math.max(track.displayWidth, track.displayHeight),
      ),
      width = Math.max(1, Math.round(track.displayWidth * scale)),
      height = Math.max(1, Math.round(track.displayHeight * scale)),
      fps = 20,
      times = Array.from(
        { length: Math.min(600, Math.ceil(duration * fps)) },
        (_, i) => i / fps,
      ),
      sink = new m.CanvasSink(track, {
        width,
        height,
        fit: "contain",
        poolSize: 2,
      }),
      canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!,
      frames: string[] = [];
    let bytes = 0;
    for await (const sample of sink.canvasesAtTimestamps(times)) {
      signal.throwIfAborted();
      if (!sample) throw new Error("A video frame could not be decoded.");
      ctx.drawImage(sample.canvas, 0, 0, width, height);
      const data = canvas.toDataURL("image/jpeg", 0.78);
      bytes += data.length;
      if (bytes > 48_000_000)
        throw new Error(
          "Video proxy exceeds 48 MB. Use a shorter or simpler source.",
        );
      frames.push(data);
      progress((frames.length / times.length) * 0.85);
    }
    const video: Asset = {
      id: uid(),
      kind: "video",
      name: title(file),
      data: "",
      width,
      height,
      duration: frames.length / fps,
      fps,
      frames,
      waveform: [],
    };
    let audio: Asset | undefined,
      audioNote = "No audio track.";
    const at = await input.getPrimaryAudioTrack();
    if (at) {
      if (await at.canDecode()) {
        const parts: { buffer: AudioBuffer; timestamp: number }[] = [];
        for await (const wrapped of new m.AudioBufferSink(at).buffers(
          0,
          duration,
        )) {
          signal.throwIfAborted();
          parts.push({ buffer: wrapped.buffer, timestamp: wrapped.timestamp });
        }
        const offline = new OfflineAudioContext(
          2,
          Math.ceil(duration * 22050),
          22050,
        );
        for (const part of parts) {
          const source = offline.createBufferSource();
          source.buffer = part.buffer;
          source.connect(offline.destination);
          source.start(Math.max(0, part.timestamp));
        }
        audio = await audioAsset(
          await offline.startRendering(),
          `${video.name} · audio`,
        );
        audioNote = "Audio extracted to a linked editable clip.";
      } else audioNote = "Audio codec unavailable; import sound separately.";
    }
    progress(1);
    return { video, audio, audioNote };
  } finally {
    input.dispose();
  }
}
export async function decodeAudio(
  asset: Asset,
  context: BaseAudioContext,
): Promise<AudioBuffer> {
  return context.decodeAudioData(dataBytes(asset.data).buffer as ArrayBuffer);
}
