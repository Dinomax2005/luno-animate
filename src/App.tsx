import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  Check,
  Circle,
  LoaderCircle,
  PanelLeft,
  PanelRight,
  X,
} from "lucide-react";
import { useStudio } from "./state/studio";
import { type Asset, type Tool } from "./core/model";
import { decode } from "./core/codec";
import { clamp, pose } from "./core/motion";
import { importAudio, importImage, importVideo } from "./core/media";
import { initialize, adoptDocument, flush } from "./services/library";
import {
  bind,
  dirty,
  importProject,
  openFile,
  saveFile,
  useFile,
} from "./services/files";
import { commands, execute } from "./services/commands";
import { PlaybackAudio } from "./services/audio";
import { Home } from "./components/Home";
import { Header } from "./components/Header";
import { Toolbox } from "./components/Toolbox";
import { Navigator } from "./components/Navigator";
import { Inspector } from "./components/Inspector";
import { Timeline } from "./components/Timeline";
import { Stage } from "./components/Stage";
import { Dialogs } from "./components/Dialogs";
import { UpdateNotice } from "./components/UpdateNotice";
import { Modal } from "./components/Common";
export default function App() {
  const s = useStudio(),
    [bootError, setBootError] = useState(""),
    [progress, setProgress] = useState<number | null>(null),
    input = useRef<HTMLInputElement>(null),
    referenceInput = useRef<HTMLInputElement>(null),
    audioInput = useRef<HTMLInputElement>(null),
    abort = useRef<AbortController | null>(null),
    ready = useRef(false),
    activity = useRef(Date.now()),
    [boot, setBoot] = useState(0);
  useEffect(() => {
    document.documentElement.dataset.theme = s.preferences.theme;
  }, [s.preferences.theme]);
  useEffect(() => {
    let active = true;
    void initialize()
      .then(async () => {
        if (!active) return;
        await document.fonts.ready;
        if (window.studio && !ready.current) {
          await window.studio.ready();
          ready.current = true;
          if (!useStudio.getState().preferences.newsSeen)
            useStudio.setState({ dialog: "setup" });
        }
      })
      .catch((e) => {
        if (active) setBootError(e.message);
      });
    return () => {
      active = false;
    };
  }, [boot]);
  useEffect(() => {
    if (!window.studio) return;
    const a = window.studio.onOpen(async (file) => {
      const state = useStudio.getState();
      if (state.busy || state.interacting) {
        state.notify("Finish the current operation before opening this file.");
        return;
      }
      await flush();
      const doc = await adoptDocument(decode(file.bytes));
      state.open(doc);
      bind({
        document: doc.id,
        name: file.name,
        hash: file.hash,
        token: file.token,
        snapshot: useStudio.getState().document!,
      });
    });
    const b = window.studio.onPrepare(async () => {
      const state = useStudio.getState();
      if (state.busy || state.interacting)
        throw new Error("An operation is still running.");
      await flush();
    });
    return () => {
      a();
      b();
    };
  }, []);
  useEffect(() => {
    if (!s.playing || !s.document || s.view !== "studio") return;
    const scene = s.document.scenes.find((sc) => sc.id === s.sceneId)!;
    let initial =
        s.frame < scene.work[0] || s.frame > scene.work[1]
          ? scene.work[0]
          : s.frame,
      start = performance.now(),
      request = 0;
    const tick = (time: number) => {
      const state = useStudio.getState(),
        sc = state.document?.scenes.find((sc) => sc.id === state.sceneId);
      if (!sc || !state.playing) return;
      const next =
        initial +
        Math.floor(((time - start) / 1000) * state.document!.canvas.fps);
      if (next > sc.work[1]) {
        if (state.preferences.loop) {
          initial = sc.work[0];
          start = time;
          state.set({ frame: initial });
        } else {
          state.set({ frame: sc.work[1], playing: false });
          return;
        }
      } else state.set({ frame: next });
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [s.playing, s.view, s.sceneId]);
  useEffect(() => {
    const timer = setInterval(() => {
      const state = useStudio.getState();
      window.studio?.updates.activity(
        !state.busy &&
          !state.interacting &&
          !state.playing &&
          state.saveState === "saved" &&
          !dirty() &&
          !state.dialog,
        activity.current,
      );
    }, 2000);
    const active = () => {
      activity.current = Date.now();
    };
    for (const name of ["pointerdown", "keydown", "wheel", "input"])
      document.addEventListener(name, active, true);
    return () => {
      clearInterval(timer);
      for (const name of ["pointerdown", "keydown", "wheel", "input"])
        document.removeEventListener(name, active, true);
    };
  }, []);
  useEffect(
    () =>
      window.studio?.onCommand((id) => {
        const state = useStudio.getState();
        if (state.dialog) return;
        const command = commands(() => input.current?.click()).find(
          (c) => c.id === id,
        );
        if (command) execute(command);
      }),
    [],
  );
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const state = useStudio.getState();
      if (event.defaultPrevented || state.busy || state.dialog) return;
      const target = event.target as HTMLElement,
        key = event.key.toLowerCase(),
        mod = event.metaKey || event.ctrlKey,
        editing =
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
          target.isContentEditable;
      if (mod && key === "s") {
        event.preventDefault();
        void saveFile(event.shiftKey);
        return;
      }
      if (mod && key === "o") {
        event.preventDefault();
        void openFile();
        return;
      }
      if (mod && key === "e") {
        event.preventDefault();
        (document.activeElement as HTMLElement)?.blur();
        state.set({ dialog: "export" });
        return;
      }
      if (mod && event.shiftKey && key === "p") {
        event.preventDefault();
        state.set({ dialog: "commands" });
        return;
      }
      if (editing) return;
      if (state.interacting) {
        if (key === "escape") state.cancelGesture();
        return;
      }
      if (mod) {
        const mapping: Record<string, string> = {
          n: "new",
          z: event.shiftKey ? "redo" : "undo",
          y: "redo",
          d: "duplicate",
          g: "group",
          c: "copy-keys",
          v: "paste-keys",
        };
        const id = mapping[key];
        if (id) {
          event.preventDefault();
          const command = commands(() => input.current?.click()).find(
            (c) => c.id === id,
          );
          if (command) execute(command);
        }
        return;
      }
      if (state.view !== "studio" || !state.document) return;
      const sc = state.document.scenes.find((sc) => sc.id === state.sceneId)!;
      const toolKeys: Record<string, Tool> = {
        v: "select",
        h: "hand",
        b: "brush",
        e: "erase",
        f: "fill",
        i: "picker",
        r: "rect",
        o: "ellipse",
        t: "text",
        g: "rig",
      };
      if (toolKeys[key]) state.set({ tool: toolKeys[key], playing: false });
      if (key === " ") {
        event.preventDefault();
        state.set({ playing: !state.playing });
      }
      if (key === "tab") {
        event.preventDefault();
        state.set({ focused: !state.focused });
      }
      if (key === "u") state.pref("onion", !state.preferences.onion);
      if (key === "k") state.addKey();
      if (key === "s") state.splitClip();
      if (key === "f6" || key === "f7") {
        event.preventDefault();
        state.newCel(key === "f6");
      }
      if (key === "delete" || key === "backspace") {
        event.preventDefault();
        state.keySelection.length ? state.deleteKeys() : state.remove();
      }
      if (key === "x") {
        const fg = state.preferences.foreground;
        state.pref("foreground", state.preferences.background);
        state.pref("background", fg);
      }
      if (key === "d") {
        state.pref("foreground", "#343345");
        state.pref("background", "#f6f5f1");
      }
      if (key === "[" || key === "]") {
        event.preventDefault();
        if (["brush", "erase"].includes(state.tool))
          state.pref("brush", {
            ...state.preferences.brush,
            size: clamp(
              state.preferences.brush.size + (key === "]" ? 2 : -2),
              1,
              256,
            ),
          });
        else
          state.workArea(
            key === "[" ? state.frame : sc.work[0],
            key === "]" ? state.frame : sc.work[1],
          );
      }
      if (key === "." || key === ",") {
        event.preventDefault();
        state.set({
          frame: clamp(state.frame + (key === "." ? 1 : -1), 0, sc.length - 1),
          playing: false,
        });
      }
      if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
        event.preventDefault();
        if (target.tagName === "CANVAS" && state.selected.length) {
          const step = event.shiftKey ? 10 : 1;
          for (const id of state.selected) {
            const l = sc.layers.find((l) => l.id === id);
            if (l) {
              const p = pose(l, state.frame);
              state.transform(id, {
                x:
                  p.x +
                  (key === "arrowleft"
                    ? -step
                    : key === "arrowright"
                      ? step
                      : 0),
                y:
                  p.y +
                  (key === "arrowup" ? -step : key === "arrowdown" ? step : 0),
              });
            }
          }
        } else
          state.set({
            frame: clamp(
              state.frame + (key === "arrowleft" ? -1 : 1),
              0,
              sc.length - 1,
            ),
            playing: false,
          });
      }
      if (key === "escape") state.select(null);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);
  useEffect(() => {
    const notice = s.notice;
    if (!notice) return;
    const timer = setTimeout(
      () => {
        if (useStudio.getState().notice?.id === notice.id)
          useStudio.setState({ notice: null });
      },
      notice.error ? 8500 : 4200,
    );
    return () => clearTimeout(timer);
  }, [s.notice]);
  const importFile = async (file: File, reference = false) => {
    const state = useStudio.getState();
    if (state.busy || state.interacting) return;
    if (file.name.toLowerCase().endsWith(".lam")) {
      await importProject(file);
      return;
    }
    if (!state.document || state.view !== "studio") {
      state.notify("Create or open a document before importing media.");
      return;
    }
    const expected = state.document.id;
    state.set({ busy: true, playing: false });
    abort.current = new AbortController();
    try {
      let asset: Asset,
        companion: Asset | undefined,
        note = "";
      if (
        file.type.startsWith("video/") ||
        /\.(mov|mp4|webm|m4v)$/i.test(file.name)
      ) {
        if (reference) throw new Error("Use a raster image reference.");
        setProgress(0);
        const result = await importVideo(
          file,
          setProgress,
          abort.current.signal,
        );
        asset = result.video;
        companion = result.audio;
        note = result.audioNote;
      } else if (
        file.type.startsWith("audio/") ||
        /\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(file.name)
      ) {
        if (reference) throw new Error("Use a raster image reference.");
        asset = await importAudio(file);
      } else asset = await importImage(file);
      abort.current.signal.throwIfAborted();
      if (state.media(asset, expected, reference, companion)) {
        state.notify(
          reference
            ? "Reference embedded, excluded from renders."
            : asset.kind === "video"
              ? `Bounded video proxy imported. ${note}`
              : "Media embedded in this document.",
        );
        if (reference) state.set({ navigator: "reference" });
      }
    } catch (e) {
      state.notify(
        abort.current.signal.aborted
          ? "Import cancelled. No media was added."
          : e instanceof Error
            ? e.message
            : "Import failed.",
        !abort.current.signal.aborted,
      );
    } finally {
      state.set({ busy: false });
      setProgress(null);
    }
  };
  const doc = s.document,
    scene = doc?.scenes.find((sc) => sc.id === s.sceneId),
    link = useFile((v) => (doc ? v.links[doc.id] : undefined));
  return (
    <>
      <Audio />
      <div
        className="application"
        inert={s.busy || !s.ready}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!s.dialog && e.dataTransfer.files[0])
            void importFile(e.dataTransfer.files[0]);
        }}
      >
        {s.view === "home" || !doc || !scene ? (
          <Home />
        ) : (
          <>
            <Header onImport={() => input.current?.click()} />
            <div
              className={`editor ${s.focused ? "focused" : ""}`}
              style={
                {
                  "--left-width": `${s.preferences.left}px`,
                  "--right-width": `${s.preferences.right}px`,
                } as React.CSSProperties
              }
            >
              <Toolbox />
              <div className="workbench">
                <div
                  className="upper-workbench"
                  style={
                    {
                      "--left-width": `${s.preferences.left}px`,
                      "--right-width": `${s.preferences.right}px`,
                    } as React.CSSProperties
                  }
                >
                  <Navigator
                    onImport={() => input.current?.click()}
                    onReference={() => referenceInput.current?.click()}
                  />
                  <Resizer side="left" />
                  <Stage />
                  <Resizer side="right" />
                  <Inspector />
                </div>
                <Resizer side="timeline" />
                <Timeline onSound={() => audioInput.current?.click()} />
              </div>
              {s.popout && (
                <>
                  <button
                    className="dock-backdrop"
                    aria-label="Dismiss dock overlay"
                    onClick={() => s.set({ popout: null })}
                  />
                  <button
                    className={`dock-close ${s.popout}`}
                    aria-label="Close dock overlay"
                    onClick={() => s.set({ popout: null })}
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
            <footer className="studio-status">
              <span>
                <Circle size={7} fill="currentColor" />
                {s.workspace.toUpperCase()} <i>/</i>
                {s.selected.length} selected
              </span>
              <span>
                {doc.canvas.width} × {doc.canvas.height}
                <i>·</i>
                {doc.canvas.fps} fps<i>·</i>Frame {s.frame + 1}
              </span>
              <span className="external-file-state">
                {link
                  ? `${link.snapshot !== doc ? "Modified · " : ""}${link.name}`
                  : "Library document · Save As for external .lam"}
              </span>
              <button
                aria-label="Toggle navigator"
                onClick={() =>
                  s.set({
                    popout: s.popout === "left" ? null : "left",
                    focused: false,
                  })
                }
              >
                <PanelLeft size={12} />
              </button>
              <button
                aria-label="Toggle inspector"
                onClick={() =>
                  s.set({
                    popout: s.popout === "right" ? null : "right",
                    focused: false,
                  })
                }
              >
                <PanelRight size={12} />
              </button>
              <button onClick={() => s.set({ dialog: "commands" })}>
                ⌘ / COMMANDS
              </button>
            </footer>
          </>
        )}
        {s.notice && (
          <div
            className={`toast ${s.notice.error ? "error" : ""}`}
            role={s.notice.error ? "alert" : "status"}
          >
            <Check size={14} />
            <span>{s.notice.text}</span>
            <button
              aria-label="Dismiss message"
              onClick={() => s.set({ notice: null })}
            >
              <X size={12} />
            </button>
          </div>
        )}
        <UpdateNotice />
        {s.dialog && <Dialogs onImport={() => input.current?.click()} />}
        <input
          ref={input}
          className="hidden-input"
          type="file"
          aria-label="Import media file"
          accept="image/png,image/jpeg,image/webp,audio/*,video/*,.lam"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void importFile(file);
          }}
        />
        <input
          ref={referenceInput}
          className="hidden-input"
          type="file"
          aria-label="Import reference file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void importFile(file, true);
          }}
        />
        <input
          ref={audioInput}
          className="hidden-input"
          type="file"
          aria-label="Import sound file"
          accept="audio/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void importFile(file);
          }}
        />
      </div>
      {!s.ready && (
        <div className="boot-card" role="status">
          <img src="./mark.svg" alt="" />
          <span>Opening Luno Studio</span>
          {bootError ? (
            <>
              <p>{bootError}</p>
              <button
                onClick={() => {
                  setBootError("");
                  setBoot((n) => n + 1);
                }}
              >
                Retry library
              </button>
            </>
          ) : (
            <LoaderCircle size={16} className="spin" />
          )}
        </div>
      )}
      {progress !== null && (
        <Modal title="Preparing media" close={() => abort.current?.abort()}>
          <div className="dialog-intro">
            <span className="eyebrow">BOUNDED PROXY / LOCAL DECODE</span>
            <h1>Preparing your footage.</h1>
            <p>
              Your original file is unchanged. This document embeds a
              960px/20fps proxy and decoded audio where available.
            </p>
          </div>
          <progress value={progress} max={1} />
          <div className="dialog-footer">
            <span>{Math.round(progress * 100)}%</span>
            <button
              className="button secondary"
              onClick={() => abort.current?.abort()}
            >
              Cancel import
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Resizer({ side }: { side: "left" | "right" | "timeline" }) {
  const value = useStudio((s) => s.preferences[side]),
    drag = useRef<{ position: number; value: number } | null>(null),
    vertical = side !== "timeline",
    min = side === "left" ? 190 : side === "right" ? 250 : 180,
    max = side === "left" ? 350 : side === "right" ? 420 : 460;
  const finish = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    useStudio.setState({ interacting: false });
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return (
    <div
      className={`resizer ${side === "timeline" ? "bottom" : side}`}
      role="separator"
      tabIndex={0}
      aria-label={`Resize ${side} dock`}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={(e) => {
        if (e.button) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { position: vertical ? e.clientX : e.clientY, value };
        useStudio.setState({ interacting: true });
      }}
      onPointerMove={(e) => {
        if (drag.current) {
          const delta =
            (vertical ? e.clientX : e.clientY) - drag.current.position;
          useStudio
            .getState()
            .pref(
              side,
              clamp(
                drag.current.value + delta * (side === "left" ? 1 : -1),
                min,
                max,
              ),
            );
        }
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={() => {
        if (drag.current) {
          drag.current = null;
          useStudio.setState({ interacting: false });
        }
      }}
      onKeyDown={(e) => {
        if (
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
        ) {
          e.preventDefault();
          e.stopPropagation();
          useStudio
            .getState()
            .pref(
              side,
              clamp(
                value +
                  (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) *
                    (side === "left" ? 1 : -1) *
                    (e.shiftKey ? 20 : 5),
                min,
                max,
              ),
            );
        }
      }}
    />
  );
}
function Audio() {
  const s = useStudio(),
    engine = useRef<PlaybackAudio | null>(null);
  useEffect(() => {
    engine.current ??= new PlaybackAudio();
    const scene = s.document?.scenes.find((sc) => sc.id === s.sceneId);
    if (s.document && scene)
      engine.current.update(
        s.document,
        scene,
        s.frame,
        s.playing && s.view === "studio",
        (message) => s.notify(message),
      );
    else engine.current.stop();
  }, [s.document, s.sceneId, s.frame, s.playing, s.view]);
  useEffect(() => () => engine.current?.dispose(), []);
  return null;
}
