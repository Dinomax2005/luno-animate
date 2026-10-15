import { uid, type Channel, type Key, type Layer, type Scene } from "./model";
import { channelAt, clamp } from "./motion";

/**
 * On-device motion analysis. Nothing here talks to a network, needs an account
 * or costs anything: it reads the keyframes already in the document and reports
 * what the timing does, the way an animator reads an exposure sheet.
 */

export type Spacing = "even" | "first" | "last" | "both";
export const spacings: { id: Spacing; label: string; hint: string }[] = [
  {
    id: "even",
    label: "Even",
    hint: "Equal steps. Mechanical, good for constant speed.",
  },
  {
    id: "first",
    label: "Favour first pose",
    hint: "Tight steps near the first key, then release.",
  },
  {
    id: "last",
    label: "Favour last pose",
    hint: "Slow arrival into the last key.",
  },
  {
    id: "both",
    label: "Ease both ways",
    hint: "Slow out of one pose and into the next.",
  },
];

export const ANIMATED: Channel[] = [
  "x",
  "y",
  "scaleX",
  "scaleY",
  "rotation",
  "opacity",
];

/** Where the index-th in-between of a group sits, as 0..1 between two keys. */
export function spacingAt(
  index: number,
  count: number,
  spacing: Spacing,
): number {
  const u = (index + 1) / (count + 1);
  if (spacing === "first") return u * u;
  if (spacing === "last") return 1 - (1 - u) * (1 - u);
  if (spacing === "both") return u * u * (3 - 2 * u);
  return u;
}

/** Frames a set of in-betweens lands on. Degenerate steps collapse, never clash. */
export function gapFrames(
  from: number,
  to: number,
  count: number,
  spacing: Spacing,
): number[] {
  const span = to - from,
    frames = new Set<number>();
  if (span < 2 || count < 1) return [];
  // A short gap cannot hold every requested step: the steps share out what the
  // gap has room for, and land strictly between the two keys.
  const allowed = Math.min(count, span - 1);
  for (let i = 0; i < allowed; i++) {
    const frame = clamp(
      Math.round(from + span * spacingAt(i, allowed, spacing)),
      from + 1,
      to - 1,
    );
    frames.add(frame);
  }
  return [...frames].sort((a, b) => a - b);
}

export function animatedChannels(layer: Layer): Channel[] {
  const found = new Set<Channel>();
  for (const key of layer.keys)
    for (const channel of Object.keys(key.values) as Channel[])
      found.add(channel);
  return [...found];
}

function base(layer: Layer, channel: Channel): number {
  return channel.startsWith("bone:")
    ? (layer.bones?.find((b) => b.id === channel.slice(5))?.angle ?? 0)
    : ((layer.transform as unknown as Record<string, number>)[channel] ?? 0);
}

/**
 * Inserts sampled in-betweens between the keys that bracket `range`. Each
 * inserted key carries the pose the curve already passes through at that frame,
 * and inherits the timing of the key it followed, so the silhouette on existing
 * frames is unchanged.
 */
export function insertBreakdowns(
  layer: Layer,
  range: [number, number],
  count: number,
  spacing: Spacing,
): number {
  const keys = [...layer.keys].sort((a, b) => a.frame - b.frame);
  if (keys.length < 2 || count < 1) return 0;
  const channels = animatedChannels(layer);
  const start = keys.filter((k) => k.frame <= range[0]).at(-1) ?? keys[0],
    end = keys.filter((k) => k.frame >= range[1])[0] ?? keys.at(-1)!;
  if (start.id === end.id) return 0;
  const inside = keys.filter(
    (k) => k.frame >= start.frame && k.frame <= end.frame,
  );
  const source = [...layer.keys];
  const additions: Key[] = [];
  for (let i = 0; i < inside.length - 1; i++) {
    const a = inside[i],
      b = inside[i + 1];
    for (const frame of gapFrames(a.frame, b.frame, count, spacing)) {
      if (inside.some((k) => k.frame === frame)) continue;
      const values: Key["values"] = {};
      for (const channel of channels)
        values[channel] = Number(
          channelAt(base(layer, channel), source, channel, frame).toFixed(4),
        );
      if (!Object.keys(values).length) continue;
      additions.push({
        id: uid(),
        frame,
        easing: a.easing,
        values,
        ...(a.curve ? { curve: a.curve } : {}),
      });
    }
  }
  if (!additions.length) return 0;
  layer.keys = [...layer.keys, ...additions].sort((a, b) => a.frame - b.frame);
  return additions.length;
}

export type FixId =
  "even" | "first" | "last" | "smooth" | "spread" | "collapse";

export interface Note {
  id: string;
  level: "note" | "warning";
  text: string;
  fix?: FixId;
  fixLabel?: string;
}

function vector(layer: Layer, channels: Channel[], frame: number) {
  return channels.map((c) => channelAt(base(layer, c), layer.keys, c, frame));
}

function same(a: number[], b: number[], tolerance = 1e-3) {
  return a.every((v, i) => Math.abs(v - b[i]) <= tolerance);
}

