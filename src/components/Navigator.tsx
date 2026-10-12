import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bone,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileImage,
  Film,
  Folder,
  Layers,
  Lock,
  Music2,
  Plus,
  Square,
  Trash2,
  Type,
  Unlock,
  Upload,
  Pencil,
  Images,
  Clapperboard,
} from "lucide-react";
import { useStudio } from "../state/studio";
import { layer, uid, type Layer } from "../core/model";
import { Section } from "./Common";
const icon = (l: Layer) =>
  l.kind === "paint"
    ? Pencil
    : l.kind === "rig"
      ? Bone
      : l.kind === "text"
        ? Type
        : l.kind === "image"
          ? FileImage
          : l.kind === "video"
            ? Film
            : l.kind === "group"
              ? Folder
              : Square;
export function Navigator({
  onImport,
  onReference,
}: {
  onImport: () => void;
  onReference: () => void;
}) {
  const s = useStudio(),
    doc = s.document!,
    scene = doc.scenes.find((sc) => sc.id === s.sceneId)!,
    [collapsed, setCollapsed] = useState<string[]>([]),
    [renaming, setRenaming] = useState<string | null>(null),
    [drag, setDrag] = useState<string | null>(null);
  const tabs = [
    { id: "layers" as const, title: "Layers", icon: Layers },
    { id: "assets" as const, title: "Assets", icon: FileImage },
    { id: "scenes" as const, title: "Scenes", icon: Clapperboard },
    { id: "reference" as const, title: "Refs", icon: Images },
  ];
  const visible = (l: Layer) => {
    let parent = l.parent;
    while (parent) {
      if (collapsed.includes(parent)) return false;
      parent = scene.layers.find((l) => l.id === parent)?.parent ?? null;
    }
    return true;
  };
  const depth = (l: Layer) => {
    let n = 0,
      p = l.parent;
    while (p && n < 32) {
      n++;
      p = scene.layers.find((l) => l.id === p)?.parent ?? null;
    }
    return n;
  };
  return (
    <aside className="navigator">
      <div
        className="navigator-tabs"
        role="tablist"
        aria-label="Navigator panels"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={s.navigator === t.id}
            aria-label={t.title}
            title={t.title}
            onClick={() => s.set({ navigator: t.id })}
          >
            <t.icon size={14} />
            <span>{t.title}</span>
          </button>
        ))}
      </div>
      <div className="navigator-scroll">
        {s.navigator === "layers" ? (
          <>
            <div className="navigator-heading">
              <span>SCENE STACK</span>
              <small>{scene.layers.length}</small>
            </div>
            <div className="layer-stack">
              {[...scene.layers]
                .reverse()
                .filter(visible)
                .map((l) => {
                  const Icon = icon(l);
                  return (
                    <div
                      key={l.id}
                      className={`layer-row ${s.selected.includes(l.id) ? "selected" : ""} ${!l.visible ? "hidden" : ""}`}
                      draggable
                      onDragStart={() => setDrag(l.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (drag) {
                          s.commit("Reorder layer", (_d, sc) => {
                            const source = sc.layers.findIndex(
                                (l) => l.id === drag,
                              ),
                              target = sc.layers.findIndex(
                                (x) => x.id === l.id,
                              );
                            if (source >= 0 && target >= 0) {
                              const [item] = sc.layers.splice(source, 1);
                              sc.layers.splice(target, 0, item);
                            }
                          });
                          setDrag(null);
                        }
                      }}
                    >
                      <button
                        className="layer-disclosure"
                        disabled={l.kind !== "group"}
                        aria-label={`Toggle group ${l.name}`}
                        style={{ marginLeft: depth(l) * 10 }}
                        onClick={() =>
                          setCollapsed((old) =>
                            old.includes(l.id)
                              ? old.filter((id) => id !== l.id)
                              : [...old, l.id],
                          )
                        }
                      >
                        {l.kind === "group" ? (
                          collapsed.includes(l.id) ? (
                            <ChevronRight size={11} />
                          ) : (
                            <ChevronDown size={11} />
                          )
                        ) : null}
                      </button>
                      <button
                        className="layer-select"
                        aria-label={`Select ${l.name}`}
                        onClick={(e) => s.select(l.id, e.shiftKey)}
                      >
                        <Icon size={13} />
                        <span>{l.name}</span>
                      </button>
                      <button
                        aria-label={`${l.visible ? "Hide" : "Show"} ${l.name}`}
                        onClick={() =>
                          s.patchLayer(l.id, { visible: !l.visible })
                        }
                      >
                        {l.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button
                        aria-label={`${l.locked ? "Unlock" : "Lock"} ${l.name}`}
                        onClick={() =>
                          s.patchLayer(l.id, { locked: !l.locked })
                        }
                      >
                        {l.locked ? <Lock size={11} /> : <Unlock size={11} />}
                      </button>
                    </div>
                  );
                })}
              {!scene.layers.length && (
                <div className="empty-panel">
                  <Layers size={25} />
                  <strong>A blank scene.</strong>
                  <p>Insert artwork or start drawing.</p>
                </div>
              )}
            </div>
            <div className="insert-strip">
              <button onClick={() => s.add("paint")}>
                <Plus size={12} />
                Drawing layer
              </button>
              <button
                aria-label="Insert rectangle"
                title="Rectangle"
                onClick={() => s.add("shape", "rect")}
              >
                <Square size={13} />
              </button>
              <button
                aria-label="Insert text"
                title="Text"
                onClick={() => s.add("text")}
              >
                <Type size={13} />
              </button>
              <button
                aria-label="Insert armature"
                title="Armature"
                onClick={() => s.add("rig")}
              >
                <Bone size={13} />
              </button>
            </div>
            <Section title="Arrange">
              <div className="property-actions">
                <button
                  aria-label="Move selection forward"
                  disabled={!s.selected.length}
                  onClick={() => s.arrange(s.selected[0], 1)}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  aria-label="Move selection backward"
                  disabled={!s.selected.length}
                  onClick={() => s.arrange(s.selected[0], -1)}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  aria-label="Duplicate layer"
                  disabled={!s.selected.length}
                  onClick={() => s.duplicate()}
                >
                  <Copy size={12} />
                </button>
                <button
                  aria-label="Delete layer"
                  disabled={!s.selected.length}
                  onClick={() => s.remove()}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </Section>
          </>
        ) : s.navigator === "assets" ? (
          <>
            <div className="navigator-heading">
              <span>EMBEDDED MEDIA</span>
              <small>{doc.assets.length}</small>
            </div>
            <p className="panel-note">
              Reusable files inside this document. No external paths, cloud
              storage or missing-media links.
            </p>
            <div className="asset-stack">
              {doc.assets.map((a) => (
                <button
                  key={a.id}
                  title={`Place ${a.name}`}
                  aria-label={`Place ${a.name}`}
                  onClick={() =>
                    s.commit("Place asset", (d, sc) => {
                      if (a.kind === "audio") {
                        sc.sounds.push({
                          id: uid(),
                          asset: a.id,
                          name: a.name,
                          start: s.frame,
                          trim: 0,
                          end: Math.min(
                            sc.length,
                            s.frame + Math.ceil(a.duration * d.canvas.fps),
                          ),
                          gain: 1,
                          muted: false,
                        });
                      } else {
                        const n = layer(
                          a.kind === "video" ? "video" : "image",
                          d.canvas,
                          a.name,
                        );
                        n.asset = a.id;
                        n.width = a.width;
                        n.height = a.height;
                        n.transform.scaleX = n.transform.scaleY = Math.min(
                          1,
                          (d.canvas.width * 0.65) / a.width,
                          (d.canvas.height * 0.65) / a.height,
                        );
                        n.start = s.frame;
                        n.end = Math.min(
                          sc.length,
                          a.kind === "video"
                            ? s.frame + Math.ceil(a.duration * d.canvas.fps)
                            : sc.length,
                        );
                        sc.layers.push(n);
                      }
                    })
                  }
                >
                  {a.kind === "image" ? (
                    <img src={a.data} alt="" />
                  ) : a.kind === "audio" ? (
                    <Music2 size={24} />
                  ) : (
                    <Film size={24} />
                  )}
                  <strong>{a.name}</strong>
                  <span>
                    {a.kind === "audio"
                      ? `${a.duration.toFixed(1)}s`
                      : a.kind === "video"
                        ? `${a.frames.length} proxy frames`
                        : `${a.width} × ${a.height}`}
                  </span>
                </button>
              ))}
            </div>
            <button
              className="button secondary panel-import"
              onClick={onImport}
            >
              <Upload size={14} />
              Import media
            </button>
          </>
        ) : s.navigator === "scenes" ? (
          <>
            <div className="navigator-heading">
              <span>SCENE ORDER</span>
              <small>{doc.scenes.length}/32</small>
            </div>
            <div className="scene-stack">
              {doc.scenes.map((sc, i) => (
                <article
                  key={sc.id}
                  className={sc.id === scene.id ? "active" : ""}
                >
                  <button
                    className="scene-open"
                    onClick={() => s.switchScene(sc.id)}
                  >
                    <span className="scene-index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <strong>{sc.name}</strong>
                      <small>
                        {sc.length} frames · {sc.layers.length} layers ·{" "}
                        {(sc.length / doc.canvas.fps).toFixed(2)}s
                      </small>
                    </div>
                    <i style={{ background: sc.background }} />
                  </button>
                  {renaming === sc.id ? (
                    <input
                      aria-label="Scene name"
                      autoFocus
                      defaultValue={sc.name}
                      maxLength={100}
                      onBlur={(e) => {
                        s.sceneAction(sc.id, "rename", e.target.value);
                        setRenaming(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                    />
                  ) : (
                    <div className="scene-actions">
                      <button
                        aria-label={`Rename ${sc.name}`}
                        onClick={() => setRenaming(sc.id)}
                      >
                        Rename
                      </button>
                      <span />
                      <button
                        aria-label={`Move ${sc.name} earlier`}
                        disabled={i === 0}
                        onClick={() => s.sceneAction(sc.id, "up")}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        aria-label={`Duplicate ${sc.name}`}
                        onClick={() => s.sceneAction(sc.id, "duplicate")}
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        aria-label={`Delete ${sc.name}`}
                        disabled={doc.scenes.length === 1}
                        onClick={() => {
                          if (
                            confirm(`Delete ${sc.name}? Undo can restore it.`)
                          )
                            s.sceneAction(sc.id, "delete");
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <button
              className="button secondary panel-import"
              disabled={doc.scenes.length >= 32}
              onClick={() => s.addScene()}
            >
              <Plus size={14} />
              New scene
            </button>
            <p className="panel-note">
              Render order follows this list. Every scene has its own camera,
              work area, layers and audio.
            </p>
          </>
        ) : (
          <>
            <div className="navigator-heading">
              <span>REFERENCE BOARD</span>
              <small>{doc.references.length}/12</small>
            </div>
            <p className="panel-note">
              References and notes travel in your .lam file, but never appear in
              renders.
            </p>
            {doc.references.map((r) => (
              <div className="reference-card" key={r.id}>
                <img
                  src={doc.assets.find((a) => a.id === r.asset)?.data}
                  alt={r.name}
                />
                <label className="text-field">
                  <span>Reference name</span>
                  <input
                    defaultValue={r.name}
                    aria-label={`Name ${r.name}`}
                    maxLength={100}
                    onBlur={(e) => {
                      if (e.target.value !== r.name)
                        s.referenceNote(r.id, e.target.value, r.notes);
                    }}
                  />
                </label>
                <label className="text-field">
                  <span>Notes</span>
                  <textarea
                    aria-label={`Notes for ${r.name}`}
                    defaultValue={r.notes}
                    rows={4}
                    maxLength={2000}
                    onBlur={(e) => {
                      if (e.target.value !== r.notes)
                        s.referenceNote(r.id, r.name, e.target.value);
                    }}
                  />
                </label>
                <button
                  className="subtle danger-text"
                  onClick={() => s.removeReference(r.id)}
                >
                  <Trash2 size={12} />
                  Remove reference
                </button>
              </div>
            ))}
            {!doc.references.length && (
              <div className="empty-panel">
                <Images size={24} />
                <strong>Keep inspiration nearby.</strong>
                <p>Add your own study images. Nothing is uploaded.</p>
              </div>
            )}
            <button
              className="button secondary panel-import"
              disabled={doc.references.length >= 12}
              onClick={onReference}
            >
              <Plus size={14} />
              Add reference
            </button>
          </>
        )}
      </div>
      <div className="navigator-footer">
        <Upload size={12} />
        <button onClick={onImport}>Import artwork, footage or sound</button>
      </div>
    </aside>
  );
}
