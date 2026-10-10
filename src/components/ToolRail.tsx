import { Bone, Camera, Type, Circle, Hand, MousePointer2, PenLine, Settings2, Square, Upload } from 'lucide-react';
import type { Tool } from '../engine/types';
import { useEditor } from '../store/editor';
const tools: { id: Tool; label: string; key: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select', key: 'V', icon: MousePointer2 },
  { id: 'hand', label: 'Pan', key: 'H', icon: Hand },
  { id: 'pen', label: 'Draw', key: 'B', icon: PenLine },
  { id: 'rectangle', label: 'Rectangle', key: 'R', icon: Square },
  { id: 'ellipse', label: 'Ellipse', key: 'O', icon: Circle },
  { id: 'text', label: 'Text', key: 'T', icon: Type },
  { id: 'camera', label: 'Camera', key: 'C', icon: Camera },
  { id: 'rig', label: 'Pose rig', key: 'G', icon: Bone },
];
export function ToolRail({ onImport }: { onImport: () => void }) {
  const tool = useEditor(s => s.tool), color = useEditor(s => s.preferences.brushColor);
  return <aside className="tool-rail" aria-label="Drawing tools"><div className="rail-tools">{tools.map(({ id, label, key, icon: Icon }, index) => <div key={id} className={index === 2 || index === 5 ? 'rail-group' : ''}><button className={`tool-button ${tool === id ? 'selected' : ''}`} onClick={() => { useEditor.getState().setTool(id); if (id === 'rig') useEditor.getState().setPreference('showBones', true); }} data-tooltip={`${label} · ${key}`} aria-label={`${label} tool`} aria-pressed={tool === id}><Icon size={19} strokeWidth={1.65} /></button></div>)}</div><label className="tool-color" title="Drawing color"><input type="color" aria-label="Drawing color" value={color} onChange={e => useEditor.getState().setPreference('brushColor', e.target.value)} /></label><div className="rail-bottom"><button className="tool-button" onClick={onImport} data-tooltip="Import artwork" aria-label="Import artwork"><Upload size={18} /></button><button className="tool-button" onClick={() => useEditor.getState().setDialog('settings')} data-tooltip="Settings" aria-label="Settings"><Settings2 size={18} /></button></div></aside>;
}
