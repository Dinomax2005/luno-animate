import { Fragment, useRef, useState, type PointerEvent } from "react";
import {
  ChevronDown,
  Copy,
  Diamond,
  DiamondPlus,
  Film,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat2,
  SkipBack,
  SkipForward,
  Scissors,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useStudio } from "../state/studio";
import { clamp, locked } from "../core/motion";
import type { Layer } from "../core/model";
const tc = (frame: number, fps: number) =>
  `${String(Math.floor(frame / fps)).padStart(2, "0")}:${String(frame % fps).padStart(2, "0")}`;
interface Drag {
  kind: "key" | "cel" | "clip" | "trim-in" | "trim-out";
  id: string;
  key?: string;
  from: number;
  to: number;
  pointer: number;
  start: number;
  end: number;
  source: number;
}
export function Timeline({ onSound }: { onSound: () => void }) {
  const s = useStudio(),
    doc = s.document!,
    scene = doc.scenes.find((sc) => sc.id === s.sceneId)!,
    fw = s.frameWidth;
  const scroll = useRef<HTMLDivElement>(null),
    range = useRef<{ start: number; end: number } | null>(null),
    drag = useRef<Drag | null>(null),
    [ghost, setGhost] = useState<Drag | null>(null),
    [selectedRange, setRange] = useState<[number, number] | null>(null),
    [expanded, setExpanded] = useState<string[]>([]);
  const frameAt = (e: PointerEvent) =>
    clamp(
      Math.round(
        (e.clientX - e.currentTarget.getBoundingClientRect().left) / fw,
      ),
      0,
      scene.length - 1,
    );
  const finish = (e: PointerEvent) => {
    s.set({ interacting: false });
    if (range.current) {
      s.workArea(
        Math.min(range.current.start, range.current.end),
        Math.max(range.current.start, range.current.end),
      );
      range.current = null;
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const dragStart = (
    e: PointerEvent,
    l: Layer,
    kind: Drag["kind"],
    key?: string,
    frame = 0,
  ) => {
    if (e.button || locked(l, scene.layers) || s.busy) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    s.set({ playing: false });
    drag.current = {
      kind,
      id: l.id,
      key,
      from: frame,
      to: frame,
      pointer: e.clientX,
      start: l.start,
      end: l.end,
      source: l.sourceIn,
    };
    s.beginGesture();
    setGhost({ ...drag.current });
  };
  const dragMove = (e: PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const delta = Math.round((e.clientX - g.pointer) / fw);
    g.to = clamp(g.from + delta, 0, scene.length - 1);
    setGhost({ ...g });
    if (g.kind === "clip" || g.kind.startsWith("trim")) {
      const length = g.end - g.start;
      let start = g.start,
        end = g.end,
        source = g.source;
      if (g.kind === "clip") {
        start = clamp(g.start + delta, 0, scene.length - length);
        end = start + length;
      }
      if (g.kind === "trim-in") {
        start = clamp(
          g.start + delta,
          Math.max(0, g.start - Math.floor(g.source * doc.canvas.fps)),
          g.end - 1,
        );
        source = g.source + (start - g.start) / doc.canvas.fps;
      }
      if (g.kind === "trim-out")
        end = clamp(g.end + delta, g.start + 1, scene.length);
      s.set({
        document: {
          ...doc,
          scenes: doc.scenes.map((sc) =>
            sc.id === scene.id
              ? {
                  ...sc,
                  layers: sc.layers.map((l) =>
                    l.id === g.id ? { ...l, start, end, sourceIn: source } : l,
                  ),
                  sounds: sc.sounds.map((a) =>
                    a.id === sc.layers.find((l) => l.id === g.id)?.sound
                      ? { ...a, start, end, trim: source }
                      : a,
                  ),
                }
              : sc,
          ),
        },
      });
    }
  };
  const dragEnd = (e: PointerEvent, cancel = false) => {
    const g = drag.current;
    drag.current = null;
    setGhost(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (!g) return;
    if (cancel) {
      s.cancelGesture();
      return;
    }
    s.endGesture();
    if (g.kind === "key" && g.key && g.to !== g.from)
      s.moveKey(g.id, g.key, g.to);
    if (g.kind === "cel" && g.to !== g.from)
      s.editCel(g.id, g.from, "move", g.to);
  };
  return (
    <section
      className="timeline"
      style={{ height: s.preferences.timeline }}
      aria-label="Animation timeline"
    >
      <div className="timeline-toolbar">
        <div className="timeline-title">
          <Film size={14} />
          <strong>Timeline</strong>
          <span>{scene.name}</span>
          <button
            title="Scene duration"
            onClick={() => s.set({ dialog: "settings" })}
          >
            {(scene.length / doc.canvas.fps).toFixed(2)}s
          </button>
        </div>
        <div className="transport">
          <button
            aria-label="First frame"
            onClick={() => s.set({ frame: scene.work[0], playing: false })}
          >
            <SkipBack size={14} />
          </button>
          <button
            className="play"
            aria-label={s.playing ? "Pause playback" : "Play animation"}
            onClick={() => s.set({ playing: !s.playing })}
          >
            {s.playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            aria-label="Last frame"
            onClick={() => s.set({ frame: scene.work[1], playing: false })}
          >
            <SkipForward size={14} />
          </button>
          <span className="timecode">{tc(s.frame, doc.canvas.fps)}</span>
          <button
            aria-label="Loop playback"
            aria-pressed={s.preferences.loop}
            onClick={() => s.pref("loop", !s.preferences.loop)}
          >
            <Repeat2 size={14} />
          </button>
        </div>
        <div className="timeline-actions">
          {s.workspace === "Draw" ? (
            <>
              <button
                title="Duplicate next cel · F6"
                aria-label="Duplicate next cel"
                onClick={() => s.newCel(true)}
              >
                <Copy size={12} />
                <span>Duplicate</span>
              </button>
              <button
                title="Blank next cel · F7"
                aria-label="Blank next cel"
                onClick={() => s.newCel(false)}
              >
                <Plus size={12} />
                <span>Blank</span>
              </button>
            </>
          ) : (
            <>
              <button
                title="Insert keyframe · K"
                aria-label="Insert keyframe"
                onClick={() => s.addKey()}
              >
                <DiamondPlus size={14} />
              </button>
              <button
                aria-label="Auto-key"
                aria-pressed={s.preferences.autoKey}
                onClick={() => s.pref("autoKey", !s.preferences.autoKey)}
              >
                Auto-key
              </button>
            </>
          )}
          <button aria-label="Import sound" onClick={onSound}>
            <Music2 size={14} />
          </button>
          <select
            aria-label="Timeline frame rate"
            value={doc.canvas.fps}
            onChange={(e) => s.timing(scene.length, Number(e.target.value))}
          >
            {[12, 15, 24, 25, 30, 60].map((f) => (
              <option key={f} value={f}>
                {f} fps
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="timeline-work">
        <span>WORK AREA</span>
        <input
          type="number"
          aria-label="Work area in"
          value={scene.work[0] + 1}
          min={1}
          max={scene.work[1] + 1}
          onChange={(e) =>
            s.workArea(Number(e.target.value) - 1, scene.work[1])
          }
        />
        <i>→</i>
        <input
          type="number"
          aria-label="Work area out"
          value={scene.work[1] + 1}
          min={scene.work[0] + 1}
          max={scene.length}
          onChange={(e) =>
            s.workArea(scene.work[0], Number(e.target.value) - 1)
          }
        />
        <button onClick={() => s.workArea(0, scene.length - 1)}>
          Full scene
        </button>
        <button
          aria-label="Reverse drawing exposures in work area"
          title="Reverse exposed drawing frames in this range"
          onClick={() => s.reverseCels(scene.work[0], scene.work[1])}
        >
          <Scissors size={11} />
          Reverse exposures
        </button>
        <span className="work-hint">Shift-drag ruler to set range</span>
        <div />
        <button
          aria-label="Zoom timeline out"
          disabled={fw <= 4}
          onClick={() =>
            s.set({ frameWidth: Math.max(4, Math.round(fw / 1.4)) })
          }
        >
          <Minus size={12} />
        </button>
        <button
          aria-label="Zoom timeline in"
          disabled={fw >= 32}
          onClick={() =>
            s.set({ frameWidth: Math.min(32, Math.round(fw * 1.4)) })
          }
        >
          <Plus size={12} />
        </button>
      </div>
      <div className="timeline-scroll" ref={scroll}>
        <div
          className="timeline-sheet"
          style={{
            width: `calc(var(--track-label-width, 200px) + ${scene.length * fw}px)`,
          }}
        >
          <div className="ruler-row">
            <div className="timeline-label-heading">
              LAYERS & SOUND <small>{scene.layers.length}</small>
            </div>
            <div
              className="timeline-ruler"
              role="slider"
              aria-label="Timeline playhead"
              aria-valuemin={1}
              aria-valuemax={scene.length}
              aria-valuenow={s.frame + 1}
              tabIndex={0}
              onPointerDown={(e) => {
                if (e.button) return;
                s.set({ playing: false, frame: frameAt(e), interacting: true });
                e.currentTarget.setPointerCapture(e.pointerId);
                if (e.shiftKey) {
                  range.current = { start: frameAt(e), end: frameAt(e) };
                  setRange([frameAt(e), frameAt(e)]);
                }
              }}
              onPointerMove={(e) => {
                if (e.buttons !== 1) return;
                const frame = frameAt(e);
                s.set({ frame });
                if (range.current) {
                  range.current.end = frame;
                  setRange([range.current.start, frame]);
                }
              }}
              onPointerUp={finish}
              onPointerCancel={(e) => {
                range.current = null;
                setRange(null);
                finish(e);
              }}
              onKeyDown={(e) => {
                const f =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? scene.length - 1
                      : e.key === "ArrowLeft"
                        ? s.frame - 1
                        : e.key === "ArrowRight"
                          ? s.frame + 1
                          : null;
                if (f !== null) {
                  e.preventDefault();
                  e.stopPropagation();
                  s.set({
                    frame: clamp(f, 0, scene.length - 1),
                    playing: false,
                  });
                }
              }}
            >
              <div
                className="work-band"
                style={{
                  left: scene.work[0] * fw,
                  width: (scene.work[1] - scene.work[0] + 1) * fw,
                }}
              />
              {selectedRange && (
                <div
                  className="range-band"
                  style={{
                    left: Math.min(...selectedRange) * fw,
                    width:
                      (Math.abs(selectedRange[1] - selectedRange[0]) + 1) * fw,
                  }}
                />
              )}
              {Array.from(
                {
                  length: Math.ceil(
                    scene.length / Math.max(6, Math.round(72 / fw)),
                  ),
                },
                (_, i) => i * Math.max(6, Math.round(72 / fw)),
              ).map((f) => (
                <span className="ruler-tick" key={f} style={{ left: f * fw }}>
                  {f + 1}
                </span>
              ))}
              <span className="ruler-playhead" style={{ left: s.frame * fw }} />
            </div>
          </div>
          {[...scene.layers].reverse().map((l) => (
            <Fragment key={l.id}>
              <div
                className={`track-row ${s.selected.includes(l.id) ? "selected" : ""}`}
              >
                <div className="track-label">
                  <button
                    className="track-disclosure"
                    aria-label={`Expand ${l.name} channels`}
                    onClick={() =>
                      setExpanded((old) =>
                        old.includes(l.id)
                          ? old.filter((v) => v !== l.id)
                          : [...old, l.id],
                      )
                    }
                  >
                    {l.keys.length ? <ChevronDown size={10} /> : null}
                  </button>
                  <button
                    className="track-select"
                    onClick={(e) => s.select(l.id, e.shiftKey)}
                  >
                    {l.kind === "paint" ? (
                      <PencilIcon />
                    ) : l.kind === "video" ? (
                      <Film size={11} />
                    ) : (
                      <Diamond size={10} />
                    )}
                    <span>{l.name}</span>
                    {l.locked && <small>LOCK</small>}
                  </button>
                </div>
                <div
                  className="track-content"
                  style={{ backgroundSize: `${fw}px 100%` }}
                  onPointerDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    s.select(l.id);
                    s.set({ frame: frameAt(e), playing: false });
                  }}
                >
                  {l.kind === "video" || l.kind === "image" ? (
                    <div
                      className={`media-clip ${l.kind}`}
                      style={{
                        left: l.start * fw,
                        width: Math.max(4, (l.end - l.start) * fw),
                      }}
                      onPointerDown={(e) => {
                        s.select(l.id);
                        dragStart(e, l, "clip");
                      }}
                      onPointerMove={dragMove}
                      onPointerUp={(e) => dragEnd(e)}
                      onPointerCancel={(e) => dragEnd(e, true)}
                    >
                      <span
                        className="clip-trim left"
                        role="slider"
                        aria-label={`Trim in ${l.name}`}
                        aria-valuenow={l.start + 1}
                        aria-valuemin={1}
                        aria-valuemax={l.end}
                        onPointerDown={(e) => dragStart(e, l, "trim-in")}
                        onPointerMove={dragMove}
                        onPointerUp={(e) => dragEnd(e)}
                      />
                      <small>{l.name}</small>
                      <span
                        className="clip-trim right"
                        role="slider"
                        aria-label={`Trim out ${l.name}`}
                        aria-valuenow={l.end}
                        aria-valuemin={l.start + 1}
                        aria-valuemax={scene.length}
                        onPointerDown={(e) => dragStart(e, l, "trim-out")}
                        onPointerMove={dragMove}
                        onPointerUp={(e) => dragEnd(e)}
                      />
                    </div>
                  ) : null}
                  {l.cels?.map((c, index) => (
                    <button
                      key={c.frame}
                      className={`cel ${c.marks.length ? "filled" : "blank"}`}
                      aria-label={`${l.name} cel at frame ${c.frame + 1}`}
                      style={{
                        left: c.frame * fw,
                        width: Math.max(
                          5,
                          (l.held
                            ? (l.cels?.[index + 1]?.frame ?? scene.length) -
                              c.frame
                            : 1) * fw,
                        ),
                      }}
                      onClick={() => {
                        s.select(l.id);
                        s.set({ frame: c.frame, playing: false });
                      }}
                      onPointerDown={(e) =>
                        dragStart(e, l, "cel", undefined, c.frame)
                      }
                      onPointerMove={dragMove}
                      onPointerUp={(e) => dragEnd(e)}
                      onPointerCancel={(e) => dragEnd(e, true)}
                    >
                      <span>{c.marks.length ? "●" : "○"}</span>
                    </button>
                  ))}
                  {l.keys.map((k) => (
                    <button
                      key={k.id}
                      className={`key-diamond ${s.keySelection.some((v) => v.id === k.id) ? "selected" : ""}`}
                      aria-label={`${l.name} keyframe ${k.frame + 1}`}
                      style={{ left: k.frame * fw }}
                      onClick={(e) => {
                        const previous = s.keySelection;
                        const chosen = e.shiftKey
                          ? previous.some((v) => v.id === k.id)
                            ? previous.filter((v) => v.id !== k.id)
                            : [...previous, { layer: l.id, id: k.id }]
                          : [{ layer: l.id, id: k.id }];
                        s.set({
                          selected: [l.id],
                          frame: k.frame,
                          keySelection: chosen,
                          playing: false,
                        });
                      }}
                      onPointerDown={(e) =>
                        dragStart(e, l, "key", k.id, k.frame)
                      }
                      onPointerMove={dragMove}
                      onPointerUp={(e) => dragEnd(e)}
                      onPointerCancel={(e) => dragEnd(e, true)}
                    >
                      <Diamond size={10} fill="currentColor" />
                    </button>
                  ))}
                  {ghost?.id === l.id &&
                    (ghost.kind === "key" || ghost.kind === "cel") &&
                    ghost.from !== ghost.to && (
                      <span
                        className="key-ghost"
                        style={{ left: ghost.to * fw }}
                      />
                    )}
                  <div
                    className="track-playhead"
                    style={{ left: s.frame * fw }}
                  />
                </div>
              </div>
              {expanded.includes(l.id) &&
                [...new Set(l.keys.flatMap((k) => Object.keys(k.values)))].map(
                  (channel) => (
                    <div className="track-row channel-row" key={channel}>
                      <div className="track-label">
                        <span>
                          {channel.startsWith("bone:")
                            ? l.bones?.find((b) => b.id === channel.slice(5))
                                ?.name
                            : channel}
                        </span>
                      </div>
                      <div
                        className="track-content"
                        style={{ backgroundSize: `${fw}px 100%` }}
                      >
                        {l.keys
                          .filter(
                            (k) =>
                              k.values[channel as keyof typeof k.values] !==
                              undefined,
                          )
                          .map((k) => (
                            <span
                              className="channel-key"
                              key={k.id}
                              style={{ left: k.frame * fw }}
                            />
                          ))}
                        <div
                          className="track-playhead"
                          style={{ left: s.frame * fw }}
                        />
                      </div>
                    </div>
                  ),
                )}
            </Fragment>
          ))}
          {scene.sounds.map((sound) => {
            const a = doc.assets.find((a) => a.id === sound.asset);
            return (
              <div className="track-row audio-row" key={sound.id}>
                <div className="track-label">
                  <Music2 size={11} />
                  <span>{sound.name}</span>
                  <button
                    aria-label={`${sound.muted ? "Unmute" : "Mute"} ${sound.name}`}
                    onClick={() =>
                      s.editSound(sound.id, { muted: !sound.muted })
                    }
                  >
                    {sound.muted ? (
                      <VolumeX size={11} />
                    ) : (
                      <Volume2 size={11} />
                    )}
                  </button>
                </div>
                <div
                  className="track-content"
                  style={{ backgroundSize: `${fw}px 100%` }}
                >
                  <div
                    className={`audio-clip ${sound.muted ? "muted" : ""}`}
                    style={{
                      left: sound.start * fw,
                      width: (sound.end - sound.start) * fw,
                    }}
                  >
                    <svg viewBox="0 0 256 25" preserveAspectRatio="none">
                      {a?.waveform.map((peak, i) => (
                        <path
                          key={i}
                          d={`M${i} ${12.5 - peak * 11}V${12.5 + peak * 11}`}
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                      ))}
                    </svg>
                  </div>
                  <div
                    className="track-playhead"
                    style={{ left: s.frame * fw }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="timeline-footer">
        <span>
          {s.workspace === "Draw"
            ? "F6 duplicate · F7 blank · U onion"
            : "K insert key · Ctrl C/V keyframes · Delete selected keys"}
        </span>
        <span>
          Frame {String(s.frame + 1).padStart(3, "0")} / {scene.length}
          <i>·</i>
          {doc.canvas.fps} fps
        </span>
      </div>
    </section>
  );
}
function PencilIcon() {
  return <span className="tiny-paint-icon">╱</span>;
}
