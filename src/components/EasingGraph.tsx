import { useRef, useState, type PointerEvent } from 'react';
import { ease } from '../engine/animation';
import { useEditor } from '../store/editor';
import type { Easing } from '../engine/types';
type Curve = [number, number, number, number];
export function EasingGraph({ easing, bezier, disabled }: { easing: Easing; bezier: Curve; disabled: boolean }) {
  const [preview, setPreview] = useState<Curve | null>(null), drag = useRef<{ index: number; curve: Curve } | null>(null);
  const curve = preview ?? bezier;
  const x = (v: number) => 15 + v * 190, y = (v: number) => 95 - v * 85;
  const path = Array.from({ length: 101 }, (_, n) => `${n ? 'L' : 'M'}${x(n / 100)} ${y(ease(n / 100, easing, curve))}`).join(' ');
  const finish = (event: PointerEvent<SVGCircleElement>, commit: boolean) => { if (commit && drag.current) useEditor.getState().setBezier(drag.current.curve); drag.current = null; setPreview(null); useEditor.getState().setInteracting(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  return <div className="easing-graph"><svg viewBox="0 -20 220 145" aria-label="Easing curve"><path d="M15 10V95H205" fill="none" stroke="var(--line-strong)" /><path d="M15 55H205M110 10V95" stroke="var(--line)" strokeDasharray="3 3" />
    {easing === 'bezier' && <path d={`M15 95L${x(curve[0])} ${y(curve[1])}M205 10L${x(curve[2])} ${y(curve[3])}`} fill="none" stroke="var(--muted)" strokeDasharray="3 3" />}
    <path d={path} stroke="var(--accent)" strokeWidth="2.5" fill="none" /><circle cx="15" cy="95" r="3" fill="var(--text)" /><circle cx="205" cy="10" r="3" fill="var(--text)" />
    {easing === 'bezier' && [0, 2].map(index => <circle key={index} cx={x(curve[index])} cy={y(curve[index + 1])} r="6" fill="var(--panel)" stroke="var(--accent)" strokeWidth="2" role="slider" aria-label={`Bézier control ${index / 2 + 1}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(curve[index] * 100)} aria-disabled={disabled} tabIndex={disabled ? -1 : 0} className="bezier-handle" onKeyDown={e => { if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); e.stopPropagation(); const next = [...curve] as Curve, axis = index + (e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 1 : 0); next[axis] = Math.max(axis % 2 ? -3 : 0, Math.min(axis % 2 ? 3 : 1, next[axis] + (['ArrowUp', 'ArrowRight'].includes(e.key) ? 0.05 : -0.05))); useEditor.getState().setBezier(next); }} onPointerDown={e => { if (disabled) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); useEditor.getState().setInteracting(true); drag.current = { index, curve: [...curve] }; }} onPointerMove={e => { if (!drag.current) return; const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect(), next = [...drag.current.curve] as Curve; next[index] = Math.max(0, Math.min(1, ((e.clientX - r.left) / r.width * 220 - 15) / 190)); next[index + 1] = Math.max(-3, Math.min(3, (95 - (-20 + (e.clientY - r.top) / r.height * 145)) / 85)); drag.current.curve = next; setPreview(next); }} onPointerUp={e => finish(e, true)} onPointerCancel={e => finish(e, false)} onLostPointerCapture={e => { if (drag.current) finish(e, false); }} />)}
  </svg></div>;
}
