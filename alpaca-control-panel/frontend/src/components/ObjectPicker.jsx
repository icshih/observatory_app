import { useMemo, useState } from "react";
import { formatRA, formatDec } from "../lib/format.js";

// The star catalog holds ~9k entries; rendering them all would make the list
// sluggish, so cap each group and ask the user to refine the search.
const MAX_RESULTS = 150;

function Row({ obj, onSelect, onSlew }) {
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

function Group({ label, items, total, onSelect, onSlew }) {
  if (items.length === 0) return null;
  return (
    <>
      <div className="picker-group-label">{label}</div>
      {items.map((obj, i) => (
        <Row key={`${obj.name}-${obj.ra}-${i}`} obj={obj} onSelect={onSelect} onSlew={onSlew} />
      ))}
      {total > items.length && (
        <div style={{ color: "var(--text-dim)", fontSize: 11, padding: "6px 0" }}>
          {total - items.length} more — refine your search
        </div>
      )}
    </>
  );
}

function filterByName(list, q) {
  const matches = q ? list.filter((o) => o.name.toLowerCase().includes(q)) : list;
  return matches;
}

export default function ObjectPicker({ stars, messier, onSelect, onSlew }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Brightest first, so the default (empty-query) view is useful.
  const starsByMag = useMemo(
    () => [...stars].sort((a, b) => a.magnitude - b.magnitude),
    [stars]
  );

  const starMatches = useMemo(() => filterByName(starsByMag, q), [starsByMag, q]);
  const messierMatches = useMemo(() => filterByName(messier, q), [messier, q]);

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
        <Group
          label="Stars"
          items={starMatches.slice(0, MAX_RESULTS)}
          total={starMatches.length}
          onSelect={onSelect}
          onSlew={onSlew}
        />
        <Group
          label="Messier Objects"
          items={messierMatches.slice(0, MAX_RESULTS)}
          total={messierMatches.length}
          onSelect={onSelect}
          onSlew={onSlew}
        />
        {starMatches.length === 0 && messierMatches.length === 0 && (
          <div style={{ color: "var(--text-dim)", fontSize: 12, padding: "8px 0" }}>
            No matches
          </div>
        )}
      </div>
    </>
  );
}
