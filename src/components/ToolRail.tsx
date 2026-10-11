import { ArrowDownUp, Bone, Camera, Type, Circle, Eraser, Hand, MousePointer2, PaintBucket, PenLine, Pipette, Settings2, Square, Upload } from 'lucide-react';
import type { Tool } from '../engine/types';
import { useEditor } from '../store/editor';
import { usePaint } from '../store/paint';
const tools: { id: Tool; label: string; key: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select', key: 'V', icon: MousePointer2 },
  { id: 'hand', label: 'Pan', key: 'H', icon: Hand },
  { id: 'pen', label: 'Draw', key: 'B', icon: PenLine },
  { id: 'eraser', label: 'Eraser', key: 'E', icon: Eraser },
  { id: 'bucket', label: 'Fill', key: 'F', icon: PaintBucket },
  { id: 'eyedropper', label: 'Eyedropper', key: 'I', icon: Pipette },
  { id: 'rectangle', label: 'Rectangle', key: 'R', icon: Square },
  { id: 'ellipse', label: 'Ellipse', key: 'O', icon: Circle },
  { id: 'text', label: 'Text', key: 'T', icon: Type },
  { id: 'camera', label: 'Camera', key: 'C', icon: Camera },
  { id: 'rig', label: 'Pose rig', key: 'G', icon: Bone },
];
export function ToolRail({ onImport }: { onImport: () => void }) {
  const tool = useEditor(s => s.tool), color = useEditor(s => s.preferences.brushColor), background = usePaint(s => s.backgroundColor);
  return <aside className="tool-rail" aria-label="Drawing tools"><div className="rail-tools">{tools.map(({ id, label, key, icon: Icon }, index) => <div key={id} className={index === 2 || index === 6 || index === 8 ? 'rail-group' : ''}><button className={`tool-button ${tool === id ? 'selected' : ''}`} onClick={() => { useEditor.getState().setTool(id); if (id === 'rig') useEditor.getState().setPreference('showBones', true); }} data-tooltip={`${label} · ${key}`} aria-label={`${label} tool`} aria-pressed={tool === id}><Icon size={18} strokeWidth={1.65} /></button></div>)}</div><div className="rail-dual-colors"><button className="rail-background-color" aria-label="Use background paint color" title="Use background paint color · X" style={{ backgroundColor: background }} onClick={() => usePaint.getState().swapColors()} /><label className="tool-color" title="Foreground drawing color"><input type="color" aria-label="Drawing color" value={color} onChange={e => useEditor.getState().setPreference('brushColor', e.target.value)} /></label><button className="rail-color-swap" aria-label="Swap paint colors" title="Swap foreground / background · X" onClick={() => usePaint.getState().swapColors()}><ArrowDownUp size={10} /></button></div><div className="rail-bottom"><button className="tool-button" onClick={onImport} data-tooltip="Import artwork" aria-label="Import artwork"><Upload size={18} /></button><button className="tool-button" onClick={() => useEditor.getState().setDialog('settings')} data-tooltip="Settings" aria-label="Settings"><Settings2 size={18} /></button></div></aside>;
}
