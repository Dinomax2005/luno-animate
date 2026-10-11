import { APP_VERSION } from '../config/version';
export function StartupScreen({ phase, error, onRetry }: { phase: string; error: string | null; onRetry: () => void }) {
  return <div className="startup-screen" data-testid="startup-screen" role={error ? 'alert' : 'status'} aria-live="polite"><div className="startup-identity"><img src="./favicon.svg" width="128" height="128" alt="Luno red solar eclipse" /><span className="startup-overline">LUNO ANIMATE <span>{APP_VERSION}</span></span><h1>{error ? 'Your workspace needs attention' : 'Starting up Luno Animations'}</h1><p>{error ?? phase}</p>{error ? <button onClick={onRetry}>Retry startup</button> : <div className="startup-progress" aria-label="Loading workspace"><span /></div>}<small>LOCAL-FIRST · ANIMATION & VIDEO</small></div></div>;
}
