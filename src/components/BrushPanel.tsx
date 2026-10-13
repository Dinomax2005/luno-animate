import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, Check, RotateCcw } from "lucide-react";
import { brushPresets, brushDefaults, uid } from "../core/model";
import { paintMark } from "../core/paint";
import { useStudio } from "../state/studio";
import { NumberField, Section } from "./Common";
function Sample({ tip }: { tip: (typeof brushPresets)[number]["tip"] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current!.getContext("2d")!;
    context.clearRect(0, 0, 100, 32);
    paintMark(context, {
      id: uid(),
      tool: "brush",
      color: "#d9822b",
      brush: {
        ...brushDefaults,
        tip,
        size:
          tip === "soft" ? 25 : tip === "pencil" ? 4 : tip === "pixel" ? 5 : 12,
      },
      seed: 18,
      points: Array.from({ length: 20 }, (_, i) => ({
        x: 7 + i * 4.5,
        y: 16 + Math.sin(i / 4) * 5,
        p: 0.25 + Math.sin((i / 19) * Math.PI) * 0.7,
      })),
    });
  }, [tip]);
  return <canvas width={100} height={32} ref={canvas} />;
}
export function BrushPanel() {
  const prefs = useStudio((s) => s.preferences),
    brush = prefs.brush;
  const choose = (preset: (typeof brushPresets)[number]) => {
    useStudio
      .getState()
      .pref("brush", {
        ...brush,
        tip: preset.tip,
        size: preset.size,
        spacing:
          preset.tip === "spray" ? 0.3 : preset.tip === "pixel" ? 0.5 : 0.15,
        smoothing: preset.tip === "pixel" ? 0 : 0.45,
      });
    useStudio.setState({ tool: "brush" });
  };
  return (
    <>
      <Section title="Brush library">
        <div className="brush-grid">
          {brushPresets.map((preset) => (
            <button
              key={preset.tip}
              aria-label={preset.name}
              aria-pressed={brush.tip === preset.tip}
              className={brush.tip === preset.tip ? "active" : ""}
              title={preset.description}
              onClick={() => choose(preset)}
            >
              <Sample tip={preset.tip} />
              <span>{preset.name}</span>
              {brush.tip === preset.tip && <Check size={10} />}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Tip dynamics">
        <div className="field-grid">
          <NumberField
            label="Brush size"
            min={1}
            max={256}
            value={brush.size}
            unit="px"
            onChange={(n) =>
              useStudio.getState().pref("brush", { ...brush, size: n })
            }
          />
          <NumberField
            label="Brush opacity"
            min={1}
            max={100}
            value={brush.opacity * 100}
            unit="%"
            onChange={(n) =>
              useStudio.getState().pref("brush", { ...brush, opacity: n / 100 })
            }
          />
          <NumberField
            label="Brush flow"
            min={1}
            max={100}
            value={brush.flow * 100}
            unit="%"
            onChange={(n) =>
              useStudio.getState().pref("brush", { ...brush, flow: n / 100 })
            }
          />
          <NumberField
            label="Stabilization"
            min={0}
            max={95}
            value={brush.smoothing * 100}
            unit="%"
            onChange={(n) =>
              useStudio
                .getState()
                .pref("brush", { ...brush, smoothing: n / 100 })
            }
          />
        </div>
        <label className="switch-line">
          <span>Pen pressure</span>
          <input
            type="checkbox"
            checked={brush.pressure}
            onChange={(e) =>
              useStudio
                .getState()
                .pref("brush", { ...brush, pressure: e.target.checked })
            }
          />
        </label>
        <label className="slider-line">
          Spacing{" "}
          <input
            type="range"
            aria-label="Brush spacing"
            min={0.05}
            max={1}
            step={0.05}
            value={brush.spacing}
            onChange={(e) =>
              useStudio
                .getState()
                .pref("brush", { ...brush, spacing: Number(e.target.value) })
            }
          />
        </label>
        <button
          className="subtle"
          onClick={() =>
            useStudio.getState().pref("brush", { ...brushDefaults })
          }
        >
          <RotateCcw size={12} />
          Reset brush
        </button>
      </Section>
      <p className="panel-note">
        Settings affect new marks only. Each saved stroke keeps its own brush,
        color, pressure and seed.
      </p>
    </>
  );
}
const colors = [
  "#1c1d1f",
  "#3a3d42",
  "#5c6066",
  "#8a8d92",
  "#c2c4c6",
  "#eceae6",
  "#6b3f10",
  "#a8621a",
  "#d9822b",
  "#eda45c",
  "#f6cfa4",
  "#fbe9d6",
  "#1f4f49",
  "#2f6f63",
  "#4b9183",
  "#86b9ac",
  "#cfe3dd",
  "#eef5f2",
  "#6d2b26",
  "#963f37",
  "#bf5f54",
  "#dda19a",
  "#f0cdc7",
  "#fbeae7",
  "#4d4514",
  "#6f6420",
  "#98872f",
  "#c0b269",
  "#ded5a8",
  "#f1ecd6",
];
export function ColorPanel() {
  const prefs = useStudio((s) => s.preferences),
    [hex, setHex] = useState(prefs.foreground);
  useEffect(() => setHex(prefs.foreground), [prefs.foreground]);
  const channels = [
    parseInt(prefs.foreground.slice(1, 3), 16),
    parseInt(prefs.foreground.slice(3, 5), 16),
    parseInt(prefs.foreground.slice(5, 7), 16),
  ];
  return (
    <>
      <Section title="Foreground & background">
        <div className="color-hero">
          <label className="color-large">
            <input
              type="color"
              aria-label="Foreground color"
              value={prefs.foreground}
              onChange={(e) =>
                useStudio.getState().pref("foreground", e.target.value)
              }
            />
          </label>
          <label className="color-large background">
            <input
              type="color"
              aria-label="Background brush color"
              value={prefs.background}
              onChange={(e) =>
                useStudio.getState().pref("background", e.target.value)
              }
            />
          </label>
          <button
            aria-label="Swap foreground and background"
            onClick={() => {
              const s = useStudio.getState();
              s.pref("foreground", prefs.background);
              s.pref("background", prefs.foreground);
            }}
          >
            <ArrowDownUp size={16} />
          </button>
        </div>
        <label className="text-field">
          <span>HEX</span>
          <input
            aria-label="HEX color"
            value={hex.toUpperCase()}
            maxLength={7}
            onChange={(e) => setHex(e.target.value)}
            onBlur={() => {
              if (/^#[0-9a-f]{6}$/i.test(hex))
                useStudio.getState().pref("foreground", hex.toLowerCase());
              else setHex(prefs.foreground);
            }}
          />
        </label>
        <div className="field-grid rgb-fields">
          {["R", "G", "B"].map((label, i) => (
            <NumberField
              label={label}
              key={label}
              min={0}
              max={255}
              value={channels[i]}
              onChange={(n) => {
                channels[i] = Math.round(n);
                useStudio
                  .getState()
                  .pref(
                    "foreground",
                    "#" +
                      channels
                        .map((v) => v.toString(16).padStart(2, "0"))
                        .join(""),
                  );
              }}
            />
          ))}
        </div>
      </Section>
      <Section title="Studio palette">
        <div className="palette-grid">
          {colors.map((color) => (
            <button
              key={color}
              aria-label={`Choose color ${color}`}
              title={color.toUpperCase()}
              style={{ background: color }}
              onClick={() => useStudio.getState().pref("foreground", color)}
            />
          ))}
        </div>
      </Section>
      <p className="panel-note">
        X swaps colors. D restores ink and paper. The eyedropper samples the
        rendered canvas, without guides.
      </p>
    </>
  );
}
