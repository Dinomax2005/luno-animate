import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Bone,
  Clapperboard,
  Code2,
  FileArchive,
  Film,
  Grid3X3,
  Image,
  MonitorPlay,
  Keyboard,
  Pencil,
  RefreshCw,
  Search,
  Shield,
} from "lucide-react";
import { useStudio } from "../state/studio";
import { VERSION, type Workspace } from "../core/model";
import { encode } from "../core/codec";
import {
  exportImage,
  exportMovie,
  exportSequence,
  exportSpriteSheet,
  exportSvg,
  movieCapabilities,
  plan,
} from "../core/export";
import { saveMedia } from "../services/files";
import { commands, execute } from "../services/commands";
import { flush, refresh } from "../services/library";
import licence from "../../LICENSE?raw";
import notices from "../../public/legal/NOTICE.txt?raw";
import { Modal, NumberField, Section } from "./Common";
import { auditScene, spacings, type Spacing } from "../core/assist";
const close = () => useStudio.setState({ dialog: null });
export function Dialogs({ onImport }: { onImport: () => void }) {
  const dialog = useStudio((s) => s.dialog);
  if (dialog === "new") return <NewProject />;
  if (dialog === "export") return <Export />;
  if (dialog === "commands") return <CommandSearch onImport={onImport} />;
  if (dialog === "settings") return <Settings />;
  if (dialog === "about") return <About />;
  if (dialog === "setup") return <Setup />;
  if (dialog === "help") return <Help />;
  if (dialog === "updates") return <Updates />;
  if (dialog === "assist") return <Assist />;
  return null;
}
function NewProject() {
  const s = useStudio(),
    [workspace, setWorkspace] = useState(s.workspace),
    [title, setTitle] = useState("Untitled"),
    [width, setWidth] = useState(1280),
    [height, setHeight] = useState(720),
    [fps, setFps] = useState(24);
  const valid =
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= 64 &&
    height >= 64 &&
    width <= 4096 &&
    height <= 4096 &&
    title.trim();
  return (
    <Modal title="New project" close={close}>
      <div className="dialog-intro">
        <span className="eyebrow">NEW DOCUMENT</span>
        <h1>Create a project</h1>
        <p>
          One .lam document, three workspaces. Draw, Motion and Edit share
          the same scenes, layers and exports.
        </p>
      </div>
      <div className="document-types">
        {[
          { w: "Draw" as const, icon: Pencil, text: "Manual drawing cels." },
          {
            w: "Motion" as const,
            icon: Bone,
            text: "Rigging and keyed movement.",
          },
          {
            w: "Edit" as const,
            icon: Clapperboard,
            text: "Footage, audio and layers.",
          },
        ].map((item) => (
          <button
            key={item.w}
            aria-pressed={workspace === item.w}
            onClick={() => setWorkspace(item.w)}
          >
            <item.icon size={20} />
            <strong>{item.w}</strong>
            <small>{item.text}</small>
          </button>
        ))}
      </div>
      <label className="text-field">
        <span>Project name</span>
        <input
          aria-label="Project name"
          autoFocus
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="field-grid">
        <NumberField
          label="New canvas width"
          min={64}
          max={4096}
          value={width}
          onChange={setWidth}
        />
        <NumberField
          label="New canvas height"
          min={64}
          max={4096}
          value={height}
          onChange={setHeight}
        />
      </div>
      <div className="size-presets">
        {[
          { name: "HD", w: 1920, h: 1080 },
          { name: "Square", w: 1080, h: 1080 },
          { name: "Portrait", w: 1080, h: 1920 },
          { name: "Studio", w: 1280, h: 720 },
        ].map((size) => (
          <button
            key={size.name}
            onClick={() => {
              setWidth(size.w);
              setHeight(size.h);
            }}
          >
            {size.name}
          </button>
        ))}
        <select
          aria-label="New document frame rate"
          value={fps}
          onChange={(e) => setFps(Number(e.target.value))}
        >
          {[12, 24, 25, 30, 60].map((f) => (
            <option value={f} key={f}>
              {f} fps
            </option>
          ))}
        </select>
      </div>
      <p className="dialog-note">
        RGB · embedded assets · local autosave · Pegbar Studio 2.0 .lam
      </p>
      <div className="dialog-footer">
        <button className="button secondary" onClick={close}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!valid || s.busy}
          onClick={() => {
            s.create(workspace, title.trim(), { width, height, fps });
            s.pref("onion", workspace === "Draw");
          }}
        >
          Create project
          <ArrowRight size={13} />
        </button>
      </div>
    </Modal>
  );
}
function Export() {
  const s = useStudio(),
    doc = s.document!,
    scene = doc.scenes.find((sc) => sc.id === s.sceneId)!,
    [format, setFormat] = useState<
      "mp4" | "webm" | "sprite" | "png" | "svg" | "sequence" | "lam"
    >("mp4"),
    [all, setAll] = useState(doc.scenes.length > 1),
    [work, setWork] = useState(false),
    [resolution, setResolution] = useState(1280),
    [audio, setAudio] = useState(true),
    [transparent, setTransparent] = useState(false),
    [name, setName] = useState(doc.title),
    [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [columns, setColumns] = useState(6),
    [cap, setCap] = useState<Awaited<
      ReturnType<typeof movieCapabilities>
    > | null>(null),
    abort = useRef<AbortController | null>(null),
    preview = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    if (format === "mp4" || format === "webm") {
      setCap(null);
      movieCapabilities(doc, resolution, format)
        .then((value) => {
          if (active) setCap(value);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }
    return () => {
      active = false;
    };
  }, [doc, resolution, format]);
  useEffect(() => {
    let active = true;
    void import("../core/render")
      .then(async (r) => {
        await r.preload(doc, scene, s.frame);
        if (active && preview.current)
          r.render(preview.current, doc, scene, s.frame, { transparent });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [doc, scene, s.frame, transparent]);
  useEffect(() => () => abort.current?.abort(), []);
  const requestClose = () => {
      if (busy) abort.current?.abort();
      else close();
    },
    options = { all, work, longSide: resolution, audio, transparent },
    frames = plan(doc, scene.id, options),
    run = async () => {
      setBusy(true);
      s.set({ busy: true, playing: false });
      setError("");
      setProgress(0);
      abort.current = new AbortController();
      try {
        let output: Blob, ext: string;
        if (format === "lam") {
          output = new Blob([encode(doc) as Uint8Array<ArrayBuffer>]);
          ext = "lam";
        } else if (format === "png") {
          output = await exportImage(
            doc,
            scene,
            s.frame,
            resolution,
            transparent,
          );
          ext = "png";
        } else if (format === "svg") {
          output = await exportSvg(
            doc,
            scene,
            s.frame,
            resolution,
            transparent,
          );
          ext = "svg";
        } else if (format === "sequence") {
          output = await exportSequence(
            doc,
            scene.id,
            options,
            setProgress,
            abort.current.signal,
          );
          ext = "zip";
        } else if (format === "sprite") {
          const sheet = await exportSpriteSheet(
            doc,
            scene.id,
            options,
            columns,
            setProgress,
            abort.current.signal,
          );
          abort.current.signal.throwIfAborted();
          const saved = await saveMedia(sheet.image, name, "png");
          if (saved)
            await saveMedia(
              sheet.atlas,
              `${name}-atlas`,
              "json",
            ).catch(() => false);
          if (saved) {
            s.notify(
              `Sprite sheet exported: ${sheet.frames} frames, ${sheet.columns}×${sheet.rows} cells of ${sheet.frameWidth}×${sheet.frameHeight} px, with a JSON atlas.`,
            );
            close();
          }
          return;
        } else {
          output = await exportMovie(
            doc,
            scene.id,
            options,
            format,
            setProgress,
            abort.current.signal,
          );
          ext = format;
        }
        abort.current.signal.throwIfAborted();
        if (await saveMedia(output, name, ext)) {
          s.notify(
            `Exported ${ext.toUpperCase()}. Your editable document is unchanged.`,
          );
          close();
        }
      } catch (e) {
        if (abort.current.signal.aborted) {
          s.notify("Export cancelled. No document changes.");
          close();
        } else setError(e instanceof Error ? e.message : "Export failed.");
      } finally {
        setBusy(false);
        s.set({ busy: false });
      }
    };
  return (
    <Modal title="Export animation" close={requestClose} wide>
      <div className="dialog-intro">
        <span className="eyebrow">LOCAL RENDER</span>
        <h1>Export</h1>
        <p>
          MP4 or WebM up to 1800 frames or 120 s · PNG · PNG-sequence ZIP ·
          sprite sheet · flattened raster SVG · portable .lam copy. Encoded on
          this device.
        </p>
      </div>
      <div className="export-layout">
        <div className="export-preview">
          <canvas
            ref={preview}
            width={480}
            height={Math.round((480 * doc.canvas.height) / doc.canvas.width)}
          />
          <span>
            {format === "png" || format === "svg"
              ? `Frame ${s.frame + 1}`
              : `${frames.length} frames · ${(frames.length / doc.canvas.fps).toFixed(2)} seconds`}
          </span>
          <p>
            {format === "svg"
              ? "SVG is a flattened raster snapshot. Editable vector data remains in .lam."
              : format === "sequence"
                ? "Individual transparent PNG files, with frame metadata, in one ZIP."
                : format === "sprite"
                  ? "One PNG grid of every frame plus a JSON atlas of the cells."
                  : format === "webm"
                    ? "VP9 with Opus audio, the format web players and browsers take directly."
                    : "Guides, selection handles and reference-board images are excluded."}
          </p>
        </div>
        <div className="export-options">
          <div className="export-formats">
            {[
              { id: "mp4", name: "MP4", icon: Film },
              { id: "webm", name: "WebM", icon: MonitorPlay },
              { id: "sprite", name: "Sprite", icon: Grid3X3 },
              { id: "png", name: "PNG", icon: Image },
              { id: "svg", name: "SVG", icon: Code2 },
              { id: "sequence", name: "Sequence", icon: FileArchive },
              { id: "lam", name: ".LAM", icon: FileArchive },
            ].map((f) => (
              <button
                key={f.id}
                aria-pressed={format === f.id}
                disabled={busy}
                onClick={() => {
                  setFormat(f.id as typeof format);
                  setError("");
                }}
              >
                <f.icon size={18} />
                <strong>{f.name}</strong>
              </button>
            ))}
          </div>
          <label className="text-field">
            <span>File name</span>
            <input
              aria-label="Export file name"
              value={name}
              maxLength={100}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {format !== "lam" && (
            <label className="text-field">
              <span>Resolution / longest side</span>
              <select
                aria-label="Export resolution"
                value={resolution}
                disabled={busy}
                onChange={(e) => setResolution(Number(e.target.value))}
              >
                <option value={960}>960 px</option>
                <option value={1280}>1280 px</option>
                <option value={1920}>1920 px</option>
                <option value={4096}>4096 px</option>
              </select>
            </label>
          )}
          {(format === "mp4" ||
            format === "webm" ||
            format === "sprite" ||
            format === "sequence") && (
            <>
              <label className="text-field">
                <span>Scenes</span>
                <select
                  aria-label="Export scene scope"
                  value={all ? "all" : "scene"}
                  disabled={busy}
                  onChange={(e) => setAll(e.target.value === "all")}
                >
                  <option value="scene">Current scene</option>
                  <option value="all">All scenes, in document order</option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={work}
                  disabled={busy}
                  onChange={(e) => setWork(e.target.checked)}
                />
                Only the work area
              </label>
            </>
          )}
          {format === "sprite" && (
            <NumberField
              label="Columns"
              value={columns}
              min={1}
              max={20}
              onChange={setColumns}
            />
          )}
          {(format === "mp4" || format === "webm") && (
            <>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={audio}
                  disabled={busy}
                  onChange={(e) => setAudio(e.target.checked)}
                />
                Include audio
              </label>
              <p className="codec-note">
                {cap
                  ? cap.video
                    ? `${cap.video === "avc" ? "H.264" : "VP9"} ready · ${cap.audio ? (cap.audio === "aac" ? "AAC" : cap.audio === "opus" ? "Opus" : cap.audio) : "no"} audio encoder`
                    : `${format === "mp4" ? "H.264" : "VP9"} unavailable. Try the other container, the desktop build or a PNG sequence.`
                  : "Checking encoders on this device…"}
              </p>
            </>
          )}
          {format === "png" ||
          format === "svg" ||
          format === "sprite" ||
          format === "sequence" ? (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={transparent}
                disabled={busy}
                onChange={(e) => setTransparent(e.target.checked)}
              />
              Transparent background
            </label>
          ) : null}
          {format === "lam" && (
            <p className="dialog-note">
              A portable copy of every scene, layer, key, drawing, sound and
              reference. Does not change your linked Save destination.
            </p>
          )}
        </div>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {busy && (
        <div className="export-progress">
          <span>Rendering {Math.round(progress * 100)}%</span>
          <progress value={progress} max={1} />
        </div>
      )}
      <div className="dialog-footer">
        <span className="local-note">
          <Shield size={12} />
          Rendered on this device
        </span>
        <button className="button secondary" onClick={requestClose}>
          {busy ? "Cancel render" : "Cancel"}
        </button>
        <button
          className="button primary"
          disabled={
            busy ||
            !name.trim() ||
            ((format === "mp4" || format === "webm") && !cap?.video)
          }
          onClick={() => void run()}
        >
          {busy
            ? "Rendering…"
            : `Export ${
                format === "lam"
                  ? "project"
                  : format === "sequence"
                    ? "sequence"
                    : format === "sprite"
                      ? "sprite sheet"
                      : format.toUpperCase()
              }`}
          <ArrowDownToLine size={13} />
        </button>
      </div>
    </Modal>
  );
}
function Settings() {
  const s = useStudio(),
    d = s.document!,
    scene = d.scenes.find((sc) => sc.id === s.sceneId)!,
    [title, setTitle] = useState(d.title),
    [length, setLength] = useState(scene.length),
    [fps, setFps] = useState(d.canvas.fps);
  return (
    <Modal title="Document settings" close={close}>
      <div className="dialog-intro">
        <span className="eyebrow">DOCUMENT AND WORKSPACE</span>
        <h1>Document settings</h1>
      </div>
      <label className="text-field">
        <span>Document title</span>
        <input
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="field-grid">
        <NumberField
          label="Scene duration in frames"
          min={2}
          max={1800}
          value={length}
          onChange={setLength}
        />
        <NumberField
          label="Frame rate"
          min={1}
          max={60}
          value={fps}
          onChange={setFps}
        />
      </div>
      <p className="dialog-note">
        Shortening removes out-of-range keys, cels and clips. Undo restores the
        complete edit. Limits bound memory and rendering, not paid features.
      </p>
      <Section title="Interface">
        <label className="switch-line">
          <span>Light interface</span>
          <input
            type="checkbox"
            checked={s.preferences.theme === "light"}
            onChange={(e) =>
              s.pref("theme", e.target.checked ? "light" : "dark")
            }
          />
        </label>
        <label className="switch-line">
          <span>Snap to 20 px grid</span>
          <input
            type="checkbox"
            checked={s.preferences.snap}
            onChange={(e) => s.pref("snap", e.target.checked)}
          />
        </label>
      </Section>
      <div className="dialog-footer">
        <button className="button secondary" onClick={close}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!title.trim()}
          onClick={() => {
            s.commit("Document settings", (doc, sc) => {
              doc.title = title.trim();
              doc.canvas.fps = Math.round(fps);
              sc.length = Math.round(length);
              sc.work = [
                Math.min(sc.work[0], sc.length - 1),
                Math.min(sc.work[1], sc.length - 1),
              ];
              for (const l of sc.layers) {
                l.end = Math.min(l.end, sc.length);
                l.start = Math.min(l.start, l.end - 1);
                l.keys = l.keys.filter((k) => k.frame < sc.length);
                if (l.cels) l.cels = l.cels.filter((c) => c.frame < sc.length);
              }
              sc.sounds = sc.sounds
                .filter((a) => a.start < sc.length)
                .map((a) => ({ ...a, end: Math.min(a.end, sc.length) }));
            });
            close();
          }}
        >
          Apply settings
        </button>
      </div>
    </Modal>
  );
}
function CommandSearch({ onImport }: { onImport: () => void }) {
  const [query, setQuery] = useState(""),
    [index, setIndex] = useState(0),
    list = commands(onImport).filter((c) =>
      `${c.label} ${c.group}`.toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <Modal title="Command search" close={close}>
      <div className="command-input">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Search commands"
          value={query}
          placeholder="Type a command name"
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setIndex(
                (i) =>
                  (i + (e.key === "ArrowDown" ? 1 : list.length - 1)) %
                  Math.max(1, list.length),
              );
            }
            if (e.key === "Enter") {
              e.preventDefault();
              const chosen = list[index];
              if (chosen && chosen.enabled?.() !== false) {
                close();
                execute(chosen);
              }
            }
          }}
        />
      </div>
      <div
        className="command-list"
        role="listbox"
        aria-label="Matching commands"
      >
        {list.map((c, i) => (
          <button
            role="option"
            aria-selected={i === index}
            key={c.id}
            disabled={c.enabled?.() === false}
            onMouseEnter={() => setIndex(i)}
            onClick={() => {
              close();
              execute(c);
            }}
          >
            <small>{c.group}</small>
            <span>{c.label}</span>
            <kbd>{c.shortcut}</kbd>
          </button>
        ))}
      </div>
    </Modal>
  );
}
function Setup() {
  const s = useStudio(),
    [step, setStep] = useState(0),
    [workspace, setWorkspace] = useState<Workspace>("Draw");
  return (
    <Modal title="Workspace setup" close={close}>
      <div className="setup-brand">
        <img src="./mark.svg" alt="" />
        <span>
          PEGBAR STUDIO <small>{VERSION}</small>
        </span>
      </div>
      <div className="dialog-intro">
        <span className="eyebrow">SETUP / {step + 1} OF 3</span>
        <h1>
          {step === 0
            ? "Choose a workspace"
            : step === 1
              ? "Interface"
              : "Where your work lives"}
        </h1>
        <p>
          {step === 0
            ? "Workspaces rearrange the docks around one document. No tool is locked to a workspace."
            : step === 1
              ? "Graphite or porcelain. Both themes keep every tool and value legible."
              : "Documents live in the local library. Save .lam copies wherever you want; no account is required."}
        </p>
      </div>
      {step === 0 ? (
        <div className="document-types">
          {(["Draw", "Motion", "Edit"] as Workspace[]).map((w) => (
            <button
              key={w}
              aria-pressed={workspace === w}
              onClick={() => setWorkspace(w)}
            >
              <strong>{w}</strong>
              <small>
                {w === "Draw"
                  ? "Painting & drawing cels"
                  : w === "Motion"
                    ? "Rigging & motion keys"
                    : "Video & sound"}
              </small>
            </button>
          ))}
        </div>
      ) : step === 1 ? (
        <div className="theme-options">
          <button
            aria-pressed={s.preferences.theme === "dark"}
            onClick={() => s.pref("theme", "dark")}
          >
            <div className="theme-preview dark" />
            Graphite
          </button>
          <button
            aria-pressed={s.preferences.theme === "light"}
            onClick={() => s.pref("theme", "light")}
          >
            <div className="theme-preview light" />
            Porcelain
          </button>
        </div>
      ) : (
        <div className="setup-summary">
          <Shield size={25} />
          <p>
            All tools are free. Your creative output is yours.
            <br />
            Application redistribution requires permission.
            <br />
            Pegbar Studio 2.0 replaces unsupported legacy releases.
          </p>
          <button className="subtle" onClick={() => s.set({ dialog: "about" })}>
            Read the application licence
          </button>
        </div>
      )}
      <div className="dialog-footer">
        <button
          className="button secondary"
          onClick={() => {
            if (step) setStep(step - 1);
            else {
              s.pref("newsSeen", VERSION);
              close();
            }
          }}
        >
          {step ? "Back" : "Skip setup"}
        </button>
        <button
          className="button primary"
          onClick={() => {
            if (step < 2) setStep(step + 1);
            else {
              s.set({ workspace, dialog: "new" });
              s.pref("newsSeen", VERSION);
            }
          }}
        >
          {step < 2 ? "Continue" : "Create first project"}
          <ArrowRight size={13} />
        </button>
      </div>
    </Modal>
  );
}
function About() {
  const [tab, setTab] = useState("product");
  return (
    <Modal title="About Pegbar Studio" close={close} wide>
      <div className="about-brand">
        <img src="./mark.svg" alt="" />
        <div>
          <h1>Pegbar Studio</h1>
          <p>
            Pegbar Studio 2.0 · PEGB1LAM documents <span>Version {VERSION}</span>
          </p>
        </div>
      </div>
      <div className="about-tabs">
        {["product", "licence", "components"].map((name) => (
          <button
            key={name}
            aria-pressed={tab === name}
            onClick={() => setTab(name)}
          >
            {name === "product"
              ? "About"
              : name === "licence"
                ? "Application licence"
                : "Third-party notices"}
          </button>
        ))}
      </div>
      {tab === "product" ? (
        <div className="about-copy">
          <p>
            A clean, independent 1.0 architecture: drawing, motion and editing
            on one unified document. New branding, a new engine and a new
            project format. Entirely free, with no subscription or paid feature
            tier.
          </p>
          <p>
            <strong>Pegbar Studio 2.0 opens every 1.0 project.</strong> The
            earlier identity is gone, the file signature is new, and a project
            saved by 1.0 opens, upgrades in memory and re-saves here unchanged.
            Pre-1.0 Luno Animate formats do not open; keep their original files
            and exported media. Old public downloads may remain as unsupported
            archives, and they are not migrated.
          </p>
          <p className="dialog-note">
            The application licence covers the software itself and is under
            review. Confirm licensing entity and written permission before
            public or company distribution.
          </p>
        </div>
      ) : (
        <pre className="legal-text" tabIndex={0}>
          {tab === "licence" ? licence : notices}
        </pre>
      )}
      {tab === "components" && (
        <a
          className="button secondary"
          href="./legal/mediabunny-source.zip"
          download
        >
          Mediabunny source & licence
          <FileArchive size={13} />
        </a>
      )}
      <div className="dialog-footer">
        <span className="local-note">No telemetry. No account.</span>
        <button className="button primary" onClick={close}>
          Close
        </button>
      </div>
    </Modal>
  );
}
function Assist() {
  const doc = useStudio((s) => s.document)!,
    sceneId = useStudio((s) => s.sceneId),
    selected = useStudio((s) => s.selected),
    frame = useStudio((s) => s.frame),
    addInBetweens = useStudio((s) => s.breakdowns),
    applyFix = useStudio((s) => s.assistFix),
    [steps, setSteps] = useState(3),
    [spacing, setSpacing] = useState<Spacing>("even");
  const scene = doc.scenes.find((s) => s.id === sceneId)!,
    range: [number, number] =
      scene.work[1] > scene.work[0]
        ? [scene.work[0], scene.work[1]]
        : [0, scene.length - 1],
    found = auditScene(scene, range),
    scoped = selected.length
      ? found.filter((f) => selected.includes(f.layer.id))
      : found,
    animated = scoped.filter((f) => f.notes.length),
    keys = scoped.reduce((total, f) => total + f.keys, 0);
  return (
    <Modal title="Motion audit" close={close} wide>
      <div className="dialog-intro">
        <span className="eyebrow">ANIMATION / TIMING</span>
        <h1>Motion audit</h1>
        <p>
          Reads the keys already in this scene and reports what the timing does,
          the way an exposure sheet does. It runs on this computer: no account,
          no connection, and nothing leaves the project.
        </p>
      </div>
      <Section title="Add in-betweens">
        <p className="assist-scope">
          Work area {range[0]}–{range[1]} ·{" "}
          {selected.length
            ? `${selected.length} selected layer${selected.length === 1 ? "" : "s"}`
            : "select a layer first"}
        </p>
        <div className="spacing-row" role="group" aria-label="Spacing">
          {spacings.map((option) => (
            <button
              key={option.id}
              aria-pressed={spacing === option.id}
              onClick={() => setSpacing(option.id)}
              title={option.hint}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="assist-controls">
          <NumberField
            label="In-betweens per step"
            value={steps}
            min={1}
            max={8}
            onChange={setSteps}
          />
          <button
            className="assist-run"
            disabled={!selected.length}
            onClick={() => addInBetweens(steps, spacing)}
          >
            Add in-betweens
          </button>
        </div>
        <p className="assist-note">
          Each new key holds the pose the curve already passes through at that
          frame, so drawings you have already made stay exactly where they are.
        </p>
      </Section>
      <Section title={`Findings · ${scoped.length ? `${keys} keys` : "empty scene"}`}>
        {!scoped.length && (
          <p className="assist-empty">
            Nothing in this scene animates yet. Key two poses and reopen this
            panel.
          </p>
        )}
        {scoped.length > 0 && !animated.length && (
          <p className="assist-empty">
            Nothing to report in the work area: the moves are short, varied and
            already have their in-betweens.
          </p>
        )}
        <ul className="audit-list">
          {scoped.map((entry) =>
            entry.notes.length ? (
              <li key={entry.layer.id}>
                <div className="audit-head">
                  <strong>{entry.layer.name}</strong>
                  <small>
                    {entry.keys} keys · {entry.channels.length} animated{" "}
                    {entry.channels.length === 1 ? "property" : "properties"}
                    {selected.includes(entry.layer.id) ? " · selected" : ""}
                  </small>
                </div>
                {entry.notes.map((note) => (
                  <div
                    className={`audit-note ${note.level}`}
                    key={note.id}
                  >
                    <div>
                      <p>{note.text}</p>
                    </div>
                    {note.fix && (
                      <button onClick={() => applyFix(note.fix!, entry.layer.id)}>
                        {note.fixLabel}
                      </button>
                    )}
                  </div>
                ))}
              </li>
            ) : null,
          )}
        </ul>
      </Section>
      <div className="property-actions">
        <button onClick={() => useStudio.setState({ dialog: null })}>
          Close
        </button>
        <small className="assist-foot">
          Playhead {frame} · {scene.length} frames · {doc.canvas.fps} fps
        </small>
      </div>
    </Modal>
  );
}
function Help() {
  return (
    <Modal title="Tools and shortcuts" close={close} wide>
      <div className="dialog-intro">
        <span className="eyebrow">STUDIO REFERENCE</span>
        <h1>Tools, keys and limits</h1>
        <p>Shortcuts, tool behaviour and the working limits of Pegbar Studio 2.0.</p>
      </div>
      <div className="help-grid">
        {[
          {
            title: "Draw",
            text: "B brush · E eraser · F fill · I eyedropper. Eight procedural brush families retain pressure and settings in every mark. F6 duplicates the next cel; F7 makes it blank. Hold exposures is optional.",
          },
          {
            title: "Motion",
            text: "V selects. Drag to move; use corner handles to scale and the upper handle to rotate. K inserts keys. Auto-key records changed properties after frame one. Expand timeline rows to inspect individual channels.",
          },
          {
            title: "Timing",
            text: "Ctrl B adds in-betweens between the poses in the work area; the audit lists long gaps, single-frame pops, dead holds and linear keys with a fix beside each finding. Motion paths and key dots are drawn over a selected keyed layer. M mirrors every stroke across the canvas centreline.",
          },
          {
            title: "Rig",
            text: "Insert an armature, then G for rig pose. Drag a joint endpoint with constrained cyclic-coordinate IK. Adjust bone lengths and angles in Inspector. Attach your own shapes and images to joints.",
          },
          {
            title: "Edit",
            text: "Import video up to 30 seconds / 100 MB. It becomes a bounded 960px/20fps JPEG proxy with decoded audio where supported. Drag clip edges to trim, move the bar, or press S to split a selected video clip.",
          },
          {
            title: "Navigate",
            text: "H pans. Ctrl-wheel zooms. Tab focuses the canvas. Shift-drag the timeline ruler sets the work area. Space plays that range. U toggles onion skins. References are embedded but never exported.",
          },
          {
            title: "Save & deliver",
            text: "Ctrl S updates a linked .lam file; Ctrl Shift S changes the destination. Without file-system access, browser Save downloads a copy. Ctrl E exports; Ctrl Shift P searches commands. Local autosave is separate from external file Save.",
          },
        ].map((item) => (
          <section key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </section>
        ))}
      </div>
      <div className="dialog-footer">
        <Keyboard size={15} />
        <span className="local-note">Ctrl is ⌘ on macOS where applicable.</span>
        <button className="button primary" onClick={close}>
          Back to studio
        </button>
      </div>
    </Modal>
  );
}
function Updates() {
  const [state, setState] = useState({
      phase: "disabled",
      message:
        "Browser builds do not install updates. Download desktop builds from the official release. Back up projects as portable .lam files.",
      version: null as string | null,
      percent: 0,
    }),
    [backups, setBackups] = useState<{ id: string; date: number }[]>([]),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const api = window.studio;
    if (!api) return;
    void api.updates.state().then(setState);
    void api.library.backups().then(setBackups);
    return api.updates.listen(setState);
  }, []);
  const operation = async (action: () => Promise<void>) => {
    setWorking(true);
    useStudio.setState({ busy: true });
    setError("");
    try {
      await flush();
      await action();
      await refresh();
      if (window.studio) setBackups(await window.studio.library.backups());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Maintenance failed.");
    } finally {
      setWorking(false);
      useStudio.setState({ busy: false });
    }
  };
  return (
    <Modal
      title="Updates and backups"
      close={() => {
        if (!working) close();
      }}
    >
      <div className="dialog-intro">
        <span className="eyebrow">APPLICATION / MAINTENANCE</span>
        <h1>Updates and verified backups</h1>
        <p>
          Official Pegbar Studio releases. Your library stays on this computer.
        </p>
      </div>
      <div className="update-state">
        <RefreshCw size={22} />
        <div>
          <strong>{state.phase}</strong>
          <p>{state.message}</p>
          <small>
            Installed {VERSION}
            {state.version ? ` / available ${state.version}` : ""}
          </small>
        </div>
      </div>
      {state.phase === "downloading" && (
        <progress max={100} value={state.percent} />
      )}
      <div className="property-actions">
        <button
          disabled={!window.studio || working}
          onClick={() => void window.studio?.updates.check()}
        >
          Check updates
        </button>
        {state.phase === "available" && (
          <button onClick={() => void window.studio?.updates.download()}>
            Download
          </button>
        )}
        {state.phase === "ready" && (
          <button onClick={() => void window.studio?.updates.install()}>
            Save, back up & restart
          </button>
        )}
      </div>
      <Section title="Verified library backups">
        <button
          className="button secondary"
          disabled={!window.studio || working}
          onClick={() => void operation(() => window.studio!.library.backup())}
        >
          <Shield size={13} />
          Back up this library
        </button>
        {!window.studio && (
          <p className="dialog-note">
            Browser storage is not a backup. Save independent .lam copies of
            important projects.
          </p>
        )}
        {backups.map((b) => (
          <div className="backup-row" key={b.id}>
            <span>{new Date(b.date).toLocaleString()}</span>
            <button
              disabled={working}
              onClick={() => {
                if (
                  confirm(
                    "Restore this complete library? A backup of the current library is made first.",
                  )
                )
                  void operation(async () => {
                    await window.studio!.library.restore(b.id);
                    useStudio.setState({
                      document: null,
                      view: "home",
                      selected: [],
                      playing: false,
                    });
                  });
              }}
            >
              Restore
            </button>
          </div>
        ))}
      </Section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-footer">
        <button className="button primary" onClick={close} disabled={working}>
          Close
        </button>
      </div>
    </Modal>
  );
}
