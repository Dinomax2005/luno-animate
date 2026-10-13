import type { Document, Layer, Mark, Scene } from "./model";
import {
  bonesAt,
  celAt,
  channelAt,
  multiply,
  pose,
  unit,
  worldMatrix,
  type Matrix,
} from "./motion";
import { paintMark } from "./paint";
const images = new Map<string, HTMLImageElement>();
let notify = () => {},
  imageVersion = 0;
const paintCache = new WeakMap<
    object,
    {
      canvas: HTMLCanvasElement;
      version: number;
      width: number;
      height: number;
    }
  >(),
  cacheQueue: { key: object; canvas: HTMLCanvasElement }[] = [];
let cachedPixels = 0;
export function onImagesReady(callback: () => void) {
  notify = callback;
  return () => {
    notify = () => {};
  };
}
export function image(source: string): HTMLImageElement | undefined {
  if (!source) return;
  let value = images.get(source);
  if (!value) {
    value = new Image();
    value.onload = () => {
      imageVersion++;
      notify();
    };
    value.src = source;
    images.set(source, value);
    if (images.size > 40) images.delete(images.keys().next().value!);
  }
  return value.complete && value.naturalWidth ? value : undefined;
}
export async function preload(
  doc: Document,
  scene: Scene,
  frame: number,
): Promise<void> {
  const sources: string[] = [];
  for (const l of scene.layers) {
    const a = doc.assets.find((a) => a.id === l.asset);
    if (a?.kind === "image") sources.push(a.data);
    if (a?.kind === "video") {
      const i = Math.floor(
        (l.sourceIn + (frame - l.start) / doc.canvas.fps) * a.fps,
      );
      if (a.frames[i]) sources.push(a.frames[i]);
    }
    for (const m of celAt(l, frame)?.marks ?? [])
      if (m.bitmap) sources.push(m.bitmap);
  }
  await Promise.all(
    [...new Set(sources)].map(
      (source) =>
        new Promise<void>((resolve, reject) => {
          const ready = image(source);
          if (ready) {
            resolve();
            return;
          }
          const target = images.get(source)!;
          const timeout = setTimeout(
            () => reject(new Error("Image decoding timed out.")),
            12000,
          );
          target.addEventListener(
            "load",
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
          target.addEventListener(
            "error",
            () => {
              clearTimeout(timeout);
              reject(new Error("Embedded image is damaged."));
            },
            { once: true },
          );
        }),
    ),
  );
}
function ancestry(layer: Layer, scene: Scene, frame: number) {
  let opacity = 1,
    visible = true,
    current: Layer | undefined = layer;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    opacity *= pose(current, frame).opacity;
    visible &&=
      current.visible && frame >= current.start && frame < current.end;
    current = current.parent
      ? scene.layers.find((l) => l.id === current!.parent)
      : undefined;
  }
  return { opacity, visible };
}
export function cameraMatrix(
  doc: Document,
  scene: Scene,
  frame: number,
): Matrix {
  const x = channelAt(scene.camera.x, scene.camera.keys, "x", frame),
    y = channelAt(scene.camera.y, scene.camera.keys, "y", frame),
    zoom = channelAt(scene.camera.zoom, scene.camera.keys, "scaleX", frame);
  return [
    zoom,
    0,
    0,
    zoom,
    doc.canvas.width / 2 - x * zoom,
    doc.canvas.height / 2 - y * zoom,
  ];
}
export function paintCanvas(
  layer: Layer,
  frame: number,
  preview?: Mark,
): HTMLCanvasElement {
  const cel = celAt(layer, frame);
  if (cel && !preview) {
    const cached = paintCache.get(cel);
    if (
      cached &&
      cached.width === layer.width &&
      cached.height === layer.height &&
      (!cel.marks.some((m) => m.bitmap) || cached.version === imageVersion)
    )
      return cached.canvas;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(layer.width));
  canvas.height = Math.max(1, Math.round(layer.height));
  const ctx = canvas.getContext("2d")!;
  for (const m of [
    ...(celAt(layer, frame)?.marks ?? []),
    ...(preview ? [preview] : []),
  ])
    paintMark(ctx, m, m.bitmap ? image(m.bitmap) : undefined);
  if (cel && !preview) {
    paintCache.set(cel, {
      canvas,
      version: imageVersion,
      width: layer.width,
      height: layer.height,
    });
    cacheQueue.push({ key: cel, canvas });
    cachedPixels += canvas.width * canvas.height;
    while (cachedPixels > 16_000_000 && cacheQueue.length > 1) {
      const old = cacheQueue.shift()!;
      cachedPixels -= old.canvas.width * old.canvas.height;
      paintCache.delete(old.key);
      old.canvas.width = old.canvas.height = 0;
    }
  }
  return canvas;
}
function shape(ctx: CanvasRenderingContext2D, l: Layer) {
  ctx.beginPath();
  if (l.shape === "ellipse")
    ctx.ellipse(0, 0, l.width / 2, l.height / 2, 0, 0, Math.PI * 2);
  else if (l.shape === "star") {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.22 : 0.5,
        a = (i * Math.PI) / 5 - Math.PI / 2;
      const x = Math.cos(a) * l.width * r,
        y = Math.sin(a) * l.height * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  } else
    ctx.roundRect(
      -l.width / 2,
      -l.height / 2,
      l.width,
      l.height,
      Math.min(12, l.width / 10, l.height / 10),
    );
  ctx.fillStyle = l.color;
  ctx.fill();
  if (l.line) {
    ctx.strokeStyle = l.stroke;
    ctx.lineWidth = l.line;
    ctx.stroke();
  }
}
export function drawLayer(
  ctx: CanvasRenderingContext2D,
  doc: Document,
  scene: Scene,
  l: Layer,
  frame: number,
  preview?: Mark,
) {
  const state = ancestry(l, scene, frame);
  if (!state.visible || !state.opacity || l.kind === "group") return;
  ctx.save();
  ctx.globalAlpha *= state.opacity;
  ctx.globalCompositeOperation = l.blend;
  ctx.transform(...worldMatrix(l, scene.layers, frame));
  if (l.kind === "shape") shape(ctx, l);
  else if (l.kind === "text") {
    ctx.fillStyle = l.color;
    ctx.font = `500 ${l.fontSize ?? 64}px "Inter Variable", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [i, line] of (l.text ?? "").split("\n").entries())
      ctx.fillText(line, 0, i * (l.fontSize ?? 64) * 1.2, l.width);
  } else if (l.kind === "paint") {
    const scratch = paintCanvas(l, frame, preview);
    ctx.drawImage(scratch, -l.width / 2, -l.height / 2);
  } else if (l.kind === "rig") {
    const bones = bonesAt(l, frame);
    ctx.strokeStyle = l.color;
    ctx.lineCap = "round";
    for (const b of bones) {
      ctx.lineWidth = b.id === (l.bones ?? [])[0]?.id ? 20 : 13;
      ctx.beginPath();
      ctx.moveTo(b.start.x, b.start.y);
      ctx.lineTo(b.end.x, b.end.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.end.x, b.end.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = l.color;
      ctx.fill();
    }
    const head = bones.find(
      (b) => l.bones?.find((x) => x.id === b.id)?.name === "Head",
    );
    if (head) {
      ctx.beginPath();
      ctx.arc(head.end.x, head.end.y, 26, 0, Math.PI * 2);
      ctx.fillStyle = l.color;
      ctx.fill();
      ctx.fillStyle = "#1c1d1f";
      ctx.beginPath();
      ctx.arc(head.end.x + 8, head.end.y - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const a = doc.assets.find((a) => a.id === l.asset);
    const source =
        a?.kind === "video"
          ? a.frames[
              Math.floor(
                (l.sourceIn + (frame - l.start) / doc.canvas.fps) * a.fps,
              )
            ]
          : a?.data,
      img = source ? image(source) : undefined;
    if (img) ctx.drawImage(img, -l.width / 2, -l.height / 2, l.width, l.height);
    else {
      ctx.fillStyle = "#2b2d31";
      ctx.fillRect(-l.width / 2, -l.height / 2, l.width, l.height);
    }
  }
  ctx.restore();
}
export function render(
  canvas: HTMLCanvasElement,
  doc: Document,
  scene: Scene,
  frame: number,
  options: {
    transparent?: boolean;
    preview?: { layer: string; mark: Mark };
    camera?: boolean;
    onion?: boolean;
  } = {},
) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(canvas.width / doc.canvas.width, canvas.height / doc.canvas.height);
  if (!options.transparent) {
    ctx.fillStyle = scene.background;
    ctx.fillRect(0, 0, doc.canvas.width, doc.canvas.height);
  }
  if (options.camera !== false)
    ctx.transform(...cameraMatrix(doc, scene, frame));
  if (options.onion) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    for (const offset of [-1, 1])
      if (frame + offset >= 0 && frame + offset < scene.length)
        for (const l of scene.layers.filter((l) => l.kind === "paint"))
          drawLayer(ctx, doc, scene, l, frame + offset);
    ctx.restore();
  }
  for (const l of scene.layers)
    drawLayer(
      ctx,
      doc,
      scene,
      l,
      frame,
      options.preview?.layer === l.id ? options.preview.mark : undefined,
    );
  ctx.restore();
}
export async function thumbnail(
  doc: Document,
  scene = doc.scenes[0],
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = Math.max(
    1,
    Math.round((360 * doc.canvas.height) / doc.canvas.width),
  );
  await preload(doc, scene, 0);
  render(canvas, doc, scene, 0);
  return canvas.toDataURL("image/jpeg", 0.7);
}
export function visibleMatrix(
  doc: Document,
  scene: Scene,
  l: Layer,
  frame: number,
): Matrix {
  return multiply(
    cameraMatrix(doc, scene, frame),
    worldMatrix(l, scene.layers, frame),
  );
}
export { unit };
