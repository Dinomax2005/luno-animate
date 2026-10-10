import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Bot, Bone as BoneIcon, Type, Brush, Group, Link2, ChevronDown, ChevronRight, Circle, Copy, Eye, EyeOff, Image, Layers2, LockKeyhole, PenLine, Plus, Search, Sparkles, Square, Trash2, UnlockKeyhole, Upload } from 'lucide-react';
import { orderedItems } from '../engine/geometry';
import { useEditor } from '../store/editor';
import { createCharacter, createShape } from '../engine/project';
import type { SceneItem, ShapeKind } from '../engine/types';
import { ItemGraphic } from './SceneGraphics';

export const LayerIcon = ({ item, size = 15 }: { item: SceneItem; size?: number }) => item.type === 'text' ? <Type size={size} /> : item.type === 'group' ? <Group size={size} /> : item.type === 'drawing' ? <Brush size={size} /> : item.type === 'character' ? <Bot size={size} /> : item.type === 'image' ? <Image size={size} /> : item.type === 'path' ? <PenLine size={size} /> : item.shape === 'star' || item.shape === 'sparkle' ? <Sparkles size={size} /> : item.shape === 'ellipse' || item.shape === 'ground' ? <Circle size={size} /> : <Square size={size} />;
const libraryItems: { name: string; caption: string; kind: ShapeKind | 'character'; color: string }[] = [
  { name: 'Milo', caption: 'RIGGED CHARACTER', kind: 'character', color: '#efecf6' },
  { name: 'Circle', caption: 'VECTOR SHAPE', kind: 'ellipse', color: '#faeee5' },
  { name: 'Rectangle', caption: 'VECTOR SHAPE', kind: 'rectangle', color: '#eaf0e7' },
  { name: 'Star', caption: 'VECTOR SHAPE', kind: 'star', color: '#f6f1df' },
  { name: 'Sparkle', caption: 'VECTOR SHAPE', kind: 'sparkle', color: '#f3eef7' },
  { name: 'Ground', caption: 'VECTOR SHAPE', kind: 'ground', color: '#edf0ed' },
];
function AssetPreview({ kind }: { kind: ShapeKind | 'character' }) {
  const item = kind === 'character' ? createCharacter() : createShape(kind);
  if (kind === 'ground') { item.width = 125; item.height = 25; }
  return <svg viewBox={kind === 'character' ? '-170 -160 340 400' : '-80 -75 160 150'} aria-hidden="true"><ItemGraphic item={item} /></svg>;
}
export function Library({ onImport }: { onImport: () => void }) {
  const project = useEditor(s => s.project);
  const selectedId = useEditor(s => s.selectedId);
  const selectedIds = useEditor(s => s.selectedIds);
  const leftTab = useEditor(s => s.leftTab);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const selected = project.items.find(i => i.id === selectedId);
  return <aside className="library-panel">
    <div className="panel-tabs"><button className={leftTab === 'layers' ? 'active' : ''} onClick={() => useEditor.getState().setLeftTab('layers')}>Layers <span className="tab-count">{String(project.sceneOrder.indexOf(project.sceneId) + 1).padStart(2, '0')}</span></button><button className={leftTab === 'assets' ? 'active' : ''} onClick={() => useEditor.getState().setLeftTab('assets')}>Library <span className="new-dot" /></button></div>
    {leftTab === 'layers' ? <>
      <div className="scene-heading"><div className="scene-icon"><Layers2 size={16} /></div><div><strong>{project.sceneName}</strong><span>{(project.duration / project.fps).toFixed(1)} seconds · {project.fps} fps</span></div><button className="icon-button" aria-label="Scene settings" onClick={() => useEditor.getState().setDialog('settings')}><ChevronDown size={15} /></button></div>
      <div className="section-heading"><span>LAYERS</span><span className="heading-actions"><span>{project.items.length}</span><button className="icon-button small" aria-label="Add layer from assets" onClick={() => useEditor.getState().setLeftTab('assets')}><Plus size={15} /></button></span></div>
      <div className="layer-list">{orderedItems(project.items, true).map(item => <div key={item.id} className={`layer-wrap ${selectedId === item.id || selectedIds.includes(item.id) ? 'is-selected' : ''}`}>
        <div style={{ paddingLeft: item.parentId || item.attachment ? 13 : 0 }} className={`layer-row ${!item.visible ? 'hidden-layer' : ''}`}>
          <button className="layer-select" onClick={e => e.shiftKey ? useEditor.getState().toggleSelect(item.id) : useEditor.getState().select(item.id)}><span className="layer-thumbnail" style={{ background: item.type === 'character' ? '#ebe7f4' : `${item.fill}35` }}><LayerIcon item={item} size={17} /></span><span className="layer-name"><strong>{item.attachment && <Link2 size={9} />} {item.name}</strong><span>{item.type === 'character' ? `${item.rig?.bones.length ?? 0} bones · character` : item.type === 'image' ? 'Imported artwork' : item.type === 'drawing' ? `${item.cels?.length ?? 0} cels · drawing` : item.type === 'group' ? 'Animated group' : item.type === 'text' ? 'Editable text' : item.attachment ? 'Joint-attached artwork' : item.type === 'path' ? 'Vector drawing' : 'Vector shape'}</span></span></button>
          <button className="layer-action" aria-label={`${item.visible ? 'Hide' : 'Show'} ${item.name}`} onClick={() => useEditor.getState().editItem(item.id, { visible: !item.visible })}>{item.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
          <button className={`layer-action ${item.locked ? 'is-locked' : ''}`} aria-label={`${item.locked ? 'Unlock' : 'Lock'} ${item.name}`} onClick={() => useEditor.getState().editItem(item.id, { locked: !item.locked })}>{item.locked ? <LockKeyhole size={12} /> : <UnlockKeyhole size={12} />}</button>
        </div>
        {item.type === 'character' && selectedId === item.id && <div className="rig-subrow"><button onClick={() => setExpanded(!expanded)} className="rig-expand">{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}<span className="rig-dot" /> Character rig <span className="mini-count">{item.rig?.bones.length}</span></button>{expanded && <div className="rig-joints-list">{item.rig?.bones.map(bone => <button key={bone.id} onClick={() => { useEditor.getState().selectBone(bone.id); useEditor.getState().setTool('rig'); useEditor.getState().setPreference('showBones', true); }}><span className="hierarchy-line" />{bone.name}<span className="joint-dot" /></button>)}</div>}</div>}
      </div>)}{!project.items.length && <div className="empty-layers"><Layers2 size={23} /><p>No layers yet</p><button className="text-link" onClick={() => useEditor.getState().setLeftTab('assets')}>Insert from Library</button></div>}</div>
      <button className="add-layer-button" onClick={() => useEditor.getState().setLeftTab('assets')}><Plus size={14} /> Insert layer <span>+</span></button>
      {selected && <div className="layer-management"><span>Arrange layer</span><div><button className="icon-button small" aria-label="Move layer forward" onClick={() => useEditor.getState().moveLayer(selected.id, 'up')}><ArrowUp size={13} /></button><button className="icon-button small" aria-label="Move layer backward" onClick={() => useEditor.getState().moveLayer(selected.id, 'down')}><ArrowDown size={13} /></button><button className="icon-button small" aria-label="Duplicate layer" onClick={() => useEditor.getState().duplicateSelected()}><Copy size={13} /></button><button className="icon-button small" aria-label="Delete layer" onClick={() => useEditor.getState().deleteSelected()} disabled={selected.locked}><Trash2 size={13} /></button></div></div>}
      <div className="panel-spacer" />
      <button className="import-button" onClick={onImport}><Upload size={14} /> Import artwork <span>↗</span></button>
    </> : <>
      <div className="asset-intro"><h2>Symbols & primitives</h2></div>
      <div className="search-input"><Search size={14} /><input placeholder="Find an asset…" aria-label="Search assets" value={search} onChange={e => setSearch(e.target.value)} /><kbd>⌕</kbd></div>
      <div className="extra-assets"><button onClick={() => useEditor.getState().addBlankRig()}><BoneIcon size={15} /><span>Blank cutout rig</span><Plus size={12} /></button><button onClick={() => useEditor.getState().addText()}><Type size={15} /><span>Editable text</span><Plus size={12} /></button><button onClick={() => { useEditor.getState().setPreference('drawingMode', 'cel'); useEditor.getState().setTool('pen'); }}><Brush size={15} /><span>Frame-by-frame drawing</span><Plus size={12} /></button></div><div className="asset-grid">{libraryItems.filter(asset => asset.name.toLowerCase().includes(search.toLowerCase())).map(asset => <button className="asset-card" key={asset.kind} onClick={() => asset.kind === 'character' ? useEditor.getState().addCharacter() : useEditor.getState().addShape(asset.kind)}><div className="asset-preview" style={{ background: asset.color }}><AssetPreview kind={asset.kind} /><span className="asset-add"><Plus size={13} /></span>{asset.kind === 'character' && <span className="rigged-badge">RIGGED</span>}</div><strong>{asset.name}</strong><span>{asset.caption}</span></button>)}</div>
      {!libraryItems.some(a => a.name.toLowerCase().includes(search.toLowerCase())) && <p className="empty-search">No matching assets.</p>}
      <div className="asset-import-card"><Upload size={18} /><strong>Import artwork</strong><p>PNG · SVG · JPG · WebP</p><button className="button secondary" onClick={onImport}>Choose a file <ArrowUpRight size={13} /></button></div>
      <div className="panel-spacer" /><div className="library-footnote"><span className="green-dot" /> Embedded assets · no external dependencies</div>
    </>}
  </aside>;
}
