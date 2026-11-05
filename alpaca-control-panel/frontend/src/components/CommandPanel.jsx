import { useState } from "react";
import { parseRA, parseDec, formatRA, formatDec } from "../lib/format.js";
import { apiPost } from "../lib/api.js";
import ObjectPicker from "./ObjectPicker.jsx";

export default function CommandPanel({ status, stars, messier, onAction }) {
  const [raInput, setRaInput] = useState("");
  const [decInput, setDecInput] = useState("");
  const [slewError, setSlewError] = useState("");

  const connected = status?.connected ?? false;

  // Run a command; report success (null) or the backend error message.
  async function run(path, body) {
    try {
      await apiPost(path, body);
      onAction?.(null);
    } catch (err) {
      onAction?.(err.message);
    }
  }

  async function handleSlew() {
    const ra = parseRA(raInput);
    const dec = parseDec(decInput);
    if (ra == null || isNaN(ra) || ra < 0 || ra >= 24) {
      setSlewError("Invalid RA (0–24 h)");
      return;
    }
    if (dec == null || isNaN(dec) || dec < -90 || dec > 90) {
      setSlewError("Invalid Dec (±90°)");
      return;
    }
    setSlewError("");
    await run("/api/slew", { right_ascension: ra, declination: dec });
  }

  const handleAbort = () => run("/api/abort");
  const handleTracking = (e) => run("/api/tracking", { enabled: e.target.checked });
  const handlePark = () => run("/api/park");
  const handleUnpark = () => run("/api/unpark");

  function fillFromObject(obj) {
    setRaInput(formatRA(obj.ra));
    setDecInput(formatDec(obj.dec));
    setSlewError("");
  }

  async function slewToObject(obj) {
    fillFromObject(obj);
    await run("/api/slew", { right_ascension: obj.ra, declination: obj.dec });
  }

  return (
    <div className="panel">
      <div className="panel-title">Commands</div>

      {/* Abort */}
      <div className="section">
        <button
          className="btn-danger"
          onClick={handleAbort}
          disabled={!connected || !status?.slewing}
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
            onChange={(e) => setRaInput(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Dec (° or DD MM SS)</label>
          <input
            type="text"
            placeholder="e.g. -16.7 or -16 42 00"
            value={decInput}
            onChange={(e) => setDecInput(e.target.value)}
          />
        </div>
        {slewError && (
          <div style={{ color: "var(--red)", fontSize: 11, marginBottom: 8 }}>
            {slewError}
          </div>
        )}
        <button
          className="btn-primary"
          style={{ width: "100%" }}
          onClick={handleSlew}
          disabled={!connected || status?.at_park}
        >
          Slew
        </button>
      </div>

      {/* Tracking */}
      <div className="section">
        <div className="toggle-row">
          <span className="toggle-label">Sidereal Tracking</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={status?.tracking ?? false}
              onChange={handleTracking}
              disabled={!connected}
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
            disabled={!connected || !status?.at_park}
          >
            Unpark
          </button>
          <button
            className="btn-cyan"
            onClick={handlePark}
            disabled={!connected || status?.at_park}
          >
            Park
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
