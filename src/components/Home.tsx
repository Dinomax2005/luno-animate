import { useEffect, useRef, useState } from 'react';
import { Bone, Clapperboard, Copy, Ellipsis, FolderOpen, HelpCircle, Moon, Pencil, Plus, RefreshCw, Search, Settings2, Shield, Sun, Trash2, Upload } from 'lucide-react';
import { useStudio } from '../state/studio';
import { VERSION, type Workspace } from '../core/model';
import { deleteProject, duplicateProject, loadProject } from '../services/library';
import { openFile } from '../services/files';

const newKinds: { id: Workspace; title: string; detail: string; icon: typeof Pencil }[] = [
  { id: 'Draw', title: 'Draw', detail: 'cels', icon: Pencil },
  { id: 'Motion', title: 'Motion', detail: 'keys', icon: Bone },
  { id: 'Edit', title: 'Edit', detail: 'media', icon: Clapperboard },
];
const modified = (time: number) => new Date(time).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export function Home() {
  const s = useStudio();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'modified' | 'name'>('modified');
  const [menu, setMenu] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const row = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: MouseEvent) => { if (!row.current?.contains(event.target as Node)) setMenu(null); };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [menu]);
  const run = async (id: string, action: () => Promise<unknown>) => {
    if (working) return;
    setMenu(null); setWorking(id);
    try { await action(); } catch (error) { s.notify(error instanceof Error ? error.message : 'The operation could not be completed.', true); }
    finally { setWorking(null); }
  };
  const visible = s.library
    .filter(project => project.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (sort === 'name' ? a.title.localeCompare(b.title) : b.modified - a.modified));
  const start = (workspace: Workspace) => s.set({ workspace, dialog: 'new' });

  return (
    <div className="home">
      <aside className="home-sidebar">
        <a className="brand" href="#" onClick={event => event.preventDefault()}><img src="./mark.svg" alt="" /><span>LUNO<small>STUDIO</small></span></a>
        <span className="home-version">Version {VERSION} · all tools enabled</span>
        <div className="home-primary">
          <div className="home-new" aria-label="New project">
            {newKinds.map(kind => (
              <button key={kind.id} aria-label={`New ${kind.id} project`} onClick={() => start(kind.id)}>
                <kind.icon size={14} /><span>{kind.title}</span><small>{kind.detail}</small>
              </button>
            ))}
          </div>
          <button className="button secondary" aria-label="Open project file" onClick={() => void openFile()}><FolderOpen size={13} />Open .lam file</button>
        </div>
        <span className="sidebar-overline">Library</span>
        <button className="home-nav active" aria-label="Project library"><FolderOpen size={14} />All documents<small>{s.library.length}</small></button>
        <div className="home-philosophy">
          <Shield size={14} />
          <strong>Free, local, no account</strong>
          <p>Documents stay in this device’s library. There are no subscriptions, activation codes, watermarks or locked tools.</p>
        </div>
        <div className="home-bottom">
          <button aria-label="Workspace setup" onClick={() => s.set({ dialog: 'setup' })}><Settings2 size={13} />Workspace setup</button>
          <button aria-label="Updates & backups" onClick={() => s.set({ dialog: 'updates' })}><RefreshCw size={13} />Updates &amp; backups</button>
          <button aria-label="Tools & shortcuts" onClick={() => s.set({ dialog: 'help' })}><HelpCircle size={13} />Tools &amp; shortcuts</button>
          <div>
            <button aria-label="About & licence" onClick={() => s.set({ dialog: 'about' })}>About &amp; licence</button>
            <button aria-label="Toggle interface theme" onClick={() => s.pref('theme', s.preferences.theme === 'dark' ? 'light' : 'dark')}>{s.preferences.theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}</button>
          </div>
        </div>
      </aside>
      <main className="home-main">
        <header>
          <span>Project library<i>/</i>{window.studio ? 'filesystem' : 'browser storage'}</span>
          <div>
            <button aria-label="New project" onClick={() => s.set({ dialog: 'new' })}><Plus size={13} />New project</button>
            <button aria-label="Open project file" onClick={() => void openFile()}><Upload size={13} />Open file</button>
          </div>
        </header>
        <div className="home-content">
          <div className="library-heading">
            <div><h2>Documents <small>{visible.length}</small></h2></div>
            <label className="search"><Search size={13} /><input aria-label="Search projects" value={search} placeholder="Filter by name" onChange={event => setSearch(event.target.value)} /></label>
            <select aria-label="Sort projects" value={sort} onChange={event => setSort(event.target.value as typeof sort)}>
              <option value="modified">Last modified</option>
              <option value="name">Name</option>
            </select>
          </div>
          {visible.length ? (
            <table className="project-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Mode</th>
                  <th scope="col" className="numeric">Scenes</th>
                  <th scope="col" className="numeric">Length</th>
                  <th scope="col">Modified</th>
                  <th scope="col" aria-label="Row actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map(project => (
                  <tr className="project-row" key={project.id} ref={menu === project.id ? row : undefined}>
                    <td>
                      <button className="project-open" aria-label={`Open ${project.title}`} disabled={!!working} onClick={() => void run(project.id, () => loadProject(project.id))}>
                        <span className="project-thumb">{project.thumbnail ? <img src={project.thumbnail} alt="" /> : <Clapperboard size={14} />}</span>
                        <span className="project-card-info"><strong>{project.title}</strong><span>{project.workspace} document</span></span>
                      </button>
                    </td>
                    <td className="project-kind">{project.workspace}</td>
                    <td className="numeric">{project.scenes}</td>
                    <td className="numeric">{project.seconds.toFixed(2)}s</td>
                    <td>{modified(project.modified)}</td>
                    <td className="project-actions-cell">
                      <div className="project-row-actions">
                        <button aria-label={`Duplicate ${project.title}`} onClick={() => void run(project.id, () => duplicateProject(project.id))}><Copy size={13} /></button>
                        <button aria-label={`Actions for ${project.title}`} aria-expanded={menu === project.id} onClick={() => setMenu(menu === project.id ? null : project.id)}><Ellipsis size={14} /></button>
                      </div>
                      {menu === project.id && (
                        <div className="project-actions" role="menu" aria-label={`${project.title} actions`}>
                          <button role="menuitem" onClick={() => void run(project.id, () => duplicateProject(project.id))}><Copy size={12} />Duplicate</button>
                          <button role="menuitem" className="danger-text" onClick={() => { setMenu(null); if (confirm(`Remove ${project.title} from this library? External .lam files are not touched.`)) void run(project.id, () => deleteProject(project.id)); }}><Trash2 size={12} />Remove from library</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-library">
              <h3>{search ? 'No documents match this filter.' : 'No documents yet.'}</h3>
              <p>{search ? 'Clear the filter to see the full library.' : 'Create a Draw, Motion or Edit project, or open a Luno Studio 1.0 .lam file. Nothing is preinstalled and nothing is uploaded.'}</p>
              {!search && <div className="empty-actions"><button className="button" aria-label="Open project file" onClick={() => void openFile()}><FolderOpen size={13} />Open .lam file</button><button className="button primary" aria-label="New project" onClick={() => s.set({ dialog: 'new' })}><Plus size={13} />New project</button></div>}
            </div>
          )}
          <div className="home-support-note">
            <Shield size={12} />
            <span>Studio 1.0 uses a new document format. Earlier Luno Animate releases and their project files are unsupported here and are not converted automatically — keep independent copies of legacy work.</span>
          </div>
          <footer>
            <span>LUNO STUDIO {VERSION}</span>
            <span>{window.studio ? 'Filesystem library' : 'IndexedDB library'}<i>·</i>local rendering<i>·</i>no account</span>
          </footer>
        </div>
      </main>
      {working && <div className="update-notice" role="status"><div><RefreshCw size={14} className="spin" /><strong>{working === 'listing' ? 'Loading' : 'Working'}</strong></div><p>Finishing the local library operation. Do not close the window.</p></div>}
    </div>
  );
}
