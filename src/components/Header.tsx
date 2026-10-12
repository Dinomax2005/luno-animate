import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  FolderOpen,
  Home,
  Redo2,
  Save,
  Search,
  Undo2,
} from "lucide-react";
import { useStudio } from "../state/studio";
import { VERSION, type Workspace } from "../core/model";
import { commands, execute, type Command } from "../services/commands";
import { home } from "../services/library";
import { saveFile, openFile, useFile } from "../services/files";
const groups: Command["group"][] = [
  "File",
  "Edit",
  "Layer",
  "Animation",
  "View",
  "Help",
];
export function Header({ onImport }: { onImport: () => void }) {
  const s = useStudio(),
    d = s.document!,
    link = useFile((v) => v.links[d.id]),
    [menu, setMenu] = useState<Command["group"] | null>(null),
    [title, setTitle] = useState(d.title),
    container = useRef<HTMLDivElement>(null),
    popup = useRef<HTMLDivElement>(null),
    triggers = useRef<Partial<Record<Command["group"], HTMLButtonElement>>>({}),
    list = commands(onImport);
  useEffect(() => setTitle(d.title), [d.title]);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: MouseEvent) => {
      if (!container.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [menu]);
  const focusMenu = (group: Command["group"]) => {
    setMenu(group);
    requestAnimationFrame(() =>
      popup.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus(),
    );
  };
  const keys = (e: React.KeyboardEvent, g: Command["group"]) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setMenu(null);
      triggers.current[g]?.focus();
    }
    if (e.key === "Tab") setMenu(null);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      focusMenu(
        groups[(groups.indexOf(g) + (e.key === "ArrowRight" ? 1 : 5)) % 6],
      );
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      if (!menu) {
        focusMenu(g);
        return;
      }
      const rows = [
          ...(popup.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? []),
        ],
        at = rows.indexOf(document.activeElement as HTMLButtonElement);
      rows[
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? rows.length - 1
            : (at + (e.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length
      ]?.focus();
    }
  };
  return (
    <header className="studio-header" inert={s.busy}>
      <div className="menu-bar" ref={container}>
        <button
          className="header-mark"
          aria-label="Project library"
          onClick={() => void home()}
        >
          <img src="./mark.svg" alt="" />
        </button>
        <nav role="menubar" aria-label="Application menus">
          {groups.map((g) => (
            <div className="menu-group" key={g}>
              <button
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={menu === g}
                ref={(el) => {
                  if (el) triggers.current[g] = el;
                }}
                onClick={() => setMenu(menu === g ? null : g)}
                onMouseEnter={() => {
                  if (menu) setMenu(g);
                }}
                onKeyDown={(e) => keys(e, g)}
              >
                {g}
              </button>
              {menu === g && (
                <div
                  className="menu-popup"
                  style={{
                    position: "fixed",
                    left: Math.max(
                      6,
                      Math.min(
                        triggers.current[g]?.getBoundingClientRect().left ?? 6,
                        window.innerWidth - 260,
                      ),
                    ),
                    top: 29,
                  }}
                  role="menu"
                  aria-label={`${g} commands`}
                  ref={popup}
                  onKeyDown={(e) => keys(e, g)}
                >
                  {list
                    .filter((c) => c.group === g)
                    .map((c) => (
                      <button
                        role="menuitem"
                        aria-label={c.label}
                        key={c.id}
                        disabled={c.enabled?.() === false}
                        onClick={() => {
                          setMenu(null);
                          execute(c);
                        }}
                      >
                        <span>{c.label}</span>
                        <kbd>{c.shortcut}</kbd>
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <span className="product-wordmark">
          LUNO <i>STUDIO</i>
          <small>{VERSION}</small>
        </span>
        <button
          className="icon-button"
          aria-label="Search commands"
          title="Command search · Ctrl Shift P"
          onClick={() => s.set({ dialog: "commands" })}
        >
          <Search size={14} />
        </button>
      </div>
      <div className="document-bar">
        <button
          className="icon-button"
          aria-label="Back to projects"
          onClick={() => void home()}
        >
          <Home size={14} />
        </button>
        <div className="document-tab">
          <span>LAM</span>
          <input
            aria-label="Document title"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== d.title)
                s.commit("Rename document", (doc) => {
                  doc.title = title.trim();
                });
              else setTitle(d.title);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <small
            aria-label={
              link && link.snapshot !== d
                ? "Unsaved external file changes"
                : "External file state"
            }
          >
            {link && link.snapshot !== d ? "●" : ""}
          </small>
          <ChevronDown size={10} />
        </div>
        <span className={`save-indicator ${s.saveState}`}>
          <Check size={11} />
          {s.saveState === "saved"
            ? "Saved locally"
            : s.saveState === "saving"
              ? "Saving locally…"
              : "Library save failed"}
        </span>
        <span className="bar-divider" />
        <button
          className="icon-button"
          aria-label="Undo"
          disabled={!s.history.length}
          onClick={() => s.undo()}
        >
          <Undo2 size={14} />
        </button>
        <button
          className="icon-button"
          aria-label="Redo"
          disabled={!s.future.length}
          onClick={() => s.redo()}
        >
          <Redo2 size={14} />
        </button>
        <div className="document-bar-spacer" />
        <div
          className="workspace-switch"
          role="tablist"
          aria-label="Workspaces"
        >
          {(["Draw", "Motion", "Edit"] as Workspace[]).map((w) => (
            <button
              role="tab"
              aria-selected={s.workspace === w}
              key={w}
              onClick={() =>
                s.set({
                  workspace: w,
                  tool: w === "Draw" ? "brush" : "select",
                  playing: false,
                })
              }
            >
              {w}
            </button>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label="Save project"
          title={link ? `Overwrite ${link.name}` : "Choose .lam destination"}
          onClick={() => void saveFile()}
        >
          <Save size={14} />
        </button>
        <button
          className="icon-button"
          aria-label="Open project"
          onClick={() => void openFile()}
        >
          <FolderOpen size={14} />
        </button>
        <button
          className="button primary"
          aria-label="Export"
          onClick={() => s.set({ dialog: "export" })}
        >
          Export
          <ArrowDownToLine size={13} />
        </button>
      </div>
    </header>
  );
}
