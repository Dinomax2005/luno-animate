import { embeddedSize } from "./raster";
import { paintWork } from "./paint";
import { z } from "zod";
import { MAX_BYTES, MAX_FRAMES, type Document, type Key } from "./model";
const num = z.number().finite(),
  id = z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/)
    .refine((v) => !["constructor", "prototype", "__proto__"].includes(v)),
  frame = z
    .number()
    .int()
    .min(0)
    .max(MAX_FRAMES - 1),
  color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
const transform = z.object({
  x: num.min(-100000).max(100000),
  y: num.min(-100000).max(100000),
  scaleX: num.min(0.01).max(100),
  scaleY: num.min(0.01).max(100),
  rotation: num.min(-100000).max(100000),
  opacity: num.min(0).max(1),
});
export const brushSchema = z.object({
  tip: z.enum([
    "round",
    "ink",
    "soft",
    "pencil",
    "marker",
    "pixel",
    "charcoal",
    "spray",
  ]),
  size: num.min(1).max(256),
  opacity: num.min(0.01).max(1),
  flow: num.min(0.01).max(1),
  smoothing: num.min(0).max(0.95),
  pressure: z.boolean(),
  spacing: num.min(0.05).max(2),
});
const dataImage = z
  .string()
  .max(5_000_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/);
const mark = z.object({
  id,
  tool: z.enum(["brush", "erase", "fill"]),
  color,
  brush: brushSchema,
  points: z
    .array(
      z.object({
        x: num.min(-100000).max(100000),
        y: num.min(-100000).max(100000),
        p: num.min(0).max(1),
      }),
    )
    .min(1)
    .max(2048),
  seed: z.number().int().min(0).max(2147483647),
  bitmap: dataImage.optional(),
});
const channel = z
  .string()
  .regex(/^(x|y|scaleX|scaleY|rotation|opacity|bone:[a-zA-Z0-9_-]+)$/);
