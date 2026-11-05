import { useCallback, useEffect, useRef, useState } from "react";
import { useMountStatus } from "./hooks/useMountStatus.js";
import { useMountInfo } from "./hooks/useMountInfo.js";
import { useCatalog } from "./hooks/useCatalog.js";
import { apiPost } from "./lib/api.js";
import { effectiveLatitude } from "./lib/safety.js";
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
  const mountInfo = useMountInfo(status?.connected ?? false);
  const { stars, messier, constellationLines } = useCatalog();
  const [commandError, setCommandError] = useState(null);
  // Name of the command currently in flight (e.g. "slew"), or null.
  const [pending, setPending] = useState(null);
  const pendingRef = useRef(null);

  const latitude = effectiveLatitude(mountInfo);

  /**
   * Run a mount command. Only one command runs at a time; further calls are
   * ignored until it finishes — except "abort", which always goes through.
   * Resolves true on success, false on failure (error shown as a toast).
   */
  const runCommand = useCallback(async (name, path, body) => {
    const isAbort = name === "abort";
    if (pendingRef.current && !isAbort) return false;
    if (!isAbort) {
      pendingRef.current = name;
      setPending(name);
    }
    try {
      await apiPost(path, body);
      setCommandError(null);
      return true;
    } catch (err) {
      setCommandError(err.message);
      return false;
    } finally {
      if (!isAbort) {
        pendingRef.current = null;
        setPending(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!commandError) return;
    const id = setTimeout(() => setCommandError(null), COMMAND_ERROR_MS);
    return () => clearTimeout(id);
  }, [commandError]);

  return (
    <div className="app">
      <StatusPanel
        status={status}
        mountInfo={mountInfo}
        pending={pending}
        runCommand={runCommand}
      />
      <CelestialChart
        status={status}
        latitude={latitude}
        stars={stars}
        messier={messier}
        constellationLines={constellationLines}
      />
      <CommandPanel
        status={status}
        mountInfo={mountInfo}
        latitude={latitude}
        pending={pending}
        runCommand={runCommand}
        stars={stars}
        messier={messier}
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
