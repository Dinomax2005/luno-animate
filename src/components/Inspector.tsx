import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bone,
  Diamond,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useStudio } from "../state/studio";
import { celAt, channelAt, pose } from "../core/motion";
import { uid, type Key } from "../core/model";
import { BrushPanel, ColorPanel } from "./BrushPanel";
import { NumberField, Section } from "./Common";
export function Inspector() {
  const s = useStudio(),
    doc = s.document!,
    scene = doc.scenes.find((sc) => sc.id === s.sceneId)!,
    selected = scene.layers.find((l) => l.id === s.selected[0]),
    [tab, setTab] = useState<"properties" | "brush" | "color">("properties");
  useEffect(() => {
    if (["brush", "erase", "fill"].includes(s.tool)) setTab("brush");
    else setTab("properties");
  }, [s.tool]);
  const values = selected ? pose(selected, s.frame) : null,
    key = selected?.keys.find((k) =>
      s.keySelection.some(
        (ref) => ref.layer === selected.id && ref.id === k.id,
      ),
    );
  return (
    <aside className="inspector">
      <div className="panel-title">
        <SlidersHorizontal size={14} />
        <span>Inspector</span>
        <small>{selected ? s.selected.length : "Document"}</small>
      </div>
      <div
        className="inspector-tabs"
        role="tablist"
        aria-label="Inspector panels"
      >
        {(["properties", "brush", "color"] as const).map((name) => (
          <button
            role="tab"
            key={name}
            aria-selected={tab === name}
            onClick={() => setTab(name)}
          >
            {name[0].toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>
      <div className="inspector-scroll">
        {tab === "brush" ? (
          <BrushPanel />
        ) : tab === "color" ? (
          <ColorPanel />
        ) : selected && values ? (
          <>
            <Section title={`${selected.kind} / ${selected.name}`}>
              <label className="text-field">
                <span>Layer name</span>
                <input
                  aria-label="Layer name"
                  key={selected.id}
                  defaultValue={selected.name}
                  maxLength={100}
                  onBlur={(e) => {
                    if (
                      e.target.value.trim() &&
                      e.target.value !== selected.name
                    )
                      s.patchLayer(selected.id, {
                        name: e.target.value.trim(),
                      });
                  }}
                />
              </label>
            </Section>
            <Section title="Transform">
              <div className="field-grid">
                {(["x", "y", "rotation"] as const).map((channel) => (
                  <NumberField
                    label={
                      channel === "rotation"
                        ? "Rotation"
                        : channel.toUpperCase()
                    }
                    key={channel}
                    value={values[channel]}
                    unit={channel === "rotation" ? "°" : "px"}
                    onChange={(v) => s.transform(selected.id, { [channel]: v })}
                  />
                ))}
                <NumberField
                  label="Opacity"
                  min={0}
                  max={100}
                  value={values.opacity * 100}
                  unit="%"
                  onChange={(v) =>
                    s.transform(selected.id, { opacity: v / 100 })
                  }
                />
                <NumberField
                  label="Scale X"
                  min={1}
                  max={10000}
                  value={values.scaleX * 100}
                  unit="%"
                  onChange={(v) =>
                    s.transform(selected.id, { scaleX: v / 100 })
                  }
                />
                <NumberField
                  label="Scale Y"
                  min={1}
                  max={10000}
                  value={values.scaleY * 100}
                  unit="%"
                  onChange={(v) =>
                    s.transform(selected.id, { scaleY: v / 100 })
                  }
                />
              </div>
              <div className="property-actions">
                <button disabled={selected.locked} onClick={() => s.addKey()}>
                  <Diamond size={12} />
                  Insert key
                </button>
                <button
                  aria-label="Reset layer transform"
                  onClick={() =>
                    s.transform(selected.id, {
                      rotation: 0,
                      scaleX: 1,
                      scaleY: 1,
                      opacity: 1,
                    })
                  }
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </Section>
            {selected.kind === "shape" && (
              <Section title="Appearance">
                <div className="field-grid">
                  <NumberField
                    label="Shape width"
                    min={1}
                    max={4096}
                    value={selected.width}
                    onChange={(v) => s.patchLayer(selected.id, { width: v })}
                  />
                  <NumberField
                    label="Shape height"
                    min={1}
                    max={4096}
                    value={selected.height}
                    onChange={(v) => s.patchLayer(selected.id, { height: v })}
                  />
                </div>
                <label className="color-line">
                  Fill
                  <input
                    type="color"
                    aria-label="Shape fill"
                    value={selected.color}
                    onChange={(e) =>
                      s.patchLayer(selected.id, { color: e.target.value })
                    }
                  />
                </label>
                <NumberField
                  label="Stroke width"
                  min={0}
                  max={256}
                  value={selected.line}
                  onChange={(v) => s.patchLayer(selected.id, { line: v })}
                />
                {selected.line > 0 && (
                  <label className="color-line">
                    Stroke
                    <input
                      type="color"
                      aria-label="Shape stroke"
                      value={selected.stroke}
                      onChange={(e) =>
                        s.patchLayer(selected.id, { stroke: e.target.value })
                      }
                    />
                  </label>
                )}
              </Section>
            )}
            {selected.kind === "text" && (
              <Section title="Typography">
                <label className="text-field">
                  <span>Text content</span>
                  <textarea
                    aria-label="Text content"
                    key={selected.id}
                    defaultValue={selected.text}
                    rows={4}
                    maxLength={4000}
                    onBlur={(e) => {
                      if (e.target.value !== selected.text)
                        s.patchLayer(selected.id, { text: e.target.value });
                    }}
                  />
                </label>
                <NumberField
                  label="Font size"
                  min={4}
                  max={600}
                  value={selected.fontSize ?? 64}
                  unit="px"
                  onChange={(v) => s.patchLayer(selected.id, { fontSize: v })}
                />
                <label className="color-line">
                  Color
                  <input
                    type="color"
                    aria-label="Text color"
                    value={selected.color}
                    onChange={(e) =>
                      s.patchLayer(selected.id, { color: e.target.value })
                    }
                  />
                </label>
              </Section>
            )}
            {selected.kind === "paint" && (
              <Section title="Drawing exposures">
                <label className="switch-line">
                  <span>Hold between cels</span>
                  <input
                    type="checkbox"
                    checked={selected.held !== false}
                    onChange={(e) =>
                      s.patchLayer(selected.id, { held: e.target.checked })
                    }
                  />
                </label>
                <div className="property-actions">
                  <button onClick={() => s.newCel(false, true)}>
                    <Plus size={12} />
                    Blank next
                  </button>
                  <button onClick={() => s.newCel(true, true)}>
                    <ArrowRight size={12} />
                    Duplicate next
                  </button>
                </div>
                <div className="cel-mark-stack">
                  <span>
                    {celAt(selected, s.frame)?.marks.length ?? 0} marks / frame{" "}
                    {s.frame + 1}
                  </span>
                  {(celAt(selected, s.frame)?.marks ?? []).map(
                    (mark, index) => (
                      <button
                        key={mark.id}
                        onClick={() =>
                          s.commit("Delete mark", (_d, sc) => {
                            const l = sc.layers.find(
                              (l) => l.id === selected.id,
                            )!;
                            let c = l.cels?.find((c) => c.frame === s.frame);
                            if (!c) {
                              c = {
                                frame: s.frame,
                                marks: structuredClone(
                                  celAt(l, s.frame)?.marks ?? [],
                                ),
                              };
                              l.cels = [...(l.cels ?? []), c];
                            }
                            c.marks.splice(index, 1);
                          })
                        }
                      >
                        <i style={{ background: mark.color }} />
                        {mark.tool === "erase"
                          ? "Eraser"
                          : mark.tool === "fill"
                            ? "Fill"
                            : mark.brush.tip}
                        <small>×</small>
                      </button>
                    ),
                  )}
                </div>
              </Section>
            )}
            {selected.kind === "rig" && (
              <Section title="Armature">
                <label className="text-field">
                  <span>Active joint</span>
                  <select
                    aria-label="Active joint"
                    value={s.bone ?? selected.bones?.[0]?.id}
                    onChange={(e) => s.set({ bone: e.target.value })}
                  >
                    {selected.bones?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                {(() => {
                  const b = selected.bones?.find(
                    (b) => b.id === (s.bone ?? selected.bones?.[0]?.id),
                  );
                  return b ? (
                    <>
                      <NumberField
                        label="Joint angle"
                        min={b.min}
                        max={b.max}
                        value={channelAt(
                          b.angle,
                          selected.keys,
                          `bone:${b.id}`,
                          s.frame,
                        )}
                        unit="°"
                        onChange={(v) =>
                          s.boneAngles(selected.id, { [b.id]: v })
                        }
                      />
                      <NumberField
                        label="Bone length"
                        min={1}
                        max={1000}
                        value={b.length}
                        unit="px"
                        onChange={(v) =>
                          s.patchLayer(selected.id, {
                            bones: selected.bones!.map((x) =>
                              x.id === b.id ? { ...x, length: v } : x,
                            ),
                          })
                        }
                      />
                    </>
                  ) : null;
                })()}
                <div className="property-actions">
                  <button onClick={() => s.set({ tool: "rig" })}>
                    <Bone size={12} />
                    Pose with IK
                  </button>
                  <button
                    onClick={() =>
                      s.patchLayer(selected.id, {
                        bones: [
                          ...(selected.bones ?? []),
                          {
                            id: uid(),
                            name: `Joint ${(selected.bones?.length ?? 0) + 1}`,
                            parent: s.bone ?? selected.bones?.[0]?.id ?? null,
                            length: 60,
                            angle: 0,
                            min: -180,
                            max: 180,
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={12} />
                    Add bone
                  </button>
                </div>
              </Section>
            )}
            {selected.kind !== "rig" && selected.kind !== "group" && (
              <Section title="Rig attachment">
                <select
                  aria-label="Attach to rig"
                  value={selected.bind?.rig ?? ""}
                  onChange={(e) => {
                    const rig = scene.layers.find(
                      (l) => l.id === e.target.value,
                    );
                    s.bind(selected.id, rig?.id ?? null, rig?.bones?.[0]?.id);
                  }}
                >
                  <option value="">None / stage space</option>
                  {scene.layers
                    .filter((l) => l.kind === "rig")
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
                {selected.bind && (
                  <select
                    aria-label="Attachment joint"
                    value={selected.bind.bone}
                    onChange={(e) =>
                      s.bind(selected.id, selected.bind!.rig, e.target.value)
                    }
                  >
                    {scene.layers
                      .find((l) => l.id === selected.bind!.rig)
                      ?.bones?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                )}
              </Section>
            )}
            <Section title="Clip timing">
              <div className="field-grid">
                <NumberField
                  label="Layer in"
                  min={1}
                  max={selected.end}
                  value={selected.start + 1}
                  onChange={(v) =>
                    s.patchLayer(selected.id, { start: Math.round(v) - 1 })
                  }
                />
                <NumberField
                  label="Layer out"
                  min={selected.start + 1}
                  max={scene.length}
                  value={selected.end}
                  onChange={(v) =>
                    s.patchLayer(selected.id, { end: Math.round(v) })
                  }
                />
              </div>
              {selected.kind === "video" && (
                <NumberField
                  label="Source in"
                  min={0}
                  max={30}
                  step={0.05}
                  value={selected.sourceIn}
                  unit="s"
                  onChange={(v) => s.patchLayer(selected.id, { sourceIn: v })}
                />
              )}
              <label className="text-field">
                <span>Blend mode</span>
                <select
                  aria-label="Layer blend mode"
                  value={selected.blend}
                  onChange={(e) =>
                    s.patchLayer(selected.id, {
                      blend: e.target.value as typeof selected.blend,
                    })
                  }
                >
                  <option value="source-over">Normal</option>
                  <option value="multiply">Multiply</option>
                  <option value="screen">Screen</option>
                </select>
              </label>
            </Section>
            {s.workspace !== "Draw" && (
              <Section title="Motion presets">
                <div className="motion-preset-grid">
                  {(["fade", "slide", "spin", "pulse"] as const).map((kind) => (
                    <button key={kind} onClick={() => s.presetMotion(kind)}>
                      {kind}
                    </button>
                  ))}
                </div>
              </Section>
            )}
            {key && (
              <Section title="Selected keyframe">
                <label className="text-field">
                  <span>Interpolation</span>
                  <select
                    aria-label="Keyframe interpolation"
                    value={key.easing}
                    onChange={(e) => s.easing(e.target.value as Key["easing"])}
                  >
                    <option value="linear">Linear</option>
                    <option value="smooth">Smooth</option>
                    <option value="in">Ease in</option>
                    <option value="out">Ease out</option>
                    <option value="hold">Hold</option>
                    <option value="bezier">Custom Bézier</option>
                  </select>
                </label>
                {key.easing === "bezier" && (
                  <Curve
                    curve={key.curve ?? [0.25, 0.1, 0.25, 1]}
                    onChange={(c) => s.easing("bezier", c)}
                  />
                )}
              </Section>
            )}
          </>
        ) : (
          <>
            <Section title="Document">
              <h2 className="inspector-document-name">{doc.title}</h2>
              <p className="panel-note">
                {scene.layers.length} layers · {doc.scenes.length} scenes
                <br />
                RGB · local-first · Pegbar Studio 1.0
              </p>
              <div className="field-grid">
                <NumberField
                  label="Canvas width"
                  min={64}
                  max={4096}
                  value={doc.canvas.width}
                  onChange={(v) =>
                    s.commit("Canvas size", (d) => {
                      d.canvas.width = Math.round(v);
                    })
                  }
                />
                <NumberField
                  label="Canvas height"
                  min={64}
                  max={4096}
                  value={doc.canvas.height}
                  onChange={(v) =>
                    s.commit("Canvas size", (d) => {
                      d.canvas.height = Math.round(v);
                    })
                  }
                />
                <NumberField
                  label="Project FPS"
                  min={1}
                  max={60}
                  value={doc.canvas.fps}
                  onChange={(v) => s.timing(scene.length, Math.round(v))}
                />
                <NumberField
                  label="Scene frames"
                  min={2}
                  max={1800}
                  value={scene.length}
                  onChange={(v) => s.timing(Math.round(v))}
                />
              </div>
              <label className="color-line">
                Background
                <input
                  type="color"
                  aria-label="Scene background"
                  value={scene.background}
                  onChange={(e) =>
                    s.commit("Scene background", (_d, sc) => {
                      sc.background = e.target.value;
                    })
                  }
                />
              </label>
              <button
                className="subtle"
                onClick={() => s.set({ dialog: "settings" })}
              >
                <Settings2 size={13} />
                Document settings
              </button>
            </Section>
            <Section title="Camera">
              <div className="field-grid">
                <NumberField
                  label="Camera X"
                  value={scene.camera.x}
                  onChange={(v) =>
                    s.commit("Camera", (_d, sc) => {
                      sc.camera.x = v;
                    })
                  }
                />
                <NumberField
                  label="Camera Y"
                  value={scene.camera.y}
                  onChange={(v) =>
                    s.commit("Camera", (_d, sc) => {
                      sc.camera.y = v;
                    })
                  }
                />
                <NumberField
                  label="Camera zoom"
                  min={10}
                  max={1000}
                  value={scene.camera.zoom * 100}
                  unit="%"
                  onChange={(v) =>
                    s.commit("Camera", (_d, sc) => {
                      sc.camera.zoom = v / 100;
                    })
                  }
                />
              </div>
              <button
                className="subtle"
                onClick={() =>
                  s.commit("Camera key", (_d, sc) => {
                    const old = sc.camera.keys.find((k) => k.frame === s.frame);
                    sc.camera.keys = [
                      ...sc.camera.keys.filter((k) => k.frame !== s.frame),
                      {
                        id: old?.id ?? uid(),
                        frame: s.frame,
                        easing: "smooth" as const,
                        values: {
                          x: sc.camera.x,
                          y: sc.camera.y,
                          scaleX: sc.camera.zoom,
                        },
                      },
                    ].sort((a, b) => a.frame - b.frame);
                  })
                }
              >
                <Diamond size={12} />
                Key camera
              </button>
            </Section>
          </>
        )}
        {tab === "properties" &&
          s.workspace === "Edit" &&
          scene.sounds.length > 0 && (
            <Section title="Sound mixer">
              {scene.sounds.map((sound) => (
                <div className="sound-control" key={sound.id}>
                  <div>
                    <strong>{sound.name}</strong>
                    <button
                      aria-label={`${sound.muted ? "Unmute" : "Mute"} audio ${sound.name}`}
                      onClick={() =>
                        s.editSound(sound.id, { muted: !sound.muted })
                      }
                    >
                      {sound.muted ? (
                        <VolumeX size={12} />
                      ) : (
                        <Volume2 size={12} />
                      )}
                    </button>
                  </div>
                  <NumberField
                    label={`Volume ${sound.name}`}
                    min={0}
                    max={200}
                    value={sound.gain * 100}
                    unit="%"
                    onChange={(v) => s.editSound(sound.id, { gain: v / 100 })}
                  />
                  {!scene.layers.some((l) => l.sound === sound.id) && (
                    <NumberField
                      label={`Audio source in ${sound.name}`}
                      min={0}
                      max={
                        (doc.assets.find((a) => a.id === sound.asset)
                          ?.duration ?? 1) - 0.01
                      }
                      step={0.05}
                      value={sound.trim}
                      unit="s"
                      onChange={(v) => s.editSound(sound.id, { trim: v })}
                    />
                  )}
                </div>
              ))}
            </Section>
          )}
      </div>
      <div className="inspector-footer">
        <span>All tools. No unlocks.</span>
        <small>PEGBAR / 1.0</small>
      </div>
    </aside>
  );
}
function Curve({
  curve,
  onChange,
}: {
  curve: NonNullable<Key["curve"]>;
  onChange: (c: NonNullable<Key["curve"]>) => void;
}) {
  const [local, setLocal] = useState(curve),
    [drag, setDrag] = useState<number | null>(null);
  useEffect(() => setLocal(curve), [curve]);
  const x = (n: number) => 20 + n * 200,
    y = (n: number) => 140 - n * 120;
  return (
    <svg
      className="curve-editor"
      viewBox="0 0 240 165"
      aria-label="Custom easing curve"
    >
      <path d="M20 140H220M20 20V140" stroke="var(--line)" fill="none" />
      <path
        d={`M20 140L${x(local[0])} ${y(local[1])}M220 20L${x(local[2])} ${y(local[3])}`}
        stroke="var(--muted)"
        fill="none"
      />
      <path
        d={`M20 140C${x(local[0])} ${y(local[1])},${x(local[2])} ${y(local[3])},220 20`}
        stroke="var(--accent)"
        strokeWidth="2"
        fill="none"
      />
      {[0, 2].map((i) => (
        <circle
          key={i}
          role="slider"
          tabIndex={0}
          aria-label={`Easing control ${i / 2 + 1}`}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={local[i]}
          cx={x(local[i])}
          cy={y(local[i + 1])}
          r={5}
          fill="var(--accent)"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag(i);
          }}
          onPointerMove={(e) => {
            if (drag === null) return;
            const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect(),
              c = [...local] as typeof local;
            c[drag] = Math.min(
              1,
              Math.max(0, (((e.clientX - r.left) / r.width) * 240 - 20) / 200),
            );
            c[drag + 1] = Math.min(
              3,
              Math.max(
                -2,
                (140 - ((e.clientY - r.top) / r.height) * 165) / 120,
              ),
            );
            setLocal(c);
          }}
          onPointerUp={() => {
            if (drag !== null) onChange(local);
            setDrag(null);
          }}
          onPointerCancel={() => {
            setLocal(curve);
            setDrag(null);
          }}
          onKeyDown={(e) => {
            const c = [...local] as typeof local;
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              c[i] = Math.min(
                1,
                Math.max(0, c[i] + (e.key === "ArrowRight" ? 0.02 : -0.02)),
              );
              onChange(c);
            }
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              c[i + 1] = Math.min(
                3,
                Math.max(-2, c[i + 1] + (e.key === "ArrowUp" ? 0.02 : -0.02)),
              );
              onChange(c);
            }
          }}
        />
      ))}
    </svg>
  );
}
