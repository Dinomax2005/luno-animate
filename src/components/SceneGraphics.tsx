import { videoFrameData } from '../engine/clips';
import { forwardKinematics } from '../engine/rig';
import { sampleCamera, sampleCel } from '../engine/animation';
import { sceneNodes, matrixString } from '../engine/geometry';
import type { Project, SceneItem, WorldBone } from '../engine/types';

const shade = (hex: string, amount: number) => {
  if (!/^#[a-f0-9]{6}$/i.test(hex)) return hex;
  return `#${[1, 3, 5].map(n => Math.max(0, Math.min(255, parseInt(hex.slice(n, n + 2), 16) + amount)).toString(16).padStart(2, '0')).join('')}`;
};

function Limb({ bone, color, width = 24 }: { bone: WorldBone; color: string; width?: number }) {
  return <g>
    <path d={`M${bone.start.x},${bone.start.y} L${bone.end.x},${bone.end.y}`} stroke={shade(color, -33)} strokeWidth={width + 2} strokeLinecap="round" />
    <path d={`M${bone.start.x},${bone.start.y} L${bone.end.x},${bone.end.y}`} stroke={color} strokeWidth={width} strokeLinecap="round" />
    <circle cx={bone.start.x} cy={bone.start.y} r={width * 0.39} fill={shade(color, 18)} />
  </g>;
}
export function Milo({ item }: { item: SceneItem }) {
  if (!item.rig || item.characterStyle === 'skeleton') return null;
  const world = forwardKinematics(item.rig);
  const b = Object.fromEntries(world.map(bone => [bone.id, bone]));
  const color = item.fill;
  const head = b.head;
  const spine = b.spine;
  if (!head || !spine) return null;
  return <g className="milo-art">
    <defs>
      <linearGradient id={`body-${item.id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={shade(color, 14)} /><stop offset="1" stopColor={shade(color, -13)} /></linearGradient>
      <linearGradient id={`head-${item.id}`} x1="0" y1="0" x2="0.7" y2="1"><stop stopColor={shade(color, 18)} /><stop offset="1" stopColor={color} /></linearGradient>
    </defs>
    {['leftLeg', 'rightLeg'].map(id => b[id] && <Limb key={id} bone={b[id]} color={shade(color, -10)} width={31} />)}
    {['leftFoot', 'rightFoot'].map(id => b[id] && <g key={id}>
      <Limb bone={b[id]} color={color} width={28} />
      <g transform={`translate(${b[id].end.x} ${b[id].end.y}) rotate(${b[id].worldAngle - 90})`}>
        <rect x="-20" y="-6" width="46" height="24" rx="12" fill="#496853" />
        <rect x="-20" y="-6" width="36" height="13" rx="6.5" fill="#77947b" />
        <path d="M-15 15H22" stroke="#314b38" strokeWidth="4" strokeLinecap="round" />
      </g>
    </g>)}
    {['leftArm', 'rightArm'].map(id => b[id] && <Limb key={id} bone={b[id]} color={color} width={25} />)}
    {['leftHand', 'rightHand'].map(id => b[id] && <g key={id}>
      <Limb bone={b[id]} color={shade(color, 6)} width={23} />
      <g transform={`translate(${b[id].end.x} ${b[id].end.y}) rotate(${b[id].worldAngle})`}>
        <rect x="-4" y="-13" width="26" height="26" rx="11" fill="#e6d68e" stroke="#cbbb78" strokeWidth="1.4" />
        <path d="M10 -5h10M10 1h10M10 7h8" stroke="#c5b678" strokeWidth="1.3" strokeLinecap="round" />
      </g>
    </g>)}
    <g transform={`translate(${spine.end.x} ${spine.end.y}) rotate(${spine.worldAngle + 90}) scale(1 ${Math.max(0.01, spine.length / 82)})`}>
      <path d="M-28 -8Q-47 -8 -48 13L-43 64Q-42 83 -24 86H24Q42 83 43 64L48 13Q47 -8 28 -8Z" fill={`url(#body-${item.id})`} stroke={shade(color, -30)} strokeWidth="1.5" />
      <path d="M-42 57Q0 70 42 57L40 72Q0 84 -40 72Z" fill={shade(color, -33)} opacity="0.5" />
      <rect x="-27" y="8" width="54" height="36" rx="15" fill="#f4eddc" />
      <path d="M8 14a12 12 0 1 0 2 23 11 11 0 0 1-2-23Z" fill="#496853" />
      <circle cx="14" cy="19" r="2.4" fill="#496853" />
      <circle cx="-21" cy="61" r="3.5" fill="#e6d68e" /><circle cx="21" cy="61" r="3.5" fill="#e6d68e" />
    </g>
    <g transform={`translate(${head.end.x} ${head.end.y}) rotate(${head.worldAngle + 90})`}>
      <path d="M0 -54V-67" stroke="#758b6c" strokeWidth="5" strokeLinecap="round" />
      <circle cx="0" cy="-70" r="6" fill="#dfca7d" />
      <rect x="-68" y="-15" width="20" height="40" rx="9" fill="#ddcd8a" stroke="#c2b477" strokeWidth="1.5" />
      <rect x="48" y="-15" width="20" height="40" rx="9" fill="#ddcd8a" stroke="#c2b477" strokeWidth="1.5" />
      <rect x="-57" y="-49" width="114" height="107" rx="36" fill={`url(#head-${item.id})`} stroke={shade(color, -23)} strokeWidth="1.5" />
      <path d="M-34 -38Q0 -48 34 -38" fill="none" stroke={shade(color, 33)} strokeWidth="5" strokeLinecap="round" opacity="0.65" />
      <rect x="-42" y="-21" width="84" height="59" rx="23" fill="#2d4338" />
      <rect x="-25" y="-6" width="11" height="17" rx="5.5" fill="#d9f3a3" />
      <rect x="14" y="-6" width="11" height="17" rx="5.5" fill="#d9f3a3" />
      <path d="M-10 21Q0 28 10 21" fill="none" stroke="#d9f3a3" strokeWidth="3" strokeLinecap="round" />
      <circle cx="-36" cy="44" r="3" fill={shade(color, -12)} /><circle cx="36" cy="44" r="3" fill={shade(color, -12)} />
    </g>
    {world.filter(bone => !['root', 'spine', 'head', 'leftShoulder', 'rightShoulder', 'leftHip', 'rightHip', 'leftArm', 'rightArm', 'leftHand', 'rightHand', 'leftLeg', 'rightLeg', 'leftFoot', 'rightFoot'].includes(bone.id)).map(bone => <Limb key={bone.id} bone={bone} color={color} width={18} />)}
  </g>;
}

export function ItemGraphic({ item, frame = 0, project }: { item: SceneItem; frame?: number; project?: Project }) {
  const common = { fill: item.fill, stroke: item.stroke, strokeWidth: item.strokeWidth };
  const w = item.width, h = item.height;
  if (item.type === 'group') return null;
  if (item.type === 'text') return <text fontFamily="Arial, Helvetica, sans-serif" fontSize={item.fontSize ?? 56} fontWeight={item.fontWeight ?? 600} textAnchor={item.textAlign ?? 'middle'} dominantBaseline="central" {...common}>{(item.text ?? '').split('\n').map((line, n, all) => <tspan key={n} x={item.textAlign === 'start' ? -w / 2 : item.textAlign === 'end' ? w / 2 : 0} dy={n ? (item.fontSize ?? 56) * 1.2 : -(all.length - 1) * (item.fontSize ?? 56) * 0.6}>{line || '\u00a0'}</tspan>)}</text>;
  if (item.type === 'drawing') return <g>{sampleCel(item, frame)?.strokes.map((stroke, n) => <path key={n} d={stroke.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}</g>;
  if (item.type === 'character') return <Milo item={item} />;
  if (item.type === 'video') { const data = project && videoFrameData(project, item, frame); return data ? <image href={data} x={-w / 2} y={-h / 2} width={w} height={h} /> : null; }
  if (item.type === 'image') return <image href={item.imageData} x={-w / 2} y={-h / 2} width={w} height={h} />;
  if (item.type === 'path') return <path d={item.points?.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} fill="none" stroke={item.stroke === 'none' ? item.fill : item.stroke} strokeWidth={item.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
  if (item.shape === 'ellipse' || item.shape === 'ground') return <ellipse cx="0" cy="0" rx={w / 2} ry={h / 2} {...common} />;
  if (item.shape === 'star') {
    const points = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5; const radius = i % 2 ? 0.22 : 0.5; return `${Math.cos(a) * w * radius},${Math.sin(a) * h * radius}`; }).join(' ');
    return <polygon points={points} {...common} strokeLinejoin="round" />;
  }
  if (item.shape === 'sparkle') return <path d={`M0 ${-h / 2} Q${w * 0.1} ${-h * 0.1} ${w / 2} 0 Q${w * 0.1} ${h * 0.1} 0 ${h / 2} Q${-w * 0.1} ${h * 0.1} ${-w / 2} 0 Q${-w * 0.1} ${-h * 0.1} 0 ${-h / 2}Z`} {...common} />;
  return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={Math.min(w, h) * 0.12} {...common} />;
}

export function ItemEffects({ item }: { item: SceneItem }) {
  if (!(item.blur || item.brightness !== undefined && item.brightness !== 1 || item.saturation !== undefined && item.saturation !== 1)) return null;
  return <defs><filter id={`fx-${item.id}`} x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
    <feGaussianBlur stdDeviation={item.blur ?? 0} />
    <feColorMatrix type="saturate" values={String(item.saturation ?? 1)} />
    <feComponentTransfer>{(['R', 'G', 'B'] as const).map(c => c === 'R' ? <feFuncR key={c} type="linear" slope={item.brightness ?? 1} /> : c === 'G' ? <feFuncG key={c} type="linear" slope={item.brightness ?? 1} /> : <feFuncB key={c} type="linear" slope={item.brightness ?? 1} />)}</feComponentTransfer>
  </filter></defs>;
}
export function effectFilter(item: SceneItem) { return item.blur || item.brightness !== undefined && item.brightness !== 1 || item.saturation !== undefined && item.saturation !== 1 ? `url(#fx-${item.id})` : undefined; }
export const itemTransform = (item: SceneItem) => `translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.scaleX} ${item.scaleY})`;
export function cameraTransform(project: Project, frame: number) {
  const camera = sampleCamera(project.camera, frame);
  return `translate(${project.width / 2} ${project.height / 2}) scale(${camera.zoom}) rotate(${-camera.rotation}) translate(${-camera.x} ${-camera.y})`;
}
export function SceneArtwork({ project, frame, transparent = false }: { project: Project; frame: number; transparent?: boolean }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={project.width} height={project.height} viewBox={`0 0 ${project.width} ${project.height}`}>
    {!transparent && <rect width={project.width} height={project.height} fill={project.background} />}
    <g transform={cameraTransform(project, frame)}>{sceneNodes(project, frame).filter(n => n.visible).map(n => <g key={n.item.id} transform={matrixString(n.matrix)} opacity={n.opacity} style={n.item.blendMode && n.item.blendMode !== 'normal' ? { mixBlendMode: n.item.blendMode } : undefined}><ItemEffects item={n.item} /><g filter={effectFilter(n.item)}><ItemGraphic item={n.item} frame={frame} project={project} /></g></g>)}</g>
  </svg>;
}
