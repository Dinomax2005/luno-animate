import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { useStudio } from "../state/studio";
export function UpdateNotice() {
  const [state, setState] = useState<{
      phase: string;
      message: string;
      percent: number;
      version: string | null;
    } | null>(null),
    [hidden, setHidden] = useState(false);
  useEffect(() => {
    const api = window.studio?.updates;
    if (!api) return;
    void api.state().then(setState);
    return api.listen(setState);
  }, []);
  useEffect(() => {
    if (state?.phase === "warning") setHidden(false);
  }, [state?.phase]);
  if (
    hidden ||
    !state ||
    !["available", "downloading", "ready", "warning", "preparing"].includes(
      state.phase,
    )
  )
    return null;
  return (
    <div className="update-notice" role="status">
      <div>
        <Download size={16} />
        <strong>Studio {state.version ?? "update"}</strong>
      </div>
      <p>{state.message}</p>
      {state.phase === "downloading" && (
        <progress max={100} value={state.percent} />
      )}
      <div>
        <button onClick={() => useStudio.setState({ dialog: "updates" })}>
          <RefreshCw size={11} />
          Details
        </button>
        <button
          onClick={() => {
            void window.studio?.updates.defer();
            setHidden(true);
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
