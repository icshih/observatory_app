import { useState } from "react";
import { formatRA, formatDec } from "../lib/format.js";

export default function ObjectPicker({ stars, messier, onSelect, onSlew }) {
  const [query, setQuery] = useState("");

  const q = query.toLowerCase();

  const filteredStars = stars.filter((s) => s.name.toLowerCase().includes(q));
  const filteredMessier = messier.filter((m) => m.name.toLowerCase().includes(q));

  function Row({ obj }) {
    return (
      <div
        className="picker-item"
        onClick={() => onSelect(obj)}
        onDoubleClick={() => onSlew(obj)}
        title="Click to fill form · Double-click to slew"
      >
        <div>
          <div className="picker-item-name">{obj.name}</div>
          <div className="picker-item-coords">
            {formatRA(obj.ra)} · {formatDec(obj.dec)}
          </div>
        </div>
        <div className="picker-item-mag">{obj.magnitude.toFixed(1)}</div>
      </div>
    );
  }

  return (
    <>
      <div className="picker-search">
        <input
          type="text"
          placeholder="Search objects…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="picker-list">
        {filteredStars.length > 0 && (
          <>
            <div className="picker-group-label">Stars</div>
            {filteredStars.map((s) => (
              <Row key={s.name} obj={s} />
            ))}
          </>
        )}
        {filteredMessier.length > 0 && (
          <>
            <div className="picker-group-label">Messier Objects</div>
            {filteredMessier.map((m) => (
              <Row key={m.name} obj={m} />
            ))}
          </>
        )}
        {filteredStars.length === 0 && filteredMessier.length === 0 && (
          <div style={{ color: "var(--text-dim)", fontSize: 12, padding: "8px 0" }}>
            No matches
          </div>
        )}
      </div>
    </>
  );
}
