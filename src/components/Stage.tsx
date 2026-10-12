import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  Crosshair,
  Expand,
  Grid3X3,
  Magnet,
  Minus,
  Plus,
  ScanLine,
} from "lucide-react";
import { useStudio, currentScene } from "../state/studio";
import {
  cameraMatrix,
  onImagesReady,
  paintCanvas,
  render,
} from "../core/render";
import {
  bonesAt,
  clamp,
  invert,
  locked,
  matrix,
  multiply,
  point,
  pose,
  solveIK,
  worldMatrix,
} from "../core/motion";
import { contains, localBounds, transformedBounds } from "../core/bounds";
import { bucket, stabilize } from "../core/paint";
import { layer, uid, type Mark, type Point } from "../core/model";
interface Gesture {
  kind:
    | "paint"
    | "move"
    | "pan"
    | "shape"
    | "box"
    | "scale"
    | "rotate"
    | "bone";
  start: { x: number; y: number };
  pointer: { x: number; y: number };
  id?: string;
  mark?: Mark;
  expected?: {
    document: string;
    scene: string;
    frame: number;
    layer: string | null;
  };
  base?: ReturnType<typeof pose>;
  bone?: string;
  shape?: "rect" | "ellipse";
  initialMatrix?: ReturnType<typeof worldMatrix>;
}
export function Stage() {
  const doc = useStudio((s) => s.document)!,
    scene = useStudio((s) =>
      s.document?.scenes.find((sc) => sc.id === s.sceneId),
    )!,
    frame = useStudio((s) => s.frame),
    tool = useStudio((s) => s.tool),
    selected = useStudio((s) => s.selected),
    prefs = useStudio((s) => s.preferences),
    zoom = useStudio((s) => s.zoom),
    pan = useStudio((s) => s.pan),
    playing = useStudio((s) => s.playing);
  const pane = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    overlay = useRef<HTMLCanvasElement>(null),
    gesture = useRef<Gesture | null>(null),
    [size, setSize] = useState({ w: 800, h: 550 }),
    [preview, setPreview] = useState<Mark | null>(null),
    [cursor, setCursor] = useState({ x: 0, y: 0 }),
    [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const fit = Math.min(
      (size.w - 50) / doc.canvas.width,
      (size.h - 90) / doc.canvas.height,
    ),
    scale = (Math.max(0.08, fit) * zoom) / 100;
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    if (pane.current) observer.observe(pane.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let raf = 0;
    const redraw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!canvas.current) return;
        render(canvas.current, doc, scene, frame, {
          onion: prefs.onion && !playing,
          preview:
            preview && gesture.current?.id
              ? { layer: gesture.current.id, mark: preview }
              : undefined,
        });
        if (preview && !gesture.current?.id) {
          const context = canvas.current.getContext("2d")!;
          const temp = layer("paint", doc.canvas);
          temp.end = scene.length;
          temp.cels = [{ frame, marks: [preview] }];
          renderPreview(context, temp, preview);
        }
      });
    };
    redraw();
    const dispose = onImagesReady(redraw);
    return () => {
      cancelAnimationFrame(raf);
      dispose();
    };
    function renderPreview(
      context: CanvasRenderingContext2D,
      temp: ReturnType<typeof layer>,
      mark: Mark,
    ) {
      const buffer = paintCanvas(temp, frame, mark);
      context.save();
      context.transform(...cameraMatrix(doc, scene, frame));
      context.drawImage(buffer, 0, 0);
      context.restore();
    }
  }, [doc, scene, frame, preview, prefs.onion, playing]);
  useEffect(() => {
    const c = overlay.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    if (prefs.grid) {
      ctx.strokeStyle = "#94909b20";
      ctx.lineWidth = 1;
      for (let x = 0; x < c.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, c.height);
        ctx.stroke();
      }
      for (let y = 0; y < c.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(c.width, y);
        ctx.stroke();
      }
    }
    if (!playing && ["select", "rig"].includes(tool))
      for (const id of selected) {
        const l = scene.layers.find((l) => l.id === id);
        if (!l) continue;
        const m = multiply(
            cameraMatrix(doc, scene, frame),
            worldMatrix(l, scene.layers, frame),
          ),
          b = localBounds(l, frame);
        ctx.save();
        ctx.transform(...m);
        ctx.strokeStyle = "#a69cff";
        ctx.lineWidth = 1 / scale;
        ctx.setLineDash([5 / scale, 4 / scale]);
        ctx.strokeRect(b.x, b.y, b.width, b.height);
        ctx.setLineDash([]);
        if (!locked(l, scene.layers)) {
          ctx.fillStyle = "#f5f2ff";
          for (const p of [
            { x: b.x, y: b.y },
            { x: b.x + b.width, y: b.y },
            { x: b.x, y: b.y + b.height },
            { x: b.x + b.width, y: b.y + b.height },
          ]) {
            ctx.fillRect(
              p.x - 4 / scale,
              p.y - 4 / scale,
              8 / scale,
              8 / scale,
            );
            ctx.strokeRect(
              p.x - 4 / scale,
              p.y - 4 / scale,
              8 / scale,
              8 / scale,
            );
          }
          ctx.beginPath();
          ctx.moveTo(b.x + b.width / 2, b.y);
          ctx.lineTo(b.x + b.width / 2, b.y - 25 / scale);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(
            b.x + b.width / 2,
            b.y - 25 / scale,
            4 / scale,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.stroke();
        }
        if (l.kind === "rig" && tool === "rig") {
          for (const bone of bonesAt(l, frame)) {
            ctx.beginPath();
            ctx.arc(bone.end.x, bone.end.y, 7 / scale, 0, Math.PI * 2);
            ctx.fillStyle =
              bone.id === useStudio.getState().bone ? "#fff0b6" : "#a69cff";
            ctx.fill();
          }
        }
        ctx.restore();
      }
    const g = gesture.current;
    if (g && (g.kind === "box" || g.kind === "shape")) {
      ctx.fillStyle = "#a69cff17";
      ctx.strokeStyle = "#a69cff";
      ctx.lineWidth = 1 / scale;
      ctx.fillRect(
        g.start.x,
        g.start.y,
        g.pointer.x - g.start.x,
        g.pointer.y - g.start.y,
      );
      ctx.strokeRect(
        g.start.x,
        g.start.y,
        g.pointer.x - g.start.x,
        g.pointer.y - g.start.y,
      );
    }
    ctx.restore();
  }, [
    doc,
    scene,
    frame,
    tool,
    selected,
    prefs,
    preview,
    scale,
    cursor,
    playing,
  ]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && gesture.current) {
        gesture.current = null;
        setPreview(null);
        useStudio.getState().cancelGesture();
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      useStudio.getState().cancelGesture();
    };
  }, []);
  const pos = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * doc.canvas.width,
      y: ((e.clientY - r.top) / r.height) * doc.canvas.height,
    };
  };
  const world = (p: { x: number; y: number }) =>
    point(invert(cameraMatrix(doc, scene, frame)), p);
  const sample = (
    e: PointerEvent<HTMLCanvasElement>,
    targetId?: string,
  ): Point => {
    const p = world(pos(e)),
      target = scene.layers.find((l) => l.id === targetId),
      local = target
        ? point(invert(worldMatrix(target, scene.layers, frame)), p)
        : p;
    return {
      x: local.x + (target ? target.width / 2 : 0),
      y: local.y + (target ? target.height / 2 : 0),
      p: e.pointerType === "pen" ? Math.max(0.05, e.pressure) : 1,
    };
  };
  const hit = (p: { x: number; y: number }) =>
    [...scene.layers]
      .reverse()
      .find(
        (l) =>
          l.visible &&
          l.kind !== "group" &&
          frame >= l.start &&
          frame < l.end &&
          contains(
            localBounds(l, frame),
            point(
              invert(
                multiply(
                  cameraMatrix(doc, scene, frame),
                  worldMatrix(l, scene.layers, frame),
                ),
              ),
              p,
            ),
          ),
      );
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || useStudio.getState().busy) return;
    e.preventDefault();
    e.currentTarget.focus();
    setMenu(null);
    const s = useStudio.getState(),
      p = pos(e),
      w = world(p);
    s.set({ playing: false });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === "picker" || (e.altKey && tool === "brush")) {
      const pixel = canvas
        .current!.getContext("2d")!
        .getImageData(
          Math.max(0, Math.min(doc.canvas.width - 1, Math.floor(p.x))),
          Math.max(0, Math.min(doc.canvas.height - 1, Math.floor(p.y))),
          1,
          1,
        ).data;
      s.pref(
        "foreground",
        "#" +
          [...pixel.subarray(0, 3)]
            .map((v) => v.toString(16).padStart(2, "0"))
            .join(""),
      );
      return;
    }
    if (tool === "hand") {
      gesture.current = {
        kind: "pan",
        start: { x: e.clientX, y: e.clientY },
        pointer: pan,
      };
      return;
    }
    if (["brush", "erase", "fill"].includes(tool)) {
      const paint = scene.layers.find(
        (l) => selected.includes(l.id) && l.kind === "paint",
      );
      if (paint && locked(paint, scene.layers)) {
        s.notify("Unlock this drawing layer.");
        return;
      }
      const expected = {
          document: doc.id,
          scene: scene.id,
          frame,
          layer: paint?.id ?? null,
        },
        brush = { ...prefs.brush },
        mark: Mark = {
          id: uid(),
          tool: tool === "erase" ? "erase" : tool === "fill" ? "fill" : "brush",
          color: prefs.foreground,
          brush,
          points: [sample(e, paint?.id)],
          seed: Math.floor(Math.random() * 2147483647),
        };
      if (tool === "fill") {
        if (!paint) {
          s.notify("Select a drawing layer before filling.");
          return;
        }
        try {
          mark.bitmap = bucket(
            paintCanvas(paint, frame),
            mark.points[0].x,
            mark.points[0].y,
            mark.color,
          );
          s.addMark(mark, expected);
        } catch (error) {
          s.notify(
            error instanceof Error ? error.message : "Fill failed.",
            true,
          );
        }
        return;
      }
      s.beginGesture();
      gesture.current = {
        kind: "paint",
        start: p,
        pointer: p,
        id: paint?.id,
        mark,
        expected,
      };
      setPreview(mark);
      return;
    }
    if (tool === "text") {
      let id = "";
      s.commit("Insert type", (d, sc) => {
        const node = layer("text", d.canvas);
        node.transform.x = w.x;
        node.transform.y = w.y;
        node.end = sc.length;
        sc.layers.push(node);
        id = node.id;
      });
      s.select(id);
      s.set({ tool: "select" });
      return;
    }
    if (tool === "rect" || tool === "ellipse") {
      s.beginGesture();
      gesture.current = { kind: "shape", start: p, pointer: p, shape: tool };
      setCursor(p);
      return;
    }
    const chosen = scene.layers.find((l) => l.id === selected[0]);
    if (chosen && !locked(chosen, scene.layers)) {
      const m = multiply(
          cameraMatrix(doc, scene, frame),
          worldMatrix(chosen, scene.layers, frame),
        ),
        b = localBounds(chosen, frame),
        local = point(invert(m), p),
        corners = [
          { x: b.x, y: b.y },
          { x: b.x + b.width, y: b.y },
          { x: b.x, y: b.y + b.height },
          { x: b.x + b.width, y: b.y + b.height },
        ];
      let kind: Gesture["kind"] | undefined;
      if (
        corners.some(
          (q) => Math.hypot(q.x - local.x, q.y - local.y) < 10 / scale,
        )
      )
        kind = "scale";
      if (
        Math.hypot(
          local.x - (b.x + b.width / 2),
          local.y - (b.y - 25 / scale),
        ) <
        10 / scale
      )
        kind = "rotate";
      if (tool === "rig" && chosen.kind === "rig") {
        const bone = bonesAt(chosen, frame).find(
          (b) => Math.hypot(b.end.x - local.x, b.end.y - local.y) < 12 / scale,
        );
        if (bone) {
          s.set({ bone: bone.id });
          s.beginGesture();
          gesture.current = {
            kind: "bone",
            id: chosen.id,
            bone: bone.id,
            start: local,
            pointer: p,
          };
          return;
        }
      }
      if (kind) {
        s.beginGesture();
        gesture.current = {
          kind,
          id: chosen.id,
          start: p,
          pointer: p,
          base: pose(chosen, frame),
          initialMatrix: m,
        };
        return;
      }
    }
    const l = hit(p);
    if (l) {
      s.select(l.id, e.shiftKey);
      if (!locked(l, scene.layers)) {
        s.beginGesture();
        gesture.current = {
          kind: "move",
          id: l.id,
          start: w,
          pointer: p,
          base: pose(l, frame),
        };
      }
    } else {
      s.select(null);
      s.beginGesture();
      gesture.current = { kind: "box", start: p, pointer: p };
    }
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = pos(e);
    setCursor(p);
    const g = gesture.current;
    if (!g) return;
    const s = useStudio.getState();
    if (g.kind === "pan") {
      s.set({
        pan: {
          x: g.pointer.x + (e.clientX - g.start.x),
          y: g.pointer.y + (e.clientY - g.start.y),
        },
      });
      return;
    }
    g.pointer = p;
    if (g.kind === "paint") {
      let values: PointerEvent<HTMLCanvasElement>[] = [e];
      const events = e.nativeEvent.getCoalescedEvents?.();
      if (events?.length)
        values = events.map(
          (raw) =>
            ({
              ...e,
              clientX: raw.clientX,
              clientY: raw.clientY,
              pressure: raw.pressure,
              pointerType: raw.pointerType,
              currentTarget: e.currentTarget,
            }) as PointerEvent<HTMLCanvasElement>,
        );
      for (const event of values) {
        const next = sample(event, g.id),
          last = g.mark!.points.at(-1)!;
        if (
          Math.hypot(last.x - next.x, last.y - next.y) > 0.5 &&
          g.mark!.points.length < 2048
        )
          g.mark!.points.push(stabilize(last, next, g.mark!.brush.smoothing));
      }
      setPreview({ ...g.mark!, points: [...g.mark!.points] });
      return;
    }
    if (g.kind === "move" && g.id && g.base) {
      const w = world(p),
        dx = w.x - g.start.x,
        dy = w.y - g.start.y;
      const node = scene.layers.find((l) => l.id === g.id)!,
        local = multiply(
          worldMatrix(node, scene.layers, frame),
          invert(matrix(pose(node, frame))),
        );
      const a = point(invert(local), g.start),
        b = point(invert(local), w);
      let x = g.base.x + (b.x - a.x),
        y = g.base.y + (b.y - a.y);
      if (prefs.snap) {
        x = Math.round(x / 20) * 20;
        y = Math.round(y / 20) * 20;
      }
      s.transform(
        g.id,
        {
          x: Number.isFinite(x) ? x : g.base.x,
          y: Number.isFinite(y) ? y : g.base.y,
        },
        false,
      );
      void dx;
      void dy;
    }
    if (g.kind === "scale" && g.id && g.base) {
      const node = scene.layers.find((l) => l.id === g.id)!,
        b = localBounds(node, frame),
        m =
          g.initialMatrix ??
          multiply(
            cameraMatrix(doc, scene, frame),
            worldMatrix(node, scene.layers, frame),
          ),
        local = point(invert(m), p);
      let x = Math.max(0.01, Math.abs(local.x) / (b.width / 2)) * g.base.scaleX,
        y = Math.max(0.01, Math.abs(local.y) / (b.height / 2)) * g.base.scaleY;
      if (e.shiftKey) x = y = Math.max(x, y);
      s.transform(g.id, { scaleX: x, scaleY: y }, false);
    }
    if (g.kind === "rotate" && g.id && g.base) {
      const node = scene.layers.find((l) => l.id === g.id)!,
        origin = point(
          multiply(
            cameraMatrix(doc, scene, frame),
            worldMatrix(node, scene.layers, frame),
          ),
          { x: 0, y: 0 },
        );
      const angle =
        Math.atan2(p.y - origin.y, p.x - origin.x) -
        Math.atan2(g.start.y - origin.y, g.start.x - origin.x);
      s.transform(
        g.id,
        { rotation: g.base.rotation + (angle * 180) / Math.PI },
        false,
      );
    }
    if (g.kind === "bone" && g.id && g.bone) {
      const node = scene.layers.find((l) => l.id === g.id)!,
        target = point(
          invert(
            multiply(
              cameraMatrix(doc, scene, frame),
              worldMatrix(node, scene.layers, frame),
            ),
          ),
          p,
        );
      s.boneAngles(g.id, solveIK(node, g.bone, target, frame), false);
    }
  };
  const up = (e: PointerEvent<HTMLCanvasElement>, cancel = false) => {
    const g = gesture.current;
    gesture.current = null;
    setPreview(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    const s = useStudio.getState();
    if (cancel) {
      s.cancelGesture();
      return;
    }
    s.endGesture();
    if (!g) return;
    if (g.kind === "paint") s.addMark(g.mark!, g.expected!);
    if (g.kind === "shape") {
      const a = world(g.start),
        b = world(g.pointer);
      let id = "";
      s.commit("Draw shape", (d, sc) => {
        const n = layer("shape", d.canvas);
        n.shape = g.shape;
        n.name = g.shape === "rect" ? "Rectangle" : "Ellipse";
        n.width = Math.max(4, Math.abs(b.x - a.x));
        n.height = Math.max(4, Math.abs(b.y - a.y));
        n.transform.x = (a.x + b.x) / 2;
        n.transform.y = (a.y + b.y) / 2;
        n.end = sc.length;
        n.color = prefs.foreground;
        sc.layers.push(n);
        id = n.id;
      });
      s.select(id);
    }
    if (g.kind === "box") {
      const b = {
        x: Math.min(g.start.x, g.pointer.x),
        y: Math.min(g.start.y, g.pointer.y),
        width: Math.abs(g.pointer.x - g.start.x),
        height: Math.abs(g.pointer.y - g.start.y),
      };
      s.set({
        selected: scene.layers
          .filter((l) => {
            if (locked(l, scene.layers) || l.kind === "group") return false;
            const box = transformedBounds(
              localBounds(l, frame),
              multiply(
                cameraMatrix(doc, scene, frame),
                worldMatrix(l, scene.layers, frame),
              ),
            );
            return (
              box.x >= b.x &&
              box.y >= b.y &&
              box.x + box.width <= b.x + b.width &&
              box.y + box.height <= b.y + b.height
            );
          })
          .map((l) => l.id),
      });
    }
  };
  return (
    <section className="stage" ref={pane} aria-label="Canvas workspace">
      <div className="stage-toolbar">
        <span className="canvas-label">
          <span />
          {scene.name}
          <i>/</i>
          {doc.canvas.width} × {doc.canvas.height}
        </span>
        <div>
          <button
            title="Onion skins"
            aria-label="Toggle onion skins"
            aria-pressed={prefs.onion}
            onClick={() => useStudio.getState().pref("onion", !prefs.onion)}
          >
            <ScanLine size={14} />
          </button>
          <button
            title="Grid"
            aria-label="Toggle canvas grid"
            aria-pressed={prefs.grid}
            onClick={() => useStudio.getState().pref("grid", !prefs.grid)}
          >
            <Grid3X3 size={14} />
          </button>
          <button
            title="Snap"
            aria-label="Toggle grid snapping"
            aria-pressed={prefs.snap}
            onClick={() => useStudio.getState().pref("snap", !prefs.snap)}
          >
            <Magnet size={14} />
          </button>
        </div>
      </div>
      <div
        className="canvas-well"
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            useStudio.setState({
              zoom: clamp(zoom * (e.deltaY < 0 ? 1.1 : 0.9), 25, 300),
            });
          }
        }}
      >
        <div
          className="artboard"
          style={{
            width: doc.canvas.width * scale,
            height: doc.canvas.height * scale,
            transform: `translate(${pan.x}px,${pan.y}px)`,
          }}
        >
          <canvas
            ref={canvas}
            width={doc.canvas.width}
            height={doc.canvas.height}
            data-testid="canvas"
            aria-label="Animation canvas"
            tabIndex={0}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={(e) => up(e)}
            onPointerCancel={(e) => up(e, true)}
            onLostPointerCapture={() => {
              if (gesture.current) {
                gesture.current = null;
                setPreview(null);
                useStudio.getState().cancelGesture();
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY });
            }}
          />
          <canvas
            className="canvas-overlay"
            ref={overlay}
            width={doc.canvas.width}
            height={doc.canvas.height}
          />
        </div>
      </div>
      <div className="stage-status">
        <span>
          <Crosshair size={11} />X {Math.round(cursor.x)} <i>·</i> Y{" "}
          {Math.round(cursor.y)}
        </span>
        <span>
          {tool === "brush"
            ? "Brush"
            : tool === "erase"
              ? "Eraser"
              : tool === "rig"
                ? "Inverse kinematics"
                : tool}{" "}
          <i>/</i>
          {selected.length} selected
        </span>
        <div>
          <button
            aria-label="Zoom out canvas"
            onClick={() =>
              useStudio.setState({ zoom: clamp(zoom - 10, 25, 300) })
            }
          >
            <Minus size={13} />
          </button>
          <button
            onClick={() =>
              useStudio.setState({ zoom: 100, pan: { x: 0, y: 0 } })
            }
          >
            {Math.round(zoom)}%
          </button>
          <button
            aria-label="Zoom in canvas"
            onClick={() =>
              useStudio.setState({ zoom: clamp(zoom + 10, 25, 300) })
            }
          >
            <Plus size={13} />
          </button>
          <button
            aria-label="Fit canvas"
            onClick={() =>
              useStudio.setState({ zoom: 100, pan: { x: 0, y: 0 } })
            }
          >
            <Expand size={14} />
          </button>
        </div>
      </div>
      {menu && (
        <>
          <button
            className="menu-backdrop"
            aria-label="Close canvas menu"
            onClick={() => setMenu(null)}
          />
          <div
            className="context-menu"
            role="menu"
            aria-label="Canvas actions"
            style={{
              left: Math.min(menu.x, window.innerWidth - 180),
              top: Math.min(menu.y, window.innerHeight - 210),
            }}
          >
            {[
              ["Duplicate", () => useStudio.getState().duplicate()],
              ["Group selection", () => useStudio.getState().group()],
              ["Delete", () => useStudio.getState().remove()],
              [
                "Fit canvas",
                () => useStudio.setState({ zoom: 100, pan: { x: 0, y: 0 } }),
              ],
            ].map(([label, run]) => (
              <button
                key={String(label)}
                role="menuitem"
                onClick={() => {
                  (run as () => void)();
                  setMenu(null);
                }}
              >
                {String(label)}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
export { currentScene };
