import { formatRA, formatDec, formatDeg, formatHMS } from "../lib/format.js";
import { connectionState } from "../lib/connection.js";
import { DEFAULT_LATITUDE } from "../lib/safety.js";

const PIER = ["East", "West"];

const BADGE_CLASS = {
  connected: "connected",
  disconnected: "disconnected",
  unreachable: "unreachable",
  unknown: "disconnected",
};

export default function StatusPanel({ status, mountInfo, pending, runCommand }) {
  const conn = connectionState(status);
  const connected = conn.state === "connected";
  const unreachable = conn.state === "unreachable";
  const busy = pending != null;

  const handleConnect = () => runCommand("connect", "/api/connect");
  const handleDisconnect = () => runCommand("disconnect", "/api/disconnect");

  const siteLat = mountInfo?.site_latitude;
  const siteLon = mountInfo?.site_longitude;

  return (
    <div className="panel">
      <div className="panel-title">Mount Status</div>

      {/* Connection */}
      <div className="section">
        <div className="section-label">Connection</div>
        <div style={{ marginBottom: 10 }}>
          <span className={`badge ${BADGE_CLASS[conn.state]}`} title={conn.detail ?? undefined}>
            <span className="badge-dot" />
            {conn.label}
          </span>
          {connected && status?.name && (
            <div style={{ marginTop: 6, color: "var(--text-dim)", fontSize: 11 }}>
              {status.name}
            </div>
          )}
          {!connected && conn.detail && (
            <div className="conn-detail" style={{ marginTop: 6, color: "var(--text-dim)", fontSize: 11 }}>
              {conn.detail}
            </div>
          )}
        </div>
        <div className="btn-row">
          <button
            className="btn-primary"
            onClick={handleConnect}
            disabled={connected || unreachable || busy}
            title={unreachable ? "Alpaca device is not reachable — check it is running" : undefined}
          >
            {pending === "connect" ? "Connecting…" : "Connect"}
          </button>
          <button
            className="btn-secondary"
            onClick={handleDisconnect}
            disabled={!connected || busy}
          >
            {pending === "disconnect" ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      </div>

      {/* Site */}
      <div className="section">
        <div className="section-label">Site</div>
        <div className="readout">
          <span className="readout-label">Lat</span>
          <span className="readout-value dim">
            {typeof siteLat === "number" ? formatDeg(siteLat, 2) : `${formatDeg(DEFAULT_LATITUDE, 2)} (default)`}
          </span>
        </div>
        {typeof siteLon === "number" && (
          <div className="readout">
            <span className="readout-label">Lon</span>
            <span className="readout-value dim">{formatDeg(siteLon, 2)}</span>
          </div>
        )}
        {mountInfo && (
          <div className="readout">
            <span className="readout-label">Min alt</span>
            <span className="readout-value dim">
              {mountInfo.min_slew_altitude != null ? formatDeg(mountInfo.min_slew_altitude, 0) : "off"}
            </span>
          </div>
        )}
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
