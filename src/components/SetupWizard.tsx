import { useEffect, useState } from 'react';
import { ArrowRight, Check, FolderOpen, LockKeyhole } from 'lucide-react';
import { adaptCanvas, createProject, uid } from '../engine/project';
import { createPreset } from '../engine/animation';
import { openDocument, flushProject } from '../services/library';
import { useEditor } from '../store/editor';
import { useWorkspace } from '../store/workspace';
import { APP_VERSION } from '../config/version';
import { Modal } from './Modal';

const steps = ['Workspace', 'Document source', 'Document settings', 'Summary'];
const canvasPresets = [{ label: '960 × 600', width: 960, height: 600 }, { label: '1920 × 1080', width: 1920, height: 1080 }, { label: '1080 × 1080', width: 1080, height: 1080 }, { label: '1080 × 1920', width: 1080, height: 1920 }];
export function SetupWizard() {
  const current = useEditor(s => s.project);
  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState<'current' | 'character' | 'shapes' | 'blank'>(useEditor.getState().view === 'editor' ? 'current' : 'blank');
  const [canvas, setCanvas] = useState(0), [fps, setFps] = useState(24), [name, setName] = useState('Untitled-1');
  const [folder, setFolder] = useState<string | null>(null), [choosingFolder, setChoosingFolder] = useState(false), [finishing, setFinishing] = useState(false);
  const [layout, setLayout] = useState(useWorkspace.getState().workspace), [theme, setTheme] = useState(useEditor.getState().preferences.theme);
  useEffect(() => {
    let active = true;
    void window.luno?.getWorkspace().then(path => { if (active) setFolder(path); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const close = () => { if (!finishing) useEditor.getState().setDialog(null); };
  const skip = () => { useEditor.getState().setPreference('onboardingComplete', true); close(); void flushProject().catch(() => {}); };
  const finish = async () => {
    setFinishing(true);
    try {
      const state = useEditor.getState(); let project = template === 'current' ? structuredClone(current) : createProject(template);
      if (template === 'blank') project.background = '#ffffff';
      if (template === 'current' && state.view === 'editor') project.id = uid();
      if (template === 'character' || template === 'shapes') {
        const item = project.items.find(i => !i.locked && (i.type === 'character' || i.shape === 'ellipse'));
        if (item) project.keyframes[item.id] = createPreset(item, template === 'character' ? 'wave' : 'bounce', project.duration);
      }
      const preset = canvasPresets[canvas]; project = adaptCanvas(project, preset.width, preset.height); project.name = name.trim() || 'Untitled-1'; project.fps = fps;
      await openDocument(project); state.setPreference('onboardingComplete', true); state.setPreference('theme', theme); useWorkspace.getState().preset(layout); await flushProject(); state.setDialog(null); state.notify('Workspace configured.');
    } catch (error) { useEditor.getState().notify(error instanceof Error ? error.message : 'Workspace configuration failed. Existing documents are unchanged.', 'error'); }
    finally { setFinishing(false); }
  };
  const chooseFolder = async () => {
    if (!window.luno) return;
    setChoosingFolder(true);
    try { const selected = await window.luno.chooseFolder(); if (selected) setFolder(selected); }
    catch { useEditor.getState().notify('Folder selection failed.', 'error'); }
    finally { setChoosingFolder(false); }
  };
  return <Modal title="Workspace configuration" onClose={close} className="wizard-modal production-setup">
    <div className="wizard-sidebar"><div className="wizard-brand"><span className="setup-application-mark"><img src="./favicon.svg" alt="" /></span><span>LUNO ANIMATE</span></div><span className="wizard-overline">CONFIGURATION / {APP_VERSION}</span><h3>Workspace<br />configuration</h3><div className="wizard-steps">{steps.map((label, index) => <div key={label} className={`${step === index ? 'current' : ''} ${step > index ? 'complete' : ''}`}><span>{step > index ? <Check size={12} /> : String(index + 1).padStart(2, '0')}</span><strong>{label}</strong></div>)}</div><div className="wizard-sidebar-bottom"><LockKeyhole size={13} /><span>Local filesystem / IndexedDB<br />No account required</span></div></div>
    <div className="wizard-body"><div className="wizard-progress">APPLICATION PREFERENCES <span>{String(step + 1).padStart(2, '0')} / 04</span></div><div className="wizard-step-content">
      {step === 0 && <><h1>Workspace</h1><div className="wizard-fields"><label className="form-label">Panel layout<select aria-label="Setup workspace layout" value={layout} onChange={e => setLayout(e.target.value as typeof layout)}><option value="Animation">Animation</option><option value="Drawing">Drawing</option><option value="Rigging">Rigging</option></select></label><label className="form-label">Interface theme<select aria-label="Setup interface theme" value={theme} onChange={e => setTheme(e.target.value as typeof theme)}><option value="dark">Dark</option><option value="light">Light</option></select></label>{window.luno && <div className="workspace-folder"><span>External project folder</span><button className="button secondary" disabled={choosingFolder} onClick={chooseFolder}><FolderOpen size={14} />{choosingFolder ? 'Selecting…' : folder ? 'Change folder' : 'Choose folder'}</button>{folder && <small>{folder}</small>}</div>}</div><div className="configuration-info"><span>DOCUMENT STORAGE</span><p>The native library, revisions, and backups remain in the application data directory. This folder preference only changes the location offered by file dialogs.</p></div></>}
      {step === 1 && <><h1>Document source</h1><div className="template-choices">{[
        { id: 'blank', title: 'Blank document', desc: 'Empty stage. No sample layers or animation.' },
        { id: 'current', title: 'Current document', desc: 'Create a separate copy of the loaded document.' },
        { id: 'character', title: 'Character rig', desc: '15-bone FK / IK skeleton with pose keyframes.' },
        { id: 'shapes', title: 'Vector animation', desc: 'Vector layers with transform keyframes.' },
      ].map(({ id, title, desc }) => <button key={id} className={`template-choice ${template === id ? 'selected' : ''}`} aria-pressed={template === id} onClick={() => setTemplate(id as typeof template)}><span className="radio-check">{template === id && <Check size={12} />}</span><div><strong>{title}</strong><span>{desc}</span></div></button>)}</div><p className="wizard-note">Existing documents and revisions are retained.</p></>}
      {step === 2 && <><h1>Document settings</h1><div className="wizard-fields"><label className="form-label">Project name<input value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder="Untitled-1" /></label><label className="form-label">Stage size<select aria-label="Setup stage size" value={canvas} onChange={e => setCanvas(Number(e.target.value))}>{canvasPresets.map((preset, i) => <option key={preset.label} value={i}>{preset.label}</option>)}</select></label><label className="form-label">Frame rate<select aria-label="Setup frame rate" value={fps} onChange={e => setFps(Number(e.target.value))}>{[12, 24, 25, 30, 60].map(value => <option key={value} value={value}>{value} fps</option>)}</select></label></div></>}
      {step === 3 && <><h1>Configuration summary</h1><dl className="configuration-summary"><div><dt>Document</dt><dd>{name.trim() || 'Untitled-1'}</dd></div><div><dt>Source</dt><dd>{template}</dd></div><div><dt>Stage</dt><dd>{canvasPresets[canvas].label} px</dd></div><div><dt>Frame rate</dt><dd>{fps} fps</dd></div><div><dt>Workspace</dt><dd>{layout} / {theme}</dd></div></dl><div className="configuration-info"><span>REFERENCE</span><p>Commands and shortcuts are documented in Help → Reference. Panel layouts can be changed in Window. Configuration can be reopened from Help → Workspace setup.</p></div></>}
    </div><div className="wizard-footer"><button className="text-button" disabled={finishing} onClick={step === 0 ? skip : () => setStep(step - 1)}>{step === 0 ? 'Skip setup' : 'Back'}</button><button className="button primary" disabled={finishing || choosingFolder || (step >= 2 && !name.trim())} onClick={step < 3 ? () => setStep(step + 1) : () => void finish()}>{finishing ? 'Applying…' : step === 3 ? 'Open workspace' : 'Continue'}<ArrowRight size={14} /></button></div></div>
  </Modal>;
}
