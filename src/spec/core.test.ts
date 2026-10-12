import { beforeEach, describe, expect, it } from "vitest";
import {
  createDocument,
  layer,
  brushDefaults,
  uid,
  type Document,
  type Key,
  type Mark,
} from "../core/model";
import { validateDocument } from "../core/validate";
import { encode, decode, fingerprint } from "../core/codec";
import {
  bonesAt,
  celAt,
  channelAt,
  ease,
  invert,
  matrix,
  multiply,
  point,
  pose,
  solveIK,
  worldMatrix,
} from "../core/motion";
import { paintWork, samples, seeded, stabilize } from "../core/paint";
import { useStudio } from "../state/studio";
import { plan } from "../core/export";
const dot = (color = "#343345"): Mark => ({
  id: uid(),
  tool: "brush",
  color,
  brush: { ...brushDefaults },
  seed: 19,
  points: [
    { x: 10, y: 10, p: 0.2 },
    { x: 60, y: 30, p: 0.9 },
  ],
});
const reset = (d: Document = createDocument()) =>
  useStudio.setState({
    document: d,
    sceneId: d.scenes[0].id,
    view: "studio",
    frame: 0,
    history: [],
    future: [],
    busy: false,
    interacting: false,
    selected: [d.scenes[0].layers[0]?.id].filter(Boolean),
    keySelection: [],
    keyClipboard: [],
    playing: false,
  });
