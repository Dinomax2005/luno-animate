import { useEffect, useState } from 'react';
import { clamp } from '../engine/rig';
export function NumberField({ label, value, onChange, unit, min = -100000, max = 100000, disabled = false, step = 1 }: { label: string; value: number; onChange: (value: number) => void; unit?: string; min?: number; max?: number; disabled?: boolean; step?: number }) {
  const [text, setText] = useState(String(Math.round(value * 100) / 100));
  useEffect(() => setText(String(Math.round(value * 100) / 100)), [value]);
  const commit = () => { const parsed = Number(text); if (text.trim() && Number.isFinite(parsed)) { const next = clamp(parsed, min, max); if (next !== value) onChange(next); setText(String(Math.round(next * 100) / 100)); } else setText(String(Math.round(value * 100) / 100)); };
  return <label className={`number-field ${disabled ? 'disabled' : ''}`}><span>{label}</span><input aria-label={label} type="number" step={step} min={min} max={max} value={text} disabled={disabled} onChange={e => setText(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />{unit && <span className="field-unit">{unit}</span>}</label>;
}