const key = z.object({
  id,
  frame,
  easing: z.enum(["linear", "smooth", "in", "out", "hold", "bezier"]),
  values: z.record(channel, num.min(-100000).max(100000)),
  curve: z
    .tuple([
      num.min(0).max(1),
      num.min(-2).max(3),
      num.min(0).max(1),
      num.min(-2).max(3),
    ])
    .optional(),
});
const bone = z.object({
  id,
  name: z.string().min(1).max(80),
  parent: id.nullable(),
  length: num.min(1).max(1000),
  angle: num.min(-3600).max(3600),
  min: num.min(-3600).max(3600),
  max: num.min(-3600).max(3600),
});
export const layerSchema = z.object({
  id,
  name: z.string().min(1).max(100),
  kind: z.enum(["paint", "shape", "text", "image", "rig", "group", "video"]),
  parent: id.nullable(),
  visible: z.boolean(),
  locked: z.boolean(),
  transform,
  keys: z.array(key).max(1800),
  width: num.min(1).max(4096),
  height: num.min(1).max(4096),
  color,
  stroke: color,
  line: num.min(0).max(256),
  shape: z.enum(["rect", "ellipse", "star"]).optional(),
  text: z.string().max(4000).optional(),
  fontSize: num.min(4).max(600).optional(),
  asset: id.optional(),
  sound: id.optional(),
  cels: z
    .array(z.object({ frame, marks: z.array(mark).max(512) }))
    .max(1800)
    .optional(),
  held: z.boolean().optional(),
  bones: z.array(bone).max(128).optional(),
  bind: z.object({ rig: id, bone: id }).optional(),
  start: frame,
  end: z.number().int().min(1).max(1800),
  sourceIn: num.min(0).max(7200),
  blend: z.enum(["source-over", "multiply", "screen"]),
});
const asset = z.object({
  id,
  kind: z.enum(["image", "audio", "video"]),
  name: z.string().min(1).max(100),
  data: z.string().max(32_000_000),
  width: z.number().int().min(0).max(4096),
  height: z.number().int().min(0).max(4096),
  duration: num.min(0).max(7200),
  fps: num.min(0).max(60),
  frames: z.array(dataImage).max(900),
  waveform: z.array(num.min(0).max(1)).max(256),
});
const scene = z.object({
  id,
  name: z.string().min(1).max(100),
  length: z.number().int().min(2).max(1800),
  background: color,
  layers: z.array(layerSchema).max(256),
  sounds: z
    .array(
      z.object({
        id,
        asset: id,
        name: z.string().min(1).max(100),
        start: frame,
        trim: num.min(0).max(7200),
        end: z.number().int().min(1).max(1800),
        gain: num.min(0).max(2),
        muted: z.boolean(),
      }),
    )
    .max(32),
  camera: z.object({
    x: num.min(-100000).max(100000),
    y: num.min(-100000).max(100000),
    zoom: num.min(0.1).max(10),
    keys: z.array(key).max(1800),
  }),
  work: z.tuple([frame, frame]),
});
export const documentSchema = z.object({
  // 1.0.x stored the same schema under `luno-studio`. Reading it here upgrades a
  // project in memory; the next save writes the current identity.
  format: z
    .union([z.literal("pegbar-studio"), z.literal("luno-studio")])
    .transform(() => "pegbar-studio" as const),
  schema: z.literal(1),
  id,
  title: z.string().min(1).max(100),
  canvas: z.object({
    width: z.number().int().min(64).max(4096),
    height: z.number().int().min(64).max(4096),
    fps: z.number().int().min(1).max(60),
  }),
  scenes: z.array(scene).min(1).max(32),
  assets: z.array(asset).max(64),
  references: z
    .array(
      z.object({
        id,
        asset: id,
        name: z.string().min(1).max(100),
        notes: z.string().max(2000),
      }),
    )
    .max(12),
  created: num.min(0),
});
function unique(items: { id: string }[], label: string) {
  if (new Set(items.map((x) => x.id)).size !== items.length)
    throw new Error(`Duplicate ${label} identifiers.`);
}
function checkKeys(keys: Key[], length: number, bones?: Set<string>) {
  const seen = new Set<number>();
  for (const k of keys) {
    if (k.frame >= length || seen.has(k.frame))
      throw new Error("Invalid or duplicate keyframe timing.");
    seen.add(k.frame);
    for (const [ch, value] of Object.entries(k.values)) {
      if (value === undefined || !Number.isFinite(value))
        throw new Error("Invalid keyed number.");
      if (
        ((ch === "scaleX" || ch === "scaleY") &&
          (value < 0.01 || value > 100)) ||
        (ch === "opacity" && (value < 0 || value > 1)) ||
        (ch.startsWith("bone:") && !bones?.has(ch.slice(5)))
      )
        throw new Error("Invalid keyed property.");
    }
  }
}
export function validateDocument(value: unknown): Document {
  const parsed = documentSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "Not a Pegbar Studio document. Pre-1.0 releases wrote an incompatible format; your current work is unchanged.",
    );
  const d = parsed.data as Document;
  unique(d.scenes, "scene");
  unique(d.assets, "asset");
  unique(d.references, "reference");
  const assets = new Map(d.assets.map((a) => [a.id, a]));
  for (const a of d.assets) {
    if (
      a.kind === "image" &&
      (!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(a.data) ||
        a.data.length > 5_000_000 ||
        !a.width ||
        !a.height ||
        a.width * a.height > 16_000_000)
    )
      throw new Error("Invalid image asset.");
    if (a.kind === "image") {
      const size = embeddedSize(a.data);
      if (size.width !== a.width || size.height !== a.height)
        throw new Error("Image dimensions do not match its raster.");
    }
    if (
      a.kind === "audio" &&
      !/^data:audio\/wav;base64,[a-zA-Z0-9+/=]+$/.test(a.data)
    )
      throw new Error("Invalid audio asset.");
    if (
      a.kind === "video" &&
      (!a.frames.length ||
        !a.fps ||
        a.frames.length / a.fps > 30 + 1 / a.fps ||
        a.width > 960 ||
        a.height > 960)
    )
      throw new Error("Invalid bounded video proxy.");
    if (a.kind === "video")
      for (const image of a.frames) {
        const size = embeddedSize(image);
        if (size.width !== a.width || size.height !== a.height)
          throw new Error("Video frame dimensions are inconsistent.");
      }
  }
  for (const r of d.references)
    if (assets.get(r.asset)?.kind !== "image")
      throw new Error("A reference image is missing.");
  for (const s of d.scenes) {
    unique(s.layers, "layer");
    unique(s.sounds, "sound");
    if (s.work[0] > s.work[1] || s.work[1] >= s.length)
      throw new Error("Invalid playback work area.");
    checkKeys(s.camera.keys, s.length);
    const nodes = new Map(s.layers.map((l) => [l.id, l]));
    let points = 0;
    for (const l of s.layers) {
      if (l.sound && !s.sounds.some((a) => a.id === l.sound))
        throw new Error("Linked sound is missing.");
      if (l.start >= l.end || l.end > s.length)
        throw new Error("Invalid layer timing.");
      if (l.parent && nodes.get(l.parent)?.kind !== "group")
        throw new Error("A parent group is missing.");
      const visited = new Set<string>();
      let p: typeof l | undefined = l;
      while (p) {
        if (visited.has(p.id)) throw new Error("Cyclic layer hierarchy.");
        visited.add(p.id);
        p = p.parent
          ? nodes.get(p.parent)
          : p.bind
            ? nodes.get(p.bind.rig)
            : undefined;
      }
      if (l.kind === "rig" && !l.bones?.length)
        throw new Error("A rig needs bones.");
      if (l.bones) {
        unique(l.bones, "bone");
        const bmap = new Map(l.bones.map((b) => [b.id, b]));
        for (const b of l.bones) {
          if (b.min > b.max) throw new Error("Invalid bone constraints.");
          const chain = new Set<string>();
          let cursor: typeof b | undefined = b;
          while (cursor) {
            if (chain.has(cursor.id)) throw new Error("Cyclic bone hierarchy.");
            chain.add(cursor.id);
            if (cursor.parent && !bmap.has(cursor.parent))
              throw new Error("Missing parent bone.");
            cursor = cursor.parent ? bmap.get(cursor.parent) : undefined;
          }
        }
      }
      checkKeys(l.keys, s.length, new Set(l.bones?.map((b) => b.id)));
      if (l.bind) {
        const rig = nodes.get(l.bind.rig);
        if (
          l.parent ||
          rig?.kind !== "rig" ||
          !rig.bones?.some((b) => b.id === l.bind!.bone)
        )
          throw new Error("Invalid bone attachment.");
      }
      if (l.kind === "video") {
        const a = assets.get(l.asset ?? "");
        if (
          a &&
          l.sourceIn + (l.end - l.start) / d.canvas.fps > a.duration + 1 / a.fps
        )
          throw new Error("Video clip extends beyond its proxy source.");
      }
      if (
        (l.kind === "image" && assets.get(l.asset ?? "")?.kind !== "image") ||
        (l.kind === "video" && assets.get(l.asset ?? "")?.kind !== "video")
      )
        throw new Error("Missing layer media.");
      if (l.cels) {
        const frames = new Set<number>();
        let max = 0;
        for (const c of l.cels) {
          if (c.frame >= s.length || frames.has(c.frame))
            throw new Error("Invalid drawing cel timing.");
          frames.add(c.frame);
          unique(c.marks, "mark");
          let count = 0;
          for (const m of c.marks) {
            if (m.bitmap) {
              const size = embeddedSize(m.bitmap);
              if (
                size.width !== Math.round(l.width) ||
                size.height !== Math.round(l.height)
              )
                throw new Error(
                  "Fill bitmap dimensions do not match the drawing layer.",
                );
            }
            if (
              (m.tool === "fill" && !m.bitmap) ||
              (m.tool !== "fill" && m.bitmap)
            )
              throw new Error("Invalid fill mark.");
            count += paintWork(m);
          }
          max = Math.max(max, count);
        }
        points += max;
      }
    }
    if (points > 250000)
      throw new Error(
        "This scene exceeds its painting detail budget. Split the work into scenes.",
      );
    for (const sound of s.sounds) {
      if (
        assets.get(sound.asset)?.kind !== "audio" ||
        sound.start >= sound.end ||
        sound.end > s.length ||
        sound.trim >= (assets.get(sound.asset)?.duration ?? 0)
      )
        throw new Error("Invalid sound clip.");
    }
  }
  if (new TextEncoder().encode(JSON.stringify(d)).length > MAX_BYTES)
    throw new Error("Project limit: 64 MB. No previous copy has been changed.");
  return d;
}
export function parseDocument(text: string): Document {
  if (text.length > MAX_BYTES) throw new Error("Project exceeds 64 MB.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Invalid project data.");
  }
  return validateDocument(raw);
}