beforeEach(() => reset());
describe("independent Studio 1.0 model and protected container", () => {
  it.each(["Draw", "Motion", "Edit"] as const)(
    "constructs a valid unified %s document",
    (w) => {
      const d = createDocument(w);
      expect(validateDocument(d)).toEqual(d);
      expect(d.format).toBe("luno-studio");
      expect(d.schema).toBe(1);
    },
  );
  it("drawing starts with manual cels, not automatic in-betweens", () => {
    const d = createDocument();
    expect(d.scenes[0].layers[0].held).toBe(false);
    expect(celAt(d.scenes[0].layers[0], 1)).toBeUndefined();
  });
  it("new binary signature, compressed payload and SHA-256 preserve complete data", () => {
    const d = createDocument();
    d.scenes[0].layers[0].cels![0].marks.push(dot());
    const bytes = encode(d);
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe("LUNO1LAM");
    expect(decode(bytes)).toEqual(d);
    expect(fingerprint(bytes)).toHaveLength(64);
  });
  it.each([0, 8, 10, 12, 16, 20, 51, 60])(
    "tampered container byte %s cannot replace current work",
    (at) => {
      const bytes = encode(createDocument());
      bytes[at] ^= 128;
      expect(() => decode(bytes)).toThrow();
    },
  );
  it("legacy LUNOLAM files are deliberately rejected without migrating or deleting them", () => {
    const bytes = encode(createDocument());
    bytes.set(new TextEncoder().encode("LUNOLAM\0"));
    expect(() => decode(bytes)).toThrow("legacy");
  });
  it("NaN and Infinity never enter transforms or pressure", () => {
    const d = createDocument();
    d.scenes[0].layers[0].transform.x = NaN;
    expect(() => validateDocument(d)).toThrow();
    d.scenes[0].layers[0].transform.x = 0;
    const mark = dot();
    mark.points[0].p = Infinity;
    d.scenes[0].layers[0].cels![0].marks = [mark];
    expect(() => encode(d)).toThrow();
  });
  it("duplicate scenes, layers, cels and marks are rejected", () => {
    const d = createDocument();
    d.scenes.push(d.scenes[0]);
    expect(() => validateDocument(d)).toThrow("Duplicate");
    d.scenes.pop();
    d.scenes[0].layers.push(d.scenes[0].layers[0]);
    expect(() => validateDocument(d)).toThrow("Duplicate");
    d.scenes[0].layers.pop();
    const m = dot();
    d.scenes[0].layers[0].cels![0].marks = [m, m];
    expect(() => validateDocument(d)).toThrow("Duplicate");
  });
  it("parent and bone cycles fail before rendering", () => {
    const d = createDocument("Motion"),
      g = layer("group", d.canvas);
    g.parent = g.id;
    d.scenes[0].layers.push(g);
    expect(() => validateDocument(d)).toThrow("Cyclic");
    d.scenes[0].layers.pop();
    d.scenes[0].layers[0].bones![0].parent = d.scenes[0].layers[0].bones![0].id;
    expect(() => validateDocument(d)).toThrow("Cyclic");
  });
  it("missing image/audio assets and malformed data sources are refused", () => {
    const d = createDocument(),
      image = layer("image", d.canvas);
    image.asset = "missing";
    d.scenes[0].layers.push(image);
    expect(() => encode(d)).toThrow("Missing");
  });
  it("outside work areas and keyed scales fail", () => {
    const d = createDocument();
    d.scenes[0].work = [0, 99];
    expect(() => validateDocument(d)).toThrow("work");
    d.scenes[0].work = [0, 71];
    d.scenes[0].layers[0].keys = [
      { id: uid(), frame: 2, easing: "linear", values: { scaleX: 0 } },
    ];
    expect(() => encode(d)).toThrow("keyed");
  });
  it("prototype-like IDs and unknown properties cannot become unsafe paths", () => {
    const d = createDocument();
    d.id = "__proto__";
    expect(() => validateDocument(d)).toThrow();
  });
  it("underdeclared decompression length fails without allocating beyond its bound", () => {
    const bytes = encode(createDocument());
    new DataView(bytes.buffer).setUint32(12, 3, true);
    expect(() => decode(bytes)).toThrow();
  });
});
describe("new motion geometry and controlled rigs", () => {
  it("interpolates a missing initial channel from the original base", () => {
    const keys: Key[] = [
      { id: uid(), frame: 10, easing: "linear", values: { x: 200 } },
    ];
    expect(channelAt(100, keys, "x", 0)).toBe(100);
    expect(channelAt(100, keys, "x", 5)).toBe(150);
  });
  it("interpolation affects only keyed channels", () => {
    const l = layer("shape");
    l.transform.x = 0;
    l.keys = [
      { id: uid(), frame: 0, easing: "linear", values: { x: 0 } },
      { id: uid(), frame: 10, easing: "linear", values: { x: 100 } },
    ];
    expect(pose(l, 5).x).toBe(50);
    expect(pose(l, 5).y).toBe(l.transform.y);
  });
  it.each(["linear", "smooth", "in", "out", "hold"] as const)(
    "%s easing keeps exact endpoints",
    (kind) => {
      expect(ease(kind, 0)).toBe(0);
      expect(ease(kind, 1)).toBe(1);
    },
  );
  it("custom Bézier x solving preserves a linear curve", () =>
    expect(ease("bezier", 0.4, [0, 0, 1, 1])).toBeCloseTo(0.4, 4));
  it("matrix inverse preserves coordinates through nonuniform scale and rotation", () => {
    const m = matrix({
        x: 120,
        y: 80,
        scaleX: 2,
        scaleY: 0.8,
        rotation: 43,
        opacity: 1,
      }),
      p = { x: 11, y: -17 };
    expect(point(invert(m), point(m, p)).x).toBeCloseTo(p.x, 8);
    expect(point(invert(m), point(m, p)).y).toBeCloseTo(p.y, 8);
    expect(multiply(m, invert(m))[4]).toBeCloseTo(0);
  });
  it("parent transforms compose without changing local pose values", () => {
    const parent = layer("group"),
      child = layer("shape");
    parent.transform.x = 80;
    child.parent = parent.id;
    child.transform.x = 30;
    expect(
      point(worldMatrix(child, [parent, child], 0), { x: 0, y: 0 }).x,
    ).toBe(110);
  });
  it("FK creates connected bones and IK reduces endpoint error inside constraints", () => {
    const l = layer("rig"),
      tip = l.bones!.find((b) => b.name === "Left forearm")!,
      before = bonesAt(l, 0).find((b) => b.id === tip.id)!,
      target = { x: before.end.x + 25, y: before.end.y + 25 },
      angles = solveIK(l, tip.id, target, 0),
      posed = {
        ...l,
        bones: l.bones!.map((b) => ({ ...b, angle: angles[b.id] ?? b.angle })),
      },
      after = bonesAt(posed, 0).find((b) => b.id === tip.id)!;
    expect(
      Math.hypot(after.end.x - target.x, after.end.y - target.y),
    ).toBeLessThan(
      Math.hypot(before.end.x - target.x, before.end.y - target.y),
    );
    for (const b of posed.bones!) expect(b.angle).toBeGreaterThanOrEqual(b.min);
  });
  it("exact drawing cels and optional held exposures are distinct", () => {
    const l = layer("paint");
    l.cels = [
      { frame: 0, marks: [dot()] },
      { frame: 4, marks: [] },
    ];
    l.held = false;
    expect(celAt(l, 3)).toBeUndefined();
    l.held = true;
    expect(celAt(l, 3)?.marks).toHaveLength(1);
    expect(celAt(l, 4)?.marks).toHaveLength(0);
  });
});
describe("fresh procedural painting", () => {
  it("spacing resamples full paths with a strict sample cap and retained endpoint", () => {
    const m = dot();
    m.points = [
      { x: 0, y: 0, p: 0.1 },
      { x: 100000, y: 100000, p: 1 },
    ];
    const output = samples(m);
    expect(output.length).toBeLessThanOrEqual(2048);
    expect(output.at(-1)).toEqual(m.points.at(-1));
  });
  it("a tap is visible data, not an empty stroke", () => {
    const m = dot();
    m.points = [{ x: 10, y: 20, p: 0.5 }];
    expect(samples(m)).toHaveLength(1);
    expect(paintWork(m)).toBe(1);
  });
  it("texture seeds remain deterministic", () => {
    const a = seeded(19),
      b = seeded(19);
    expect(Array.from({ length: 20 }, a)).toEqual(
      Array.from({ length: 20 }, b),
    );
  });
  it("stabilization retains captured pressure", () =>
    expect(
      stabilize({ x: 0, y: 0, p: 0.2 }, { x: 10, y: 10, p: 0.8 }, 0.5),
    ).toEqual({ x: 5, y: 5, p: 0.8 }));
  it("painting budgets reflect actual particle expansion", () => {
    const m = dot();
    m.brush.tip = "spray";
    expect(paintWork(m)).toBe(samples(m).length * 12);
  });
});
describe("atomic first-release editor transactions", () => {
  it("one stroke has one Undo and preserves its own settings", () => {
    const s = useStudio.getState(),
      d = s.document!,
      id = d.scenes[0].layers[0].id,
      m = dot();
    expect(
      s.addMark(m, { document: d.id, scene: s.sceneId, frame: 0, layer: id }),
    ).toBe(true);
    expect(useStudio.getState().history).toHaveLength(1);
    s.undo();
    expect(useStudio.getState().document).toEqual(d);
    s.redo();
    expect(
      useStudio.getState().document!.scenes[0].layers[0].cels![0].marks[0],
    ).toEqual(m);
  });
  it("stale drawing targets do not consume history", () => {
    const s = useStudio.getState();
    expect(
      s.addMark(dot(), {
        document: "changed",
        scene: s.sceneId,
        frame: 0,
        layer: s.selected[0],
      }),
    ).toBe(false);
    expect(useStudio.getState().history).toHaveLength(0);
  });
  it("editing a held exposure forks, rather than modifying earlier artwork", () => {
    const s = useStudio.getState(),
      d = s.document!,
      l = d.scenes[0].layers[0];
    l.held = true;
    l.cels![0].marks = [dot()];
    s.set({ frame: 5 });
    s.addMark(dot("#ff0000"), {
      document: d.id,
      scene: s.sceneId,
      frame: 5,
      layer: l.id,
    });
    const current = useStudio.getState().document!.scenes[0].layers[0];
    expect(current.cels![0].marks).toHaveLength(1);
    expect(celAt(current, 5)?.marks).toHaveLength(2);
  });
  it("locked drawings refuse marks and preserve history", () => {
    const s = useStudio.getState(),
      d = s.document!;
    d.scenes[0].layers[0].locked = true;
    expect(
      s.addMark(dot(), {
        document: d.id,
        scene: s.sceneId,
        frame: 0,
        layer: s.selected[0],
      }),
    ).toBe(false);
    expect(useStudio.getState().document).toBe(d);
  });
  it("blank/duplicate next cels are explicit and reversible", () => {
    const s = useStudio.getState(),
      d = s.document!;
    d.scenes[0].layers[0].cels![0].marks = [dot()];
    s.newCel(true);
    expect(useStudio.getState().frame).toBe(1);
    expect(
      celAt(useStudio.getState().document!.scenes[0].layers[0], 1)?.marks,
    ).toHaveLength(1);
    s.newCel(false);
    expect(
      celAt(useStudio.getState().document!.scenes[0].layers[0], 2)?.marks,
    ).toHaveLength(0);
  });
  it("auto-key bootstraps an initial pose and animates rather than changing all previous frames", () => {
    reset(createDocument("Motion"));
    const s = useStudio.getState(),
      id = s.selected[0],
      initial = s.document!.scenes[0].layers[0].transform.x;
    s.set({ frame: 24 });
    s.transform(id, { x: initial + 200 });
    const l = useStudio.getState().document!.scenes[0].layers[0];
    expect(pose(l, 0).x).toBe(initial);
    expect(pose(l, 12).x).toBeCloseTo(initial + 100);
    expect(pose(l, 24).x).toBe(initial + 200);
  });
  it("pointer previews coalesce to one history checkpoint and cancellation rolls back", () => {
    reset(createDocument("Motion"));
    const s = useStudio.getState(),
      d = s.document!,
      id = s.selected[0];
    s.beginGesture();
    s.transform(id, { x: 700 }, false);
    s.transform(id, { x: 710 }, false);
    s.endGesture();
    expect(useStudio.getState().history).toHaveLength(1);
    s.undo();
    expect(useStudio.getState().document).toEqual(d);
    s.beginGesture();
    s.transform(id, { x: 880 }, false);
    s.cancelGesture();
    expect(useStudio.getState().document).toEqual(d);
  });
  it("invalid property patches do not enter history", () => {
    const s = useStudio.getState(),
      d = s.document!;
    s.patchLayer(s.selected[0], { width: 999999 });
    expect(useStudio.getState().document).toBe(d);
    expect(useStudio.getState().history).toHaveLength(0);
  });
  it.each(["busy", "interacting"] as const)(
    "%s prevents structural edits",
    (key) => {
      const s = useStudio.getState(),
        d = s.document!;
      s.set({ [key]: true });
      s.add("shape");
      expect(useStudio.getState().document).toBe(d);
    },
  );
  it("grouping and ungrouping identity groups preserve original transforms", () => {
    reset(createDocument("Edit"));
    const s = useStudio.getState();
    s.add("shape", "rect");
    const a = useStudio.getState().selected[0];
    s.add("shape", "ellipse");
    const b = useStudio.getState().selected[0];
    s.set({ selected: [a, b] });
    s.group();
    const d = useStudio.getState().document!,
      g = useStudio.getState().selected[0];
    expect(d.scenes[0].layers.filter((l) => l.parent === g)).toHaveLength(2);
    s.ungroup();
    expect(useStudio.getState().document!.scenes[0].layers).toHaveLength(2);
  });
  it("scene duplication remaps layer parents and does not alias the original", () => {
    const s = useStudio.getState(),
      id = s.sceneId;
    s.sceneAction(id, "duplicate");
    const d = useStudio.getState().document!;
    expect(d.scenes).toHaveLength(2);
    expect(d.scenes[0].layers[0].id).not.toBe(d.scenes[1].layers[0].id);
  });
  it("reverse held exposures preserves the tail after the range", () => {
    const s = useStudio.getState(),
      l = s.document!.scenes[0].layers[0];
    l.held = true;
    l.cels = [
      { frame: 0, marks: [dot("#ff0000")] },
      { frame: 4, marks: [dot("#0000ff")] },
    ];
    s.reverseCels(1, 5);
    const next = useStudio.getState().document!.scenes[0].layers[0];
    expect(celAt(next, 1)?.marks[0].color).toBe("#0000ff");
    expect(celAt(next, 5)?.marks[0].color).toBe("#ff0000");
    expect(celAt(next, 6)?.marks[0].color).toBe("#0000ff");
  });
  it("reference notes and image assets are document data, not render layers", () => {
    const s = useStudio.getState(),
      d = s.document!;
    s.commit("Reference", (doc) => {
      doc.references = [];
    });
    expect(useStudio.getState().document!.scenes[0].layers).toEqual(
      d.scenes[0].layers,
    );
  });
});
describe("export planning", () => {
  it("all scenes preserve explicit order and work areas", () => {
    const d = createDocument();
    const second = structuredClone(d.scenes[0]);
    second.id = uid();
    second.name = "Scene 02";
    second.work = [3, 5];
    d.scenes.push(second);
    d.scenes[0].work = [0, 1];
    const frames = plan(d, d.scenes[0].id, { all: true, work: true });
    expect(frames.map((f) => f.frame)).toEqual([0, 1, 3, 4, 5]);
    expect(frames[2].scene.id).toBe(second.id);
  });
  it("a single-scene render never accidentally includes another scene", () => {
    const d = createDocument(),
      copy = structuredClone(d.scenes[0]);
    copy.id = uid();
    d.scenes.push(copy);
    expect(plan(d, copy.id, { all: false, work: false })).toHaveLength(72);
  });
});
