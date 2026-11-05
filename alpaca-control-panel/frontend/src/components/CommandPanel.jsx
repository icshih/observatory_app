import { useState } from "react";
import { parseRA, parseDec, formatRA, formatDec } from "../lib/format.js";
import { checkSlewTarget, supports, NOT_SUPPORTED } from "../lib/safety.js";
import ObjectPicker from "./ObjectPicker.jsx";

export default function CommandPanel({
  status, mountInfo, latitude, pending, runCommand, stars, messier,
}) {
  const [raInput, setRaInput] = useState("");
  const [decInput, setDecInput] = useState("");
  const [slewError, setSlewError] = useState("");

  const connected = status?.connected ?? false;
  const busy = pending != null;
  const minAltitude = mountInfo?.min_slew_altitude ?? null;

  const canSlew = supports(mountInfo, "can_slew_async");
  const canPark = supports(mountInfo, "can_park");
  const canUnpark = supports(mountInfo, "can_unpark");
  const canSetTracking = supports(mountInfo, "can_set_tracking");

  function evaluate(ra, dec) {
    return checkSlewTarget({ ra, dec, lat: latitude, lst: status?.sidereal_time, minAltitude });
  }

  // Live altitude preview for whatever is in the form (null if unparseable).
  const formRA = parseRA(raInput);
  const formDec = parseDec(decInput);
  const formValid = formRA != null && formRA >= 0 && formRA < 24 && formDec != null && Math.abs(formDec) <= 90;
  const preview = formValid && connected ? evaluate(formRA, formDec) : null;

  async function slewTo(ra, dec) {
    const check = evaluate(ra, dec);
    if (!check.ok) {
      setSlewError(check.reason);
      return;
    }
    setSlewError("");
    await runCommand("slew", "/api/slew", { right_ascension: ra, declination: dec });
  }

  async function handleSlew() {
    if (formRA == null || formRA < 0 || formRA >= 24) {
      setSlewError("Invalid RA (0–24 h)");
      return;
    }
    if (formDec == null || formDec < -90 || formDec > 90) {
      setSlewError("Invalid Dec (±90°)");
      return;
    }
    await slewTo(formRA, formDec);
  }

  const handleAbort = () => runCommand("abort", "/api/abort");
  const handleTracking = (e) =>
    runCommand("tracking", "/api/tracking", { enabled: e.target.checked });
  const handlePark = () => runCommand("park", "/api/park");
  const handleUnpark = () => runCommand("unpark", "/api/unpark");

  function fillFromObject(obj) {
    setRaInput(formatRA(obj.ra));
    setDecInput(formatDec(obj.dec));
    setSlewError("");
  }

  async function slewToObject(obj) {
    fillFromObject(obj);
    if (!connected || busy || status?.at_park || !canSlew) return;
    await slewTo(obj.ra, obj.dec);
  }

  const slewDisabled = !connected || busy || status?.at_park || !canSlew || (preview && !preview.ok);

  return (
    <div className="panel">
      <div className="panel-title">Commands</div>

      {/* Abort — deliberately never blocked by a pending command. */}
      <div className="section">
        <button
          className="btn-danger"
          onClick={handleAbort}
          disabled={!connected}
          title="Stop any mount motion"
        >
          ⬛ Abort Slew
        </button>
      </div>

      {/* Manual slew */}
      <div className="section">
        <div className="section-label">Slew To Coordinates</div>
        <div className="input-group">
          <label>RA (h or HH MM SS)</label>
          <input
            type="text"
            placeholder="e.g. 5.9 or 05 54 00"
            value={raInput}
            onChange={(e) => { setRaInput(e.target.value); setSlewError(""); }}
          />
        </div>
        <div className="input-group">
          <label>Dec (° or DD MM SS)</label>
          <input
            type="text"
            placeholder="e.g. -16.7 or -16 42 00"
            value={decInput}
            onChange={(e) => { setDecInput(e.target.value); setSlewError(""); }}
          />
        </div>
        {preview?.altitude != null && (
          <div
            className="target-alt"
            style={{ color: preview.ok ? "var(--text-dim)" : "var(--red)", fontSize: 11, marginBottom: 8 }}
          >
            Target altitude: {preview.altitude.toFixed(1)}°
            {minAltitude != null && ` (limit ${minAltitude}°)`}
            {!preview.ok && " — below limit"}
          </div>
        )}
        {slewError && (
          <div style={{ color: "var(--red)", fontSize: 11, marginBottom: 8 }}>
            {slewError}
          </div>
        )}
        <button
          className="btn-primary"
          style={{ width: "100%" }}
          onClick={handleSlew}
          disabled={slewDisabled}
          title={!canSlew ? NOT_SUPPORTED : preview && !preview.ok ? preview.reason : undefined}
        >
          {pending === "slew" ? "Slewing…" : "Slew"}
        </button>
      </div>

      {/* Tracking */}
      <div className="section">
        <div className="toggle-row" title={!canSetTracking ? NOT_SUPPORTED : undefined}>
          <span className="toggle-label">Sidereal Tracking</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={status?.tracking ?? false}
              onChange={handleTracking}
              disabled={!connected || busy || !canSetTracking}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Park */}
      <div className="section">
        <div className="section-label">Park</div>
        <div className="btn-row">
          <button
            className="btn-secondary"
            onClick={handleUnpark}
            disabled={!connected || busy || !status?.at_park || !canUnpark}
            title={!canUnpark ? NOT_SUPPORTED : undefined}
          >
            {pending === "unpark" ? "Unparking…" : "Unpark"}
          </button>
          <button
            className="btn-cyan"
            onClick={handlePark}
            disabled={!connected || busy || status?.at_park || !canPark}
            title={!canPark ? NOT_SUPPORTED : undefined}
          >
            {pending === "park" ? "Parking…" : "Park"}
          </button>
        </div>
      </div>

      {/* Object picker */}
      <div className="section" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="section-label">Object Catalog</div>
        <ObjectPicker
          stars={stars}
          messier={messier}
          onSelect={fillFromObject}
          onSlew={slewToObject}
        />
      </div>
    </div>
  );
}
