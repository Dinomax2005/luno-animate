import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null),
    request = useRef(close);
  request.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const current = box.current;
    current
      ?.querySelector<HTMLElement>("input,button,select,textarea")
      ?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        request.current();
      }
      if (e.key === "Tab") {
        const items = [
          ...(current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
          ) ?? []),
        ].filter((v) => v.offsetParent !== null);
        if (!items.length) return;
        const at = items.indexOf(document.activeElement as HTMLElement),
          next = e.shiftKey
            ? at <= 0
              ? items.length - 1
              : at - 1
            : (at + 1) % items.length;
        e.preventDefault();
        items[next]?.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("keydown", keys);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={box}
      >
        <div className="modal-head">
          <span>{title}</span>
          <button aria-label={`Close ${title}`} onClick={close}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = -100000,
  max = 100000,
  step = 1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const [text, setText] = useState(String(Math.round(value * 100) / 100));
  useEffect(() => setText(String(Math.round(value * 100) / 100)), [value]);
  const apply = () => {
    const n = Number(text);
    if (Number.isFinite(n) && n >= min && n <= max) {
      if (n !== value) onChange(n);
    } else setText(String(value));
  };
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          aria-label={label}
          value={text}
          step={step}
          min={min}
          max={max}
          onChange={(e) => setText(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setText(String(value));
              e.currentTarget.blur();
            }
          }}
        />
        {unit && <small>{unit}</small>}
      </div>
    </label>
  );
}
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="property-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
