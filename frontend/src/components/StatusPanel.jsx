import { formatRA, formatDec, formatDeg, formatHMS } from "../lib/format.js";

const PIER = ["East", "West"];

export default function StatusPanel({ status, onConnect, onDisconnect }) {
  const connected = status?.connected ?? false;

  async function handleConnect() {
    await fetch("/api/connect", { method: "POST" });
    onConnect?.();
  }

  async function handleDisconnect() {
    await fetch("/api/disconnect", { method: "POST" });
    onDisconnect?.();
  }

  return (
    <div className="panel">
      <div className="panel-title">Mount Status</div>

      {/* Connection */}
      <div className="section">
        <div className="section-label">Connection</div>
        <div style={{ marginBottom: 10 }}>
          <span className={`badge ${connected ? "connected" : "disconnected"}`}>
            <span className="badge-dot" />
            {connected ? "Connected" : "Disconnected"}
          </span>
          {connected && status?.name && (
            <div style={{ marginTop: 6, color: "var(--text-dim)", fontSize: 11 }}>
              {status.name}
            </div>
          )}
        </div>
        <div className="btn-row">
          <button className="btn-primary" onClick={handleConnect} disabled={connected}>
            Connect
          </button>
          <button className="btn-secondary" onClick={handleDisconnect} disabled={!connected}>
            Disconnect
          </button>
        </div>
      </div>

      {/* Equatorial coords */}
      <div className="section">
        <div className="section-label">Equatorial</div>
        <div className="readout">
          <span className="readout-label">RA</span>
          <span className="readout-value">{formatRA(status?.right_ascension)}</span>
        </div>
        <div className="readout">
          <span className="readout-label">Dec</span>
          <span className="readout-value">{formatDec(status?.declination)}</span>
        </div>
        <div className="readout">
          <span className="readout-label">LST</span>
          <span className="readout-value white">{formatHMS(status?.sidereal_time)}</span>
        </div>
      </div>

      {/* Horizontal coords */}
      <div className="section">
        <div className="section-label">Horizontal</div>
        <div className="readout">
          <span className="readout-label">Alt</span>
          <span className="readout-value">{formatDeg(status?.altitude)}</span>
        </div>
        <div className="readout">
          <span className="readout-label">Az</span>
          <span className="readout-value">{formatDeg(status?.azimuth)}</span>
        </div>
      </div>

      {/* State */}
      <div className="section">
        <div className="section-label">State</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className={`badge ${status?.tracking ? "tracking-on" : "tracking-off"}`}>
            <span className="badge-dot" />
            {status?.tracking ? "Tracking" : "Not Tracking"}
          </span>
          {status?.slewing && (
            <span className="badge slewing">
              <span className="badge-dot" />
              Slewing…
            </span>
          )}
          {status?.at_park && (
            <span className="badge" style={{ background: "#1a0f00", color: "#a16207" }}>
              <span className="badge-dot" style={{ background: "#a16207" }} />
              Parked
            </span>
          )}
          {status?.at_home && (
            <span className="badge" style={{ background: "#0f1a1a", color: "var(--cyan)" }}>
              <span className="badge-dot" style={{ background: "var(--cyan)" }} />
              At Home
            </span>
          )}
        </div>
        {status?.side_of_pier != null && (
          <div className="readout" style={{ marginTop: 8 }}>
            <span className="readout-label">Pier side</span>
            <span className="readout-value dim">{PIER[status.side_of_pier] ?? "Unknown"}</span>
          </div>
        )}
      </div>

      {/* Target (shown when slewing) */}
      {status?.slewing && (status?.target_ra != null || status?.target_dec != null) && (
        <div className="section">
          <div className="section-label">Target</div>
          <div className="readout">
            <span className="readout-label">RA</span>
            <span className="readout-value cyan">{formatRA(status.target_ra)}</span>
          </div>
          <div className="readout">
            <span className="readout-label">Dec</span>
            <span className="readout-value cyan">{formatDec(status.target_dec)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
