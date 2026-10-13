import { useEffect, useRef, useState } from 'react';

type Kind = 'arrow' | 'text' | 'ew' | 'ns' | 'hidden';

const TEXT = 'input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]):not([type=button]):not([type=submit]), textarea, [contenteditable="true"], .legal-text, .command-input input';

const kindFor = (target: EventTarget | null): Kind => {
  if (!(target instanceof Element)) return 'arrow';
  // The canvas paints its own tool pointer; its layer stays in charge there.
  if (target.closest('.canvas-well')) return 'hidden';
  if (target.closest('.resizer.left, .resizer.right, .resizer[role="separator"][aria-orientation="vertical"]')) return 'ew';
  if (target.closest('.resizer.bottom, .resizer[role="separator"][aria-orientation="horizontal"]')) return 'ns';
  if (target.closest('.timeline-ruler, .clip-trim, input[type=range], .timeline-scroll .cel')) return 'ew';
  if (target.closest(TEXT)) return 'text';
  return 'arrow';
};

/** Replaces the system cursor across the application with one drawn pointer, so the
 * pointer stays visible and consistent everywhere, including stylus and streamed
 * sessions. The canvas keeps its own tool pointer. */
export function AppCursor() {
  const [kind, setKind] = useState<Kind>('arrow');
  const node = useRef<HTMLDivElement>(null);
  const state = useRef<Kind>('arrow');
  const point = useRef({ x: -100, y: -100 });
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      document.documentElement.dataset.cursor = 'drawn';
      point.current = { x: event.clientX, y: event.clientY };
      const el = node.current;
      if (el) el.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
      const next = kindFor(event.target);
      if (next !== state.current) {
        state.current = next;
        setKind(next);
      }
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      if (event.relatedTarget === null) {
        state.current = 'hidden';
        setKind('hidden');
      }
    };
    const enter = () => { if (state.current === 'hidden') { state.current = 'arrow'; setKind('arrow'); } };
    window.addEventListener('pointermove', move, { capture: true, passive: true });
    window.addEventListener('pointerdown', move, { capture: true, passive: true });
    window.addEventListener('pointerout', leave, { capture: true, passive: true });
    window.addEventListener('pointerover', enter, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointermove', move, { capture: true } as EventListenerOptions);
      window.removeEventListener('pointerdown', move, { capture: true } as EventListenerOptions);
      window.removeEventListener('pointerout', leave, { capture: true } as EventListenerOptions);
      window.removeEventListener('pointerover', enter, { capture: true } as EventListenerOptions);
    };
  }, []);
  return (
    <div
      className="app-cursor"
      data-kind={kind}
      aria-hidden="true"
      ref={node}
      style={{
        transform: `translate3d(${point.current.x}px,${point.current.y}px,0)`,
        display: kind === 'hidden' ? 'none' : undefined,
      }}
    >
      {kind === 'arrow' && (
        <svg viewBox="0 0 12 18" className="cur cur-arrow"><path d="M1 1v14.4l3.6-3.5 2.3 5.1 1.9-.9-2.3-5h4.8z" /></svg>
      )}
      {kind === 'text' && (
        <svg viewBox="0 0 12 18" className="cur cur-text"><path d="M1 1.5h10v2H7.6v11h3.4v2H1v-2h3.4v-11H1z" /></svg>
      )}
      {kind === 'ew' && (
        <svg viewBox="0 0 20 12" className="cur cur-ew"><path d="M6 1 1 6l5 5V8h8v3l5-5-5-5v3H6z" /></svg>
      )}
      {kind === 'ns' && (
        <svg viewBox="0 0 12 20" className="cur cur-ns"><path d="M1 6 6 1l5 5H8v8h3l-5 5-5-5h3V6z" /></svg>
      )}
    </div>
  );
}
