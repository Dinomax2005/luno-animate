import type { Brush, Mark, Point } from "./model";
export function stabilize(previous: Point, next: Point, amount: number): Point {
  return {
    ...next,
    x: previous.x + (next.x - previous.x) * (1 - amount),
    y: previous.y + (next.y - previous.y) * (1 - amount),
  };
}
export function samples(mark: Mark): Point[] {
  const source = mark.points;
  if (source.length < 2) return source;
  let distance = 0;
  for (let i = 1; i < source.length; i++)
    distance += Math.hypot(
      source[i].x - source[i - 1].x,
      source[i].y - source[i - 1].y,
    );
  if (!distance) return [source[0]];
  const spacing = Math.max(
      0.75,
      mark.brush.size * mark.brush.spacing,
      distance / 2047,
    ),
    out = [source[0]];
  let walked = 0,
    next = spacing;
  for (let i = 1; i < source.length; i++) {
    const a = source[i - 1],
      b = source[i],
      len = Math.hypot(b.x - a.x, b.y - a.y);
    while (len && next <= walked + len && out.length < 2047) {
      const t = (next - walked) / len;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        p: a.p + (b.p - a.p) * t,
      });
      next += spacing;
    }
    walked += len;
  }
  out.push(source.at(-1)!);
  return out;
}
export function paintWork(mark: Mark): number {
  return mark.tool === "fill"
    ? 1
    : samples(mark).length *
        (mark.brush.tip === "spray"
          ? 12
          : mark.brush.tip === "charcoal"
            ? 6
            : 1);
}
export function seeded(seed: number) {
  let n = seed | 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) | 0;
    return (n >>> 0) / 4294967296;
  };
}
const pressure = (brush: Brush, p: number) =>
  brush.pressure ? Math.max(0.08, p) : 1;
export function paintMark(
  ctx: CanvasRenderingContext2D,
  mark: Mark,
  bitmap?: CanvasImageSource,
): void {
  ctx.save();
  ctx.globalCompositeOperation =
    mark.tool === "erase" ? "destination-out" : "source-over";
  if (mark.tool === "fill") {
    if (bitmap) ctx.drawImage(bitmap, 0, 0);
    ctx.restore();
    return;
  }
  const dots = samples(mark),
    random = seeded(mark.seed),
    b = mark.brush;
  ctx.fillStyle = mark.color;
  ctx.strokeStyle = mark.color;
  dots.forEach((p, index) => {
    let radius = (b.size * pressure(b, p.p)) / 2;
    if (b.tip === "ink" && dots.length > 8)
      radius *= Math.min(1, 0.3 + index / 4, 0.35 + (dots.length - index) / 5);
    ctx.globalAlpha = b.opacity * b.flow;
    if (b.tip === "pixel") {
      const size = Math.max(1, Math.round(b.size));
      ctx.fillRect(
        Math.floor(p.x / size) * size,
        Math.floor(p.y / size) * size,
        size,
        size,
      );
    } else if (b.tip === "marker") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-Math.PI / 5);
      ctx.fillRect(-radius, -radius * 0.26, radius * 2, radius * 0.52);
      ctx.restore();
    } else if (b.tip === "soft") {
      const gradient = ctx.createRadialGradient(
        p.x,
        p.y,
        0,
        p.x,
        p.y,
        Math.max(0.1, radius),
      );
      gradient.addColorStop(0, mark.color);
      gradient.addColorStop(1, `${mark.color}00`);
      ctx.fillStyle = gradient;
      ctx.globalAlpha = b.opacity * b.flow * 0.18;
      ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    } else if (b.tip === "spray" || b.tip === "charcoal") {
      const count = b.tip === "spray" ? 12 : 6;
      for (let i = 0; i < count; i++) {
        const angle = random() * Math.PI * 2,
          r = Math.sqrt(random()) * radius,
          rr =
            b.tip === "spray"
              ? Math.max(0.45, radius * 0.08)
              : Math.max(0.3, radius * 0.15 * random());
        ctx.globalAlpha = b.opacity * b.flow * (0.25 + random() * 0.5);
        ctx.beginPath();
        ctx.ellipse(
          p.x + Math.cos(angle) * r,
          p.y + Math.sin(angle) * r,
          rr,
          rr * 0.65,
          angle,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else if (b.tip === "pencil") {
      ctx.globalAlpha = b.opacity * b.flow * 0.45;
      ctx.beginPath();
      ctx.arc(
        p.x + (random() - 0.5) * radius * 0.4,
        p.y + (random() - 0.5) * radius * 0.4,
        Math.max(0.3, radius * 0.6),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, radius), 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}
export function bucket(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  hex: string,
  tolerance = 24,
): string {
  const scale = Math.min(1, 1024 / Math.max(canvas.width, canvas.height)),
    w = Math.max(1, Math.round(canvas.width * scale)),
    h = Math.max(1, Math.round(canvas.height * scale)),
    sample = document.createElement("canvas");
  sample.width = w;
  sample.height = h;
  const ctx = sample.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h),
    data = pixels.data,
    sx = Math.max(0, Math.min(w - 1, Math.floor(x * scale))),
    sy = Math.max(0, Math.min(h - 1, Math.floor(y * scale))),
    index = (sy * w + sx) * 4,
    base = [...data.subarray(index, index + 4)],
    visited = new Uint8Array(w * h),
    queue = new Int32Array(w * h);
  let head = 0,
    tail = 1;
  queue[0] = sy * w + sx;
  const output = ctx.createImageData(w, h),
    rgb = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  visited[queue[0]] = 1;
  while (head < tail) {
    const p = queue[head++],
      at = p * 4;
    if (Math.max(...base.map((v, i) => Math.abs(v - data[at + i]))) > tolerance)
      continue;
    output.data.set([...rgb, 255], at);
    const px = p % w,
      py = Math.floor(p / w);
    for (const n of [
      px > 0 ? p - 1 : -1,
      px < w - 1 ? p + 1 : -1,
      py > 0 ? p - w : -1,
      py < h - 1 ? p + w : -1,
    ])
      if (n >= 0 && !visited[n]) {
        visited[n] = 1;
        queue[tail++] = n;
      }
  }
  ctx.putImageData(output, 0, 0);
  const result = document.createElement("canvas");
  result.width = canvas.width;
  result.height = canvas.height;
  result.getContext("2d")!.drawImage(sample, 0, 0, result.width, result.height);
  const encoded = result.toDataURL("image/png");
  if (encoded.length > 5_000_000)
    throw new Error("Fill exceeds the embedded image limit.");
  return encoded;
}
