import { useCallback } from "react";
import { useMountStatus } from "./hooks/useMountStatus.js";
import { useCatalog } from "./hooks/useCatalog.js";
import StatusPanel from "./components/StatusPanel.jsx";
import CelestialChart from "./components/CelestialChart.jsx";
import CommandPanel from "./components/CommandPanel.jsx";

export default function App() {
  const { status, error } = useMountStatus(1000);
  const { stars, messier, constellationLines } = useCatalog();

  const handleAction = useCallback(() => {
    // Status will refresh on the next poll tick — no extra fetch needed.
  }, []);

  function handleChartClick({ ra, dec }) {
    // Could auto-fill command panel inputs in future
    void ra; void dec;
  }

  return (
    <div className="app">
      <StatusPanel
        status={status}
        onConnect={handleAction}
        onDisconnect={handleAction}
      />
      <CelestialChart
        status={status}
        stars={stars}
        messier={messier}
        constellationLines={constellationLines}
        onClickCoords={handleChartClick}
      />
      <CommandPanel
        status={status}
        stars={stars}
        messier={messier}
        onAction={handleAction}
      />
      {error && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(239,68,68,0.15)",
            border: "1px solid var(--red)",
            borderRadius: 6,
            padding: "6px 16px",
            fontSize: 12,
            color: "var(--red)",
            zIndex: 100,
          }}
        >
          API error: {error}
        </div>
      )}
    </div>
  );
}
