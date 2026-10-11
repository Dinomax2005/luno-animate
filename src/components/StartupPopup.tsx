import { APP_VERSION } from '../config/version';
/** Browser fallback only. The installed app uses a separate small native window. */
export function StartupPopup({ phase, error, onRetry }: { phase: string; error: string | null; onRetry: () => void }) {
  return <div className={`startup-popup ${error ? 'error' : ''}`} data-testid="startup-popup" role={error ? 'alert' : 'status'} aria-live="polite">
    <div className="startup-popup-header"><strong>LUNO ANIMATE</strong><span>{APP_VERSION}</span><span className="startup-popup-window-dots" aria-hidden="true">•••</span></div>
    <div className="startup-popup-body"><img src="./favicon.svg" width="68" height="68" alt="Luno blue eclipse" /><div><span className="startup-popup-overline">ANIMATION & VIDEO STUDIO</span><h1>{error ? 'Your workspace needs attention' : 'Starting up Luno Animations'}</h1><p>{error ?? phase}</p></div></div>
    {!error && <div className="startup-popup-progress" aria-label="Opening workspace"><span /></div>}
    <footer><span>Your work stays on this device.</span>{error && <button className="button secondary" onClick={onRetry}>Retry startup</button>}</footer>
  </div>;
}