/** What a move is doing, read from its keys. Pure reporting: no edits. */
export function auditLayer(layer: Layer, range: [number, number]): Note[] {
  const notes: Note[] = [],
    channels = animatedChannels(layer);
  const keys = layer.keys
    .filter((k) => k.frame >= range[0] && k.frame <= range[1])
    .sort((a, b) => a.frame - b.frame);
  if (!channels.length || keys.length < 2) {
    notes.push({
      id: "few-keys",
      level: "note",
      text: "Fewer than two keys in the work area, so there is no move to read yet. Place two poses and the audit will describe the timing.",
    });
    return notes;
  }

  // Spacing between poses, and how far the pose travels on each step.
  const gaps: number[] = [],
    steps: { from: number; to: number; distance: number; perFrame: number }[] =
      [];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i],
      b = keys[i + 1],
      gap = b.frame - a.frame;
    if (gap <= 0) continue;
    const from = vector(layer, channels, a.frame),
      to = vector(layer, channels, b.frame),
      distance = Math.max(
        ...channels.map((_, at) => Math.abs(to[at] - from[at])),
      );
    gaps.push(gap);
    steps.push({
      from: a.frame,
      to: b.frame,
      distance,
      perFrame: distance / gap,
    });
  }
  const moving = steps.filter((s) => s.distance > 1e-3);

  if (!moving.length) {
    notes.push({
      id: "no-motion",
      level: "note",
      text: `Frames ${range[0]}–${range[1]} hold one pose. Useful as a hold, wasted if you meant movement.`,
      fix: "collapse",
      fixLabel: "Remove repeated keys",
    });
    return notes;
  }

  for (const step of moving) {
    if (step.perFrame > 60 && step.distance > 120)
      notes.push({
        id: `pop-${step.from}`,
        level: "warning",
        text: `A ${Math.round(step.distance)} px jump in ${step.to - step.from} frame${step.to - step.from === 1 ? "" : "s"} between frames ${step.from} and ${step.to}. That reads as a flash rather than a move.`,
        fix: "spread",
        fixLabel: "Spread with in-betweens",
      });
    else if (step.to - step.from > 12)
      notes.push({
        id: `long-${step.from}`,
        level: "note",
        text: `${step.to - step.from} frames between the poses at ${step.from} and ${step.to} with no in-between; add them to judge the timing.`,
        fix: "spread",
        fixLabel: "Add in-betweens",
      });
  }

  const dead = steps
    .filter((s) => s.distance <= 1e-3 && s.to - s.from > 1)
    .reduce((total, s) => total + (s.to - s.from), 0);
  if (dead > 3)
    notes.push({
      id: "dead",
      level: "note",
      text: `${dead} frames repeat a pose inside the move. Collapsing them keeps the timing but removes the dead steps.`,
      fix: "collapse",
      fixLabel: "Remove repeated keys",
    });

  const perFrame = moving.map((s) => s.perFrame),
    slowest = Math.min(...perFrame),
    fastest = Math.max(...perFrame);
  if (gaps.length > 1 && new Set(gaps).size === 1 && moving.length > 1)
    notes.push({
      id: "even",
      level: "note",
      text: `Every step is ${gaps[0]} frame${gaps[0] === 1 ? "" : "s"}: constant speed. Favour a pose to give the move weight.`,
      fix: "first",
      fixLabel: "Favour first pose",
    });
  if (keys.some((k) => k.easing === "linear") && moving.length)
    notes.push({
      id: "linear",
      level: "note",
      text: "Some keys are linear, so they start and stop instantly. Smooth easing reads more naturally.",
      fix: "smooth",
      fixLabel: "Smooth every key",
    });
  if (fastest > slowest * 4 && moving.length > 1)
    notes.push({
      id: "ratio",
      level: "note",
      text: `Speed varies ${(fastest / slowest).toFixed(1)}× across the move. That is a strong accent — keep it only where you want the eye to snap.`,
    });

  const first = keys[0],
    lead = first.frame - range[0];
  if (lead >= 8)
    notes.push({
      id: "lead",
      level: "note",
      text: `Nothing moves for the first ${lead} frames of the work area (the first key is at ${first.frame}).`,
    });
  return notes;
}

export interface SceneAudit {
  layer: Layer;
  notes: Note[];
  keys: number;
  channels: Channel[];
}

/** Audits every layer that actually animates, longest first. */
export function auditScene(
  scene: Scene,
  range: [number, number],
): SceneAudit[] {
  return scene.layers
    .filter((l) => l.visible && animatedChannels(l).length > 0)
    .map((layer) => ({
      layer,
      notes: auditLayer(layer, range),
      keys: layer.keys.length,
      channels: animatedChannels(layer),
    }))
    .sort((a, b) => b.keys - a.keys);
}

/** Keys that repeat the pose on both sides, safe to drop inside a hold. */
export function redundantKeys(layer: Layer, range: [number, number]): string[] {
  const channels = animatedChannels(layer),
    keys = layer.keys
      .filter((k) => k.frame >= range[0] && k.frame <= range[1])
      .sort((a, b) => a.frame - b.frame),
    drop: string[] = [];
  for (let i = 1; i < keys.length - 1; i++) {
    const before = vector(layer, channels, keys[i - 1].frame),
      here = vector(layer, channels, keys[i].frame),
      after = vector(layer, channels, keys[i + 1].frame);
    if (same(before, here) && same(here, after)) drop.push(keys[i].id);
  }
  return drop;
}

export function spacingForFix(fix: FixId): Spacing {
  return fix === "first" ? "first" : fix === "last" ? "last" : "even";
}

/** How many in-betweens a step deserves when a fix asks for spacing. */
export function stepCount(gap: number): number {
  return clamp(Math.round(gap / 3), 1, 8);
}
