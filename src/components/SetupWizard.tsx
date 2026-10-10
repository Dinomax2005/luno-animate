import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Bone, Check, Circle, FolderOpen, Heart, Layers2, LockKeyhole, MousePointer2, Play, Rocket, Sparkles, SquarePen } from 'lucide-react';
import { adaptCanvas, createCharacter, createProject } from '../engine/project';
import { createPreset } from '../engine/animation';
import { useEditor } from '../store/editor';
import { ItemGraphic } from './SceneGraphics';
import { Modal } from './Modal';

const steps = ['A little welcome', 'Your starting point', 'Make it yours', 'Ready, set, create'];
const canvasPresets = [{ label: 'Classic · 960 × 600', width: 960, height: 600 }, { label: 'Square · 1080 × 1080', width: 1080, height: 1080 }, { label: 'Portrait · 1080 × 1920', width: 1080, height: 1920 }, { label: 'HD · 1920 × 1080', width: 1920, height: 1080 }];
export function SetupWizard() {
  const current = useEditor(s => s.project);
  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState<'current' | 'character' | 'shapes' | 'blank'>('current');
  const [canvas, setCanvas] = useState(0);
  const [fps, setFps] = useState(24);
  const [name, setName] = useState('My first little animation');
  const [folder, setFolder] = useState<string | null>(null);
  const [choosingFolder, setChoosingFolder] = useState(false);
  useEffect(() => {
    let active = true;
    void window.luno?.getWorkspace().then(path => { if (active) setFolder(path); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const close = () => useEditor.getState().setDialog(null);
  const skip = () => { useEditor.getState().setPreference('onboardingComplete', true); close(); };
  const finish = () => {
    const s = useEditor.getState();
    let project = template === 'current' ? structuredClone(current) : createProject(template);
    if (template !== 'current') {
      const item = project.items.find(i => !i.locked && (i.type === 'character' || i.shape === 'ellipse'));
      if (item) project.keyframes[item.id] = createPreset(item, template === 'character' ? 'wave' : 'bounce', project.duration);
    }
    const preset = canvasPresets[canvas];
    project = adaptCanvas(project, preset.width, preset.height);
    project.name = name.trim() || 'My first little animation'; project.fps = fps;
    s.replaceProject(project); s.setPreference('onboardingComplete', true); s.setPreference('showBones', true); close();
    s.notify('Your studio is ready. Let’s make a little magic.');
  };
  const chooseFolder = async () => {
    if (!window.luno) return;
    setChoosingFolder(true);
    try { const selected = await window.luno.chooseFolder(); if (selected) setFolder(selected); }
    catch { useEditor.getState().notify('Could not choose a folder. You can still save projects normally.', 'error'); }
    finally { setChoosingFolder(false); }
  };
  return <Modal title="Set up your Luno studio" onClose={close} className="wizard-modal"><div className="wizard-sidebar"><div className="wizard-brand"><img src="./favicon.svg" alt="" /><span>luno.</span></div><span className="wizard-overline">YOUR CREATIVE SPACE</span><h3>A little less<br />complicated.</h3><div className="wizard-steps">{steps.map((label, index) => <div key={label} className={`${step === index ? 'current' : ''} ${step > index ? 'complete' : ''}`}><span>{step > index ? <Check size={12} /> : String(index + 1).padStart(2, '0')}</span><strong>{label}</strong></div>)}</div><div className="wizard-sidebar-bottom"><Heart size={16} /><span>Made for the joy<br />of making things move.</span></div><div className="wizard-orbit" /></div><div className="wizard-body">
    <div className="wizard-progress">QUICK SETUP <span>{String(step + 1).padStart(2, '0')} / 04</span></div>
    <div className="wizard-step-content">
      {step === 0 && <><span className="eyebrow">NO OVERWHELM REQUIRED</span><h1>Big ideas.<br />Little learning curve.</h1><p className="wizard-description">Meet your friendly animation studio. Draw, give your character a little personality, and bring it all to life.</p><div className="welcome-illustration"><span className="welcome-star star-one">✳</span><span className="welcome-star star-two">✦</span><svg viewBox="-220 -168 440 425"><ellipse cx="0" cy="217" rx="92" ry="10" fill="#dce4ce" /><ItemGraphic item={createCharacter()} /></svg><div className="floating-label"><Bone size={13} /> Already rigged.<span>Already yours.</span></div><div className="welcome-play"><Play size={14} fill="currentColor" /></div></div><div className="welcome-benefits"><span><Check size={13} /> No account needed</span><span><LockKeyhole size={12} /> Works offline</span><span><Sparkles size={13} /> Built for beginners</span></div></>}
      {step === 1 && <><span className="eyebrow">EVERY IDEA STARTS SOMEWHERE</span><h1>What will you<br />bring to life?</h1><p className="wizard-description">Pick a starting point. You can always add more later.</p><div className="template-choices">{[
        { id: 'current', title: 'Keep this little project', desc: 'Continue exploring the canvas behind you.', icon: Layers2 },
        { id: 'character', title: 'A character with personality', desc: 'Milo, a ready-to-pose rig and a friendly wave.', icon: Bone },
        { id: 'shapes', title: 'A little motion experiment', desc: 'Start with a bouncy ball and simple shapes.', icon: Circle },
        { id: 'blank', title: 'Something entirely your own', desc: 'A blank canvas. All the possibilities.', icon: SquarePen },
      ].map(({ id, title, desc, icon: Icon }) => <button key={id} className={`template-choice ${template === id ? 'selected' : ''}`} onClick={() => setTemplate(id as typeof template)}><span className="template-icon"><Icon size={22} /></span><div><strong>{title}</strong><span>{desc}</span></div><span className="radio-check">{template === id && <Check size={12} />}</span></button>)}</div><p className="wizard-note">Your current project stays available with Undo.</p></>}
      {step === 2 && <><span className="eyebrow">A STUDIO THAT FITS YOU</span><h1>Make a little<br />room for your idea.</h1><p className="wizard-description">Just the essentials. No complicated preferences.</p><div className="wizard-fields"><label className="form-label">Project name<input value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder="My first little animation" /></label><label className="form-label">Canvas size<select value={canvas} onChange={e => setCanvas(Number(e.target.value))}>{canvasPresets.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}</select></label><label className="form-label">Animation frame rate<select value={fps} onChange={e => setFps(Number(e.target.value))}><option value={12}>12 fps · a charming, hand-drawn feel</option><option value={24}>24 fps · classic, smooth animation</option><option value={30}>30 fps · a little extra smoothness</option><option value={60}>60 fps · super smooth motion</option></select></label>{window.luno && <div className="workspace-folder"><span>Save projects in</span><button className="button secondary" disabled={choosingFolder} onClick={chooseFolder}><FolderOpen size={15} />{choosingFolder ? 'Choosing…' : folder ? 'Change folder' : 'Choose a folder'}</button>{folder && <small>{folder}</small>}</div>}</div><div className="privacy-note"><LockKeyhole size={16} /><p><strong>Local is lovely.</strong>Your working project saves automatically on this device. Save a .luno copy to keep it forever.</p></div></>}
      {step === 3 && <><span className="eyebrow">THIS IS YOUR MOMENT</span><h1>You’ve got this.</h1><p className="wizard-description">Your studio is ready. Here’s your first little recipe for bringing something to life.</p><div className="first-moves"><div><span><MousePointer2 size={20} /></span><div><strong>01. Find a pose</strong><p>Drag a hand or a foot. The connected limb follows.</p></div></div><div><span><Bone size={20} /></span><div><strong>02. Make another moment</strong><p>Move the playhead, change the pose, press K.</p></div></div><div><span><Play size={18} /></span><div><strong>03. Let it move</strong><p>Press Space. Luno takes care of the in-between.</p></div></div></div><div className="ready-summary"><span className="green-dot" /><strong>{name.trim() || 'My first little animation'}</strong><span>{canvasPresets[canvas].width} × {canvasPresets[canvas].height} · {fps} fps</span><Check size={15} /></div><span className="ready-doodle">let’s make a little magic. <Sparkles size={18} /></span></>}
    </div>
    <div className="wizard-footer">{step === 0 ? <button className="text-button" onClick={skip}>I’ll explore on my own</button> : <button className="text-button" onClick={() => setStep(step - 1)}><ArrowLeft size={14} /> Back</button>}<button className="button primary wizard-next" onClick={() => step < 3 ? setStep(step + 1) : finish()}>{step === 0 ? 'Let’s get started' : step === 3 ? 'Start creating' : 'Looks good'}{step === 3 ? <Rocket size={15} /> : <ArrowRight size={15} />}</button></div>
  </div></Modal>;
}
