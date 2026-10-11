import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, Bone, ChevronDown, Clock3, Copy, Ellipsis, Film, FolderOpen, Grid2X2, HelpCircle, Layers2, List, Moon, Plus, RefreshCw, Search, Sparkles, SquarePen, Star, Sun, Trash2, Type, Undo2 } from 'lucide-react';
import { APP_VERSION } from '../../config/version';
import { useEditor } from '../../store/editor';
import { createProject } from '../../engine/project';
import { createPreset } from '../../engine/animation';
import { saveProject } from '../../engine/files';
import { useDocumentFiles } from '../../services/document-files';
import { changeRecord, duplicateProject, openDocument, openLibraryProject, recoverProject, refreshLibrary } from '../../services/library';
import { repository } from '../../services/repository';
import { Modal } from '../Modal';
import type { ProjectRecord, Template } from '../../engine/types';

type Section = 'projects' | 'favorites' | 'templates' | 'trash';
export const templates: { id: Template; name: string; caption: string; icon: typeof Bone; color: string }[] = [
  { id: 'blank', name: 'Blank document', caption: 'Empty vector document', icon: SquarePen, color: '#27282d' },
  { id: 'character', name: 'Character animation', caption: '15-bone FK / IK rig · transform keys', icon: Bone, color: '#27282d' },
  { id: 'shapes', name: 'Motion graphics', caption: 'Vector layers · transform animation', icon: Sparkles, color: '#27282d' },
  { id: 'title', name: 'Typography', caption: 'Text layers · editable transforms', icon: Type, color: '#27282d' },
  { id: 'cutout', name: 'Cutout rig', caption: 'Bone hierarchy · joint attachments', icon: Layers2, color: '#27282d' },
];
export function starter(template: Template) {
  const project = createProject(template);
  if (template === 'blank') { project.name = 'Untitled-1'; project.background = '#ffffff'; }
  const item = template === 'character' ? project.items.find(i => i.type === 'character') : template === 'shapes' ? project.items.find(i => i.shape === 'ellipse' && !i.locked) : template === 'title' ? project.items.find(i => i.type === 'text') : undefined;
  if (item) project.keyframes[item.id] = createPreset(item, template === 'character' ? 'wave' : template === 'title' ? 'slide' : 'bounce', project.duration);
  return project;
}
function edited(time: number) {
  return new Date(time).toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
export function ProjectHome({ onOpen }: { onOpen: () => void }) {
  const busy = useEditor(s => s.busy), projects = useEditor(s => s.projects), ready = useEditor(s => s.libraryReady), prefs = useEditor(s => s.preferences);
  const [section, setSection] = useState<Section>('projects'), [search, setSearch] = useState(''), [sort, setSort] = useState('recent');
  const [layout, setLayout] = useState<'grid' | 'list'>('list'), [menu, setMenu] = useState<string | null>(null), [working, setWorking] = useState(false);
  const [modal, setModal] = useState<{ kind: 'rename' | 'delete'; project: ProjectRecord } | null>(null), [name, setName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null); };
    const keys = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', keys); };
  }, [menu]);
  const active = projects.filter(p => !p.deletedAt), trash = projects.filter(p => p.deletedAt), favorite = active.filter(p => p.starred);
  const filtered = useMemo(() => projects.filter(p => (section === 'trash' ? !!p.deletedAt : !p.deletedAt) && (section !== 'favorites' || p.starred) && p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'oldest' ? a.createdAt - b.createdAt : b.updatedAt - a.updatedAt), [projects, section, search, sort]);
  const run = async (fn: () => Promise<unknown>) => {
    if (working || useEditor.getState().busy || useEditor.getState().blockReason) return;
    setWorking(true); useEditor.getState().setBusy(true); setMenu(null);
    try { await fn(); } catch (error) { useEditor.getState().notify(error instanceof Error ? error.message : 'Document operation failed.', 'error'); }
    finally { setWorking(false); useEditor.getState().setBusy(false); }
  };
  const begin = (template: Template) => void run(() => openDocument(starter(template)));
  const title = section === 'favorites' ? 'Favorites' : section === 'templates' ? 'Templates' : section === 'trash' ? 'Trash' : 'Recent documents';
  return <div className="home-shell production-home" inert={busy}>
    <aside className="home-sidebar">
      <a href="#" className="home-brand" onClick={e => { e.preventDefault(); setSection('projects'); }}><span className="home-application-mark"><img src="./favicon.svg" alt="" /></span><span>LUNO<small>ANIMATE</small></span></a>
      <div className="home-file-actions"><button className="button secondary" disabled={!ready || working} onClick={() => useEditor.getState().setDialog('new')}><Plus size={14} /> New project</button><button className="button secondary" disabled={!ready || working} onClick={onOpen}><FolderOpen size={14} /> Open…</button></div>
      <span className="home-nav-label">DOCUMENTS</span>
      <nav aria-label="Project library">{([{ id: 'projects', label: 'All projects', icon: FolderOpen, count: active.length }, { id: 'favorites', label: 'Favorites', icon: Star, count: favorite.length }, { id: 'templates', label: 'Templates', icon: Layers2 }, { id: 'trash', label: 'Trash', icon: Trash2, count: trash.length }] as const).map(item => <button key={item.id} aria-label={item.label} title={item.label} className={section === item.id ? 'active' : ''} onClick={() => { setSection(item.id); setSearch(''); }}><item.icon size={15} /><span>{item.label}</span>{'count' in item && <small>{item.count}</small>}</button>)}</nav>
      <div className="home-sidebar-bottom"><button aria-label="Updates & backups" title="Updates & backups" onClick={() => useEditor.getState().setDialog('updates')}><RefreshCw size={14} /> Updates & backups</button><button aria-label="Reference" title="Reference" onClick={() => useEditor.getState().setDialog('help')}><HelpCircle size={14} /> Reference</button><div><span>LUNO ANIMATE <small>{APP_VERSION}</small></span><button aria-label="Toggle dark studio" onClick={() => useEditor.getState().setPreference('theme', prefs.theme === 'dark' ? 'light' : 'dark')}>{prefs.theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}</button></div></div>
    </aside>
    <main className="home-main">
      <header className="home-topbar"><span>DOCUMENT MANAGER</span><button className="text-button" onClick={() => useEditor.getState().setDialog('download')}>Desktop builds <ArrowDownToLine size={12} /></button></header>
      <div className="home-content"><div className="home-greeting"><div><h1>{title}</h1><p>{window.luno ? 'Native document library' : 'Local browser library'} · {section === 'trash' ? trash.length : active.length} document{active.length === 1 ? '' : 's'}</p></div><span className="home-file-format">LUNO DOCUMENT / .LAM</span></div>
        {section === 'templates' ? <div className="production-templates">{templates.map(template => <button key={template.id} disabled={working || !ready} onClick={() => begin(template.id)}><span className="production-template-icon"><template.icon size={22} /></span><div><strong>{template.name}</strong><small>{template.caption}</small></div><Plus size={14} /></button>)}</div> : <>
          <div className="home-library-bar"><h2>{section === 'favorites' ? 'Starred documents' : section === 'trash' ? 'Deleted documents' : 'Documents'} <span>{filtered.length}</span></h2><div><label className="home-search"><Search size={14} /><input placeholder="Filter documents" aria-label="Search projects" value={search} onChange={e => setSearch(e.target.value)} /></label><label className="home-sort"><Clock3 size={13} /><select aria-label="Sort projects" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Date modified</option><option value="name">Name</option><option value="oldest">Date created</option></select><ChevronDown size={12} /></label><span className="home-layout-switch"><button aria-label="Project grid view" aria-pressed={layout === 'grid'} className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}><Grid2X2 size={14} /></button><button aria-label="Project list view" aria-pressed={layout === 'list'} className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}><List size={15} /></button></span></div></div>
          {layout === 'list' && filtered.length > 0 && <div className="document-table-heading"><span>Name</span><span>Type</span><span>Duration</span><span>Modified</span><span>Actions</span></div>}
          {!ready ? <div className="home-empty"><RefreshCw size={20} className="spin" /><h3>Loading library</h3><button className="button secondary" onClick={() => void refreshLibrary().catch(e => useEditor.getState().notify(e.message, 'error'))}>Retry</button></div> : filtered.length ? <div className={`home-projects ${layout}`}>{filtered.map(project => <article className={`home-project-card ${menu === project.id ? 'menu-open' : ''}`} key={project.id}>
            <button className="project-open" disabled={working || !!project.deletedAt} onClick={() => void run(() => openLibraryProject(project.id))}><div className="project-thumbnail" style={{ aspectRatio: '1.65' }}>{project.thumbnail ? <img src={project.thumbnail} alt={`${project.name} preview`} /> : <div className="project-no-preview"><Film size={23} strokeWidth={1.3} /></div>}<span className="project-scene-count"><Layers2 size={10} />{project.scenes}</span></div><div className="project-card-info"><h3>{project.name}</h3><span className="document-kind">{project.kind}</span><div><span className="document-duration">{(project.frames / project.fps).toFixed(2)} s · {project.fps} fps</span><span className="document-modified">{edited(project.updatedAt)}</span></div></div></button>
            <div className="project-card-actions"><button className={`project-star ${project.starred ? 'starred' : ''}`} aria-label={`${project.starred ? 'Unfavorite' : 'Favorite'} ${project.name}`} disabled={working} onClick={() => void run(() => changeRecord(project.id, { starred: !project.starred }))}><Star size={13} fill={project.starred ? 'currentColor' : 'none'} /></button><div ref={menu === project.id ? menuRef : undefined}><button className="project-menu-trigger" aria-label={`${project.name} project actions`} aria-expanded={menu === project.id} onClick={() => setMenu(menu === project.id ? null : project.id)}><Ellipsis size={17} /></button>{menu === project.id && <div className="dropdown project-menu">{!project.deletedAt ? <>
              <button onClick={() => void run(() => openLibraryProject(project.id))}><FolderOpen size={14} /> Open project</button><button onClick={() => { setMenu(null); setName(project.name); setModal({ kind: 'rename', project }); }}><SquarePen size={14} /> Rename</button><button onClick={() => void run(() => duplicateProject(project.id))}><Copy size={14} /> Duplicate</button><button onClick={() => void run(async () => { await saveProject(await repository().load(project.id)); })}><ArrowDownToLine size={14} /> Export .lam</button><button onClick={() => void run(() => recoverProject(project.id))}><Undo2 size={14} /> Recover prior save</button><div className="dropdown-separator" /><button className="danger" onClick={() => void run(() => changeRecord(project.id, { deletedAt: Date.now() }))}><Trash2 size={14} /> Move to Trash</button>
            </> : <><button onClick={() => void run(() => changeRecord(project.id, { deletedAt: null }))}><Undo2 size={14} /> Restore project</button><button className="danger" onClick={() => { setMenu(null); setModal({ kind: 'delete', project }); }}><Trash2 size={14} /> Delete permanently</button></>}</div>}</div></div>
          </article>)}</div> : <div className="home-empty"><FolderOpen size={25} /><h3>{search ? 'No matching documents' : section === 'trash' ? 'Trash is empty' : section === 'favorites' ? 'No favorites' : 'No documents'}</h3>{section === 'projects' && !search && <button className="button secondary" onClick={onOpen}>Open a .lam file <ArrowRight size={13} /></button>}</div>}
        </>}
        <footer className="home-footer"><span>LUNO ANIMATE {APP_VERSION}</span><span>{window.luno ? 'Filesystem library' : 'IndexedDB library'} · .lam export / import</span></footer>
      </div>
    </main>
    {working && <div className="home-working" role="status"><RefreshCw className="spin" size={13} /> Document operation in progress</div>}
    {modal && <Modal title={modal.kind === 'rename' ? 'Rename your project' : 'Permanently delete project'} className="home-action-modal" onClose={() => setModal(null)}><h1>{modal.kind === 'rename' ? 'Rename document' : 'Permanently delete document'}</h1>{modal.kind === 'rename' ? <label className="form-label">Project name<input autoFocus value={name} maxLength={100} onChange={e => setName(e.target.value)} /></label> : <p>“{modal.project.name}” and its local revision history will be permanently removed. This cannot be undone.</p>}<div className="dialog-footer"><button className="button secondary" onClick={() => setModal(null)}>Cancel</button><button className={`button ${modal.kind === 'delete' ? 'danger-button' : 'primary'}`} disabled={working || (modal.kind === 'rename' && !name.trim())} onClick={() => void run(async () => { if (modal.kind === 'rename') await changeRecord(modal.project.id, { name }); else { await repository().deleteForever(modal.project.id); useDocumentFiles.getState().forget(modal.project.id); await refreshLibrary(); } setModal(null); })}>{modal.kind === 'rename' ? 'Save name' : 'Delete permanently'}</button></div></Modal>}
  </div>;
}
