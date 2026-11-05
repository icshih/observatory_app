import { useCallback, useEffect, useState } from "react";
import { useMountStatus } from "./hooks/useMountStatus.js";
import { useCatalog } from "./hooks/useCatalog.js";
import StatusPanel from "./components/StatusPanel.jsx";
import CelestialChart from "./components/CelestialChart.jsx";
import CommandPanel from "./components/CommandPanel.jsx";

const toastStyle = {
  position: "fixed",
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(239,68,68,0.15)",
  border: "1px solid var(--red)",
  borderRadius: 6,
  padding: "6px 16px",
  fontSize: 12,
  color: "var(--red)",
  zIndex: 100,
};

const COMMAND_ERROR_MS = 8000;

export default function App() {
  const { status, error } = useMountStatus(1000);
  const { stars, messier, constellationLines } = useCatalog();
  const [commandError, setCommandError] = useState(null);

  // Command panels call this after every command: null on success,
  // an error message on failure. Status refreshes on the next poll tick.
  const handleAction = useCallback((err) => {
    setCommandError(err ?? null);
  }, []);

  useEffect(() => {
    if (!commandError) return;
    const id = setTimeout(() => setCommandError(null), COMMAND_ERROR_MS);
    return () => clearTimeout(id);
  }, [commandError]);

  return (
    <div className="app">
      <StatusPanel status={status} onAction={handleAction} />
      <CelestialChart
        status={status}
        stars={stars}
        messier={messier}
        constellationLines={constellationLines}
      />
      <CommandPanel
        status={status}
        stars={stars}
        messier={messier}
        onAction={handleAction}
      />
      {commandError && (
        <div
          role="alert"
          style={{ ...toastStyle, bottom: error ? 52 : 16, cursor: "pointer" }}
          onClick={() => setCommandError(null)}
          title="Click to dismiss"
        >
          Command failed: {commandError}
        </div>
      )}
      {error && (
        <div role="alert" style={{ ...toastStyle, bottom: 16 }}>
          API error: {error}
        </div>
      )}
    </div>
  );
}
