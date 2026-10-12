import {
  Bone,
  Circle,
  Eraser,
  Hand,
  MousePointer2,
  PaintBucket,
  Pencil,
  Pipette,
  Square,
  Type,
  Settings2,
} from "lucide-react";
import { useStudio } from "../state/studio";
import type { Tool } from "../core/model";
const tools: { id: Tool; name: string; key: string; icon: typeof Pencil }[] = [
  { id: "select", name: "Selection", key: "V", icon: MousePointer2 },
  { id: "hand", name: "Hand", key: "H", icon: Hand },
  { id: "brush", name: "Brush", key: "B", icon: Pencil },
  { id: "erase", name: "Eraser", key: "E", icon: Eraser },
  { id: "fill", name: "Fill", key: "F", icon: PaintBucket },
  { id: "picker", name: "Eyedropper", key: "I", icon: Pipette },
  { id: "rect", name: "Rectangle", key: "R", icon: Square },
  { id: "ellipse", name: "Ellipse", key: "O", icon: Circle },
  { id: "text", name: "Type", key: "T", icon: Type },
  { id: "rig", name: "Rig pose", key: "G", icon: Bone },
];
export function Toolbox() {
  const tool = useStudio((s) => s.tool),
    prefs = useStudio((s) => s.preferences);
  return (
    <aside className="toolbox" aria-label="Studio tools">
      <div>
        {tools.map((t, i) => (
          <div
            className={i === 2 || i === 6 || i === 9 ? "tool-separated" : ""}
            key={t.id}
          >
            <button
              aria-label={`${t.name} tool`}
              aria-pressed={tool === t.id}
              title={`${t.name} · ${t.key}`}
              className={tool === t.id ? "active" : ""}
              onClick={() => useStudio.setState({ tool: t.id, playing: false })}
            >
              <t.icon size={18} strokeWidth={1.6} />
            </button>
          </div>
        ))}
      </div>
      <div className="tool-colors">
        <label>
          <input
            type="color"
            aria-label="Drawing foreground"
            value={prefs.foreground}
            onChange={(e) =>
              useStudio.getState().pref("foreground", e.target.value)
            }
          />
        </label>
        <button
          style={{ background: prefs.background }}
          aria-label="Swap drawing colors"
          onClick={() => {
            useStudio.getState().pref("foreground", prefs.background);
            useStudio.getState().pref("background", prefs.foreground);
          }}
        />
      </div>
      <div className="toolbox-bottom">
        <button
          aria-label="Studio settings"
          onClick={() => useStudio.setState({ dialog: "settings" })}
        >
          <Settings2 size={17} />
        </button>
      </div>
    </aside>
  );
}
