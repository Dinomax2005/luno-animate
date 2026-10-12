import { useState } from "react";
import {
  ArrowRight,
  Bone,
  Clapperboard,
  Copy,
  Ellipsis,
  Film,
  FolderOpen,
  Grid2X2,
  HelpCircle,
  Moon,
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  Pencil,
  Download,
} from "lucide-react";
import { useStudio } from "../state/studio";
import { VERSION, type Workspace } from "../core/model";
import {
  deleteProject,
  duplicateProject,
  loadProject,
} from "../services/library";
import { openFile } from "../services/files";
export function Home() {
  const s = useStudio(),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("modified"),
    [menu, setMenu] = useState<string | null>(null);
  const visible = s.library
      .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) =>
        sort === "name"
          ? a.title.localeCompare(b.title)
          : b.modified - a.modified,
      ),
    start = (w: Workspace) => s.set({ workspace: w, dialog: "new" });
  return (
    <div className="home">
      <aside className="home-sidebar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <img src="./mark.svg" alt="" />
          <span>
            LUNO<small>STUDIO</small>
          </span>
        </a>
        <span className="home-version">RELEASE 1.0.0</span>
        <div className="home-primary">
          <button
            className="button primary"
            aria-label="New project"
            onClick={() => s.set({ dialog: "new" })}
          >
            <Plus size={14} />
            New project
          </button>
          <button
            className="button secondary"
            aria-label="Open project file"
            onClick={() => void openFile()}
          >
            <FolderOpen size={14} />
            Open project
          </button>
        </div>
        <span className="sidebar-overline">WORKSPACE</span>
        <button className="home-nav active">
          <Grid2X2 size={15} />
          Project library<small>{s.library.length}</small>
        </button>
        <div className="home-philosophy">
          <Shield size={18} />
          <strong>
            Made for your work.
            <br />
            Not your subscription.
          </strong>
          <p>
            Every tool is available. Files stay on your device. Your creations
            stay yours.
          </p>
        </div>
        <div className="home-bottom">
          <button onClick={() => s.set({ dialog: "setup" })}>
            <Settings2 size={14} />
            Workspace setup
          </button>
          <button onClick={() => s.set({ dialog: "updates" })}>
            <Download size={14} />
            Updates & backups
          </button>
          <button onClick={() => s.set({ dialog: "help" })}>
            <HelpCircle size={14} />
            Tools & shortcuts
          </button>
          <div>
            <button onClick={() => s.set({ dialog: "about" })}>
              About & licence
            </button>
            <button
              aria-label="Toggle interface theme"
              onClick={() =>
                s.pref(
                  "theme",
                  s.preferences.theme === "dark" ? "light" : "dark",
                )
              }
            >
              {s.preferences.theme === "dark" ? (
                <Sun size={14} />
              ) : (
                <Moon size={14} />
              )}
            </button>
          </div>
        </div>
      </aside>
      <main className="home-main">
        <header>
          <span>
            YOUR STUDIO <i>/</i>{" "}
            {window.studio ? "ON THIS COMPUTER" : "IN THIS BROWSER"}
          </span>
          <button onClick={() => s.set({ dialog: "about" })}>
            <span className="free-dot" />
            FREE BY DESIGN
          </button>
        </header>
        <div className="home-content">
          <section className="home-hero">
            <div>
              <span className="eyebrow">ANIMATION, WITH INTENT.</span>
              <h1>
                Ideas into
                <br />
                <em>motion.</em>
              </h1>
              <p>
                A single canvas for drawings, characters and film.
                <br />A deliberate workspace for the way you create.
              </p>
              <button
                className="button primary"
                onClick={() => s.set({ dialog: "new" })}
              >
                Start something new
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="hero-frame back" />
              <div className="hero-frame middle" />
              <div className="hero-frame front">
                <img src="./mark.svg" alt="" />
                <small>
                  FRAME 001 <span>●</span>
                </small>
              </div>
              <div className="hero-path" />
              <span className="hero-caption">DRAW. MOVE. MAKE.</span>
            </div>
          </section>
          <div className="start-cards">
            {[
              {
                w: "Draw" as const,
                icon: Pencil,
                title: "Draw your story",
                desc: "Pressure brushes, drawing cels and expressive timing.",
                tag: "DRAW / FRAME BY FRAME",
              },
              {
                w: "Motion" as const,
                icon: Bone,
                title: "Bring it to life",
                desc: "Armatures, precise keys, groups and custom easing.",
                tag: "MOTION / POSE & ANIMATE",
              },
              {
                w: "Edit" as const,
                icon: Clapperboard,
                title: "Build the sequence",
                desc: "Footage, audio and animated layers on one timeline.",
                tag: "EDIT / CUT & COMPOSE",
              },
            ].map((card) => (
              <button
                key={card.w}
                aria-label={`New ${card.w} project`}
                onClick={() => start(card.w)}
              >
                <div>
                  <card.icon size={22} strokeWidth={1.5} />
                  <ArrowRight size={14} />
                </div>
                <small>{card.tag}</small>
                <strong>{card.title}</strong>
                <p>{card.desc}</p>
              </button>
            ))}
          </div>
          <section className="library-section">
            <div className="library-heading">
              <div>
                <span className="eyebrow">LOCAL DOCUMENTS</span>
                <h2>
                  Your projects <small>{s.library.length}</small>
                </h2>
              </div>
              <label className="search">
                <Search size={14} />
                <input
                  aria-label="Search projects"
                  value={search}
                  placeholder="Find a project…"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <select
                aria-label="Sort projects"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="modified">Last modified</option>
                <option value="name">Name</option>
              </select>
            </div>
            {visible.length ? (
              <div className="project-grid">
                {visible.map((p) => (
                  <article className="project-card" key={p.id}>
                    <button
                      className="project-open"
                      aria-label={`Open ${p.title}`}
                      onClick={() => void loadProject(p.id)}
                    >
                      <div className="project-thumb">
                        {p.thumbnail ? (
                          <img src={p.thumbnail} alt={`${p.title} preview`} />
                        ) : (
                          <Film size={27} />
                        )}
                        <small>
                          {p.scenes} scene{p.scenes === 1 ? "" : "s"}
                        </small>
                      </div>
                      <div className="project-card-info">
                        <strong>{p.title}</strong>
                        <span>
                          {p.workspace} <i>·</i> {p.seconds.toFixed(2)}s
                        </span>
                        <small>
                          {new Date(p.modified).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </small>
                      </div>
                    </button>
                    <button
                      className="project-action-button"
                      aria-label={`Actions for ${p.title}`}
                      onClick={() => setMenu(menu === p.id ? null : p.id)}
                    >
                      <Ellipsis size={17} />
                    </button>
                    {menu === p.id && (
                      <div className="project-actions">
                        <button
                          onClick={() => {
                            setMenu(null);
                            void duplicateProject(p.id).catch((e) =>
                              s.notify(e.message, true),
                            );
                          }}
                        >
                          <Copy size={12} />
                          Duplicate
                        </button>
                        <button
                          className="danger-text"
                          onClick={() => {
                            setMenu(null);
                            if (
                              confirm(
                                `Permanently delete ${p.title} from this library? External .lam files are unchanged.`,
                              )
                            )
                              void deleteProject(p.id).catch((e) =>
                                s.notify(e.message, true),
                              );
                          }}
                        >
                          <Trash2 size={12} />
                          Delete from library
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-library">
                <FolderOpen size={29} strokeWidth={1.2} />
                <h3>{search ? "No matching projects" : "A fresh start."}</h3>
                <p>
                  {search
                    ? "Try a different name."
                    : "Create a document or open a Luno Studio 1.0 .lam file."}
                </p>
                <button
                  className="button secondary"
                  onClick={() => void openFile()}
                >
                  Open a project
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </section>
          <div className="home-support-note">
            <Sparkles size={13} />
            <span>
              Luno Studio 1.0 is a clean foundation. Previous Luno Animate
              releases and formats are unsupported. Keep legacy work in
              independent backups.
            </span>
          </div>
          <footer>
            <span>LUNO STUDIO / {VERSION}</span>
            <span>
              {window.studio ? "Filesystem library" : "IndexedDB library"}{" "}
              <i>·</i> local rendering <i>·</i> no account
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
