export type Workspace = "Draw" | "Motion" | "Edit";
export type Tool =
  | "select"
  | "hand"
  | "brush"
  | "erase"
  | "fill"
  | "picker"
  | "rect"
  | "ellipse"
  | "text"
  | "rig";
export type Tip =
  | "round"
  | "ink"
  | "soft"
  | "pencil"
  | "marker"
  | "pixel"
  | "charcoal"
  | "spray";
export interface Point {
  x: number;
  y: number;
  p: number;
}
export interface Brush {
  tip: Tip;
  size: number;
  opacity: number;
  flow: number;
  smoothing: number;
  pressure: boolean;
  spacing: number;
}
export interface Mark {
  id: string;
  tool: "brush" | "erase" | "fill";
  color: string;
  brush: Brush;
  points: Point[];
  seed: number;
  bitmap?: string;
}
export interface Cel {
  frame: number;
  marks: Mark[];
}
export type Channel =
  | "x"
  | "y"
  | "scaleX"
  | "scaleY"
  | "rotation"
  | "opacity"
  | `bone:${string}`;
export type Ease = "linear" | "smooth" | "in" | "out" | "hold" | "bezier";
export interface Key {
  id: string;
  frame: number;
  easing: Ease;
  values: Partial<Record<Channel, number>>;
  curve?: [number, number, number, number];
}
export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
}
export interface Bone {
  id: string;
  name: string;
  parent: string | null;
  length: number;
  angle: number;
  min: number;
  max: number;
}
export interface Layer {
  id: string;
  name: string;
  kind: "paint" | "shape" | "text" | "image" | "rig" | "group" | "video";
  parent: string | null;
  visible: boolean;
  locked: boolean;
  transform: Transform;
  keys: Key[];
  width: number;
  height: number;
  color: string;
  stroke: string;
  line: number;
  shape?: "rect" | "ellipse" | "star";
  text?: string;
  fontSize?: number;
  asset?: string;
  sound?: string;
  cels?: Cel[];
  held?: boolean;
  bones?: Bone[];
  bind?: { rig: string; bone: string };
  start: number;
  end: number;
  sourceIn: number;
  blend: "source-over" | "multiply" | "screen";
}
export interface Asset {
  id: string;
  kind: "image" | "audio" | "video";
  name: string;
  data: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  frames: string[];
  waveform: number[];
}
export interface Sound {
  id: string;
  asset: string;
  name: string;
  start: number;
  trim: number;
  end: number;
  gain: number;
  muted: boolean;
}
export interface Reference {
  id: string;
  asset: string;
  name: string;
  notes: string;
}
export interface Camera {
  x: number;
  y: number;
  zoom: number;
  keys: Key[];
}
export interface Scene {
  id: string;
  name: string;
  length: number;
  background: string;
  layers: Layer[];
  sounds: Sound[];
  camera: Camera;
  work: [number, number];
}
export interface Document {
  format: "luno-studio";
  schema: 1;
  id: string;
  title: string;
  canvas: { width: number; height: number; fps: number };
  scenes: Scene[];
  assets: Asset[];
  references: Reference[];
  created: number;
}
export const VERSION = "1.0.1";
export const MAX_BYTES = 64_000_000;
export const MAX_FRAMES = 1800;
export const uid = () => crypto.randomUUID();
export const identity = (): Transform => ({
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
});
export const brushDefaults: Brush = {
  tip: "ink",
  size: 8,
  opacity: 1,
  flow: 1,
  smoothing: 0.45,
  pressure: true,
  spacing: 0.15,
};
export const brushPresets: {
  name: string;
  tip: Tip;
  size: number;
  description: string;
}[] = [
  {
    name: "Studio Round",
    tip: "round",
    size: 12,
    description: "A clean, pressure-aware round.",
  },
  {
    name: "Fluid Ink",
    tip: "ink",
    size: 8,
    description: "A smooth, tapered ink line.",
  },
  {
    name: "Soft Air",
    tip: "soft",
    size: 40,
    description: "Build up a soft wash.",
  },
  {
    name: "Graphite",
    tip: "pencil",
    size: 4,
    description: "Fine, textured pencil strokes.",
  },
  {
    name: "Chisel Marker",
    tip: "marker",
    size: 22,
    description: "A broad angled nib.",
  },
  {
    name: "Pixel Square",
    tip: "pixel",
    size: 8,
    description: "Grid-aligned pixel marks.",
  },
  {
    name: "Charcoal",
    tip: "charcoal",
    size: 25,
    description: "Dry, scattered texture.",
  },
  {
    name: "Particle Spray",
    tip: "spray",
    size: 32,
    description: "Deterministic particle marks.",
  },
];
export function layer(
  kind: Layer["kind"],
  canvas = { width: 1280, height: 720 },
  name?: string,
): Layer {
  return {
    id: uid(),
    name:
      name ??
      {
        paint: "Drawing",
        shape: "Shape",
        text: "Type",
        image: "Artwork",
        rig: "Armature",
        group: "Group",
        video: "Footage",
      }[kind],
    kind,
    parent: null,
    visible: true,
    locked: false,
    transform:
      kind === "group"
        ? identity()
        : { ...identity(), x: canvas.width / 2, y: canvas.height / 2 },
    keys: [],
    width: kind === "paint" ? canvas.width : 180,
    height: kind === "paint" ? canvas.height : 180,
    color: "#9aa0a6",
    stroke: "#000000",
    line: 0,
    start: 0,
    end: 72,
    sourceIn: 0,
    blend: "source-over",
    ...(kind === "paint"
      ? { cels: [{ frame: 0, marks: [] }], held: true }
      : {}),
    ...(kind === "shape" ? { shape: "rect" as const } : {}),
    ...(kind === "text"
      ? { text: "Your next story", fontSize: 64, width: 500, height: 90 }
      : {}),
    ...(kind === "rig" ? { bones: defaultRig() } : {}),
  };
}
export function defaultRig(): Bone[] {
  const torso = uid(),
    head = uid(),
    a = uid(),
    b = uid(),
    c = uid(),
    d = uid();
  return [
    {
      id: torso,
      name: "Body",
      parent: null,
      length: 110,
      angle: -90,
      min: -180,
      max: 180,
    },
    {
      id: head,
      name: "Head",
      parent: torso,
      length: 55,
      angle: 0,
      min: -80,
      max: 80,
    },
    {
      id: a,
      name: "Left upper arm",
      parent: torso,
      length: 75,
      angle: -70,
      min: -180,
      max: 180,
    },
    {
      id: uid(),
      name: "Left forearm",
      parent: a,
      length: 65,
      angle: -25,
      min: -170,
      max: 170,
    },
    {
      id: b,
      name: "Right upper arm",
      parent: torso,
      length: 75,
      angle: 70,
      min: -180,
      max: 180,
    },
    {
      id: uid(),
      name: "Right forearm",
      parent: b,
      length: 65,
      angle: 25,
      min: -170,
      max: 170,
    },
    {
      id: c,
      name: "Left thigh",
      parent: null,
      length: 95,
      angle: 110,
      min: -180,
      max: 180,
    },
    {
      id: uid(),
      name: "Left shin",
      parent: c,
      length: 90,
      angle: -20,
      min: -170,
      max: 170,
    },
    {
      id: d,
      name: "Right thigh",
      parent: null,
      length: 95,
      angle: 70,
      min: -180,
      max: 180,
    },
    {
      id: uid(),
      name: "Right shin",
      parent: d,
      length: 90,
      angle: 20,
      min: -170,
      max: 170,
    },
  ];
}
export function scene(canvas = { width: 1280, height: 720 }, index = 1): Scene {
  return {
    id: uid(),
    name: `Scene ${String(index).padStart(2, "0")}`,
    length: 72,
    background: "#f6f5f1",
    layers: [],
    sounds: [],
    camera: { x: canvas.width / 2, y: canvas.height / 2, zoom: 1, keys: [] },
    work: [0, 71],
  };
}
export function createDocument(
  workspace: Workspace = "Draw",
  title = "Untitled",
  size = { width: 1280, height: 720, fps: 24 },
): Document {
  const s = scene(size);
  if (workspace === "Draw") {
    const drawing = layer("paint", size, "Drawing 01");
    drawing.held = false;
    s.layers.push(drawing);
  }
  if (workspace === "Motion") {
    const rig = layer("rig", size, "Orbit armature");
    rig.transform.y = size.height * 0.65;
    s.layers.push(rig);
  }
  if (workspace === "Edit") {
    s.length = 240;
    s.work = [0, 239];
    s.background = "#17181a";
  }
  return {
    format: "luno-studio",
    schema: 1,
    id: uid(),
    title,
    canvas: size,
    scenes: [s],
    assets: [],
    references: [],
    created: Date.now(),
  };
}
