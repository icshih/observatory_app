import { useRef, useEffect, useCallback, useState } from "react";
import { raDecToXY, xyToRADec } from "../lib/projection.js";
import { formatRA, formatDec } from "../lib/format.js";

const OBSERVER_LAT = 48.8; // degrees — Paris-ish default, TODO: make configurable
const MIN_SCALE = 80;
const MAX_SCALE = 2000;
const DEFAULT_SCALE = 280;

function magToRadius(mag) {
  // Bright = big. mag -1.5 → 5px, mag 6 → 1px.
  return Math.max(1, 5 - (mag + 1.5) * (4 / 7.5));
}

export default function CelestialChart({ status, stars, messier, constellationLines, onClickCoords }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    scale: DEFAULT_SCALE,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    centerRA: 0,
    centerDec: OBSERVER_LAT,
  });

  const [tooltip, setTooltip] = useState(null);

  // Keep centerRA in sync with sidereal time when not dragged
  const draggedRef = useRef(false);
  useEffect(() => {
    if (!draggedRef.current && status?.sidereal_time != null) {
      stateRef.current.centerRA = status.sidereal_time;
    }
  }, [status?.sidereal_time]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const { scale, offsetX, offsetY, centerRA, centerDec } = stateRef.current;

    const cx = W / 2 + offsetX;
    const cy = H / 2 + offsetY;

    // Background
    ctx.fillStyle = "#0a0e17";
    ctx.fillRect(0, 0, W, H);

    function toCanvas(ra, dec) {
      const { x, y } = raDecToXY(ra, dec, centerRA, centerDec, scale);
      return [cx + x, cy + y];
    }

    function isVisible(px, py) {
      return px > -20 && px < W + 20 && py > -20 && py < H + 20;
    }

    // ── RA/Dec grid ──
    ctx.save();
    ctx.strokeStyle = "rgba(31,45,69,0.7)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 6]);

    // Dec lines (every 15°)
    for (let dec = -90; dec <= 90; dec += 15) {
      ctx.beginPath();
      let first = true;
      for (let ra = 0; ra <= 24; ra += 0.25) {
        const [px, py] = toCanvas(ra, dec);
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // RA lines (every 1h)
    for (let ra = 0; ra < 24; ra += 1) {
      ctx.beginPath();
      let first = true;
      for (let dec = -80; dec <= 80; dec += 5) {
        const [px, py] = toCanvas(ra, dec);
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // ── Constellation lines ──
    ctx.save();
    ctx.strokeStyle = "rgba(31,65,100,0.5)";
    ctx.lineWidth = 0.8;
    for (const [i, j] of constellationLines) {
      const s1 = stars[i];
      const s2 = stars[j];
      if (!s1 || !s2) continue;
      const [x1, y1] = toCanvas(s1.ra, s1.dec);
      const [x2, y2] = toCanvas(s2.ra, s2.dec);
      if (!isVisible(x1, y1) && !isVisible(x2, y2)) continue;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // ── Stars ──
    ctx.save();
    const showStarLabels = scale > 500;
    ctx.font = "10px 'JetBrains Mono', monospace";
    for (const star of stars) {
      const [px, py] = toCanvas(star.ra, star.dec);
      if (!isVisible(px, py)) continue;
      const r = magToRadius(star.magnitude);
      // warm white gradient
      const grad = ctx.createRadialGradient(px, py, 0, px, py, r * 2);
      grad.addColorStop(0, "rgba(255,248,230,1)");
      grad.addColorStop(1, "rgba(255,248,230,0)");
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      if (showStarLabels && star.magnitude < 2) {
        ctx.fillStyle = "rgba(209,213,219,0.6)";
        ctx.fillText(star.name, px + r + 2, py + 3);
      }
    }
    ctx.restore();

    // ── Messier objects ──
    ctx.save();
    const showDSOLabels = scale > 350;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.strokeStyle = "#06b6d4";
    ctx.fillStyle = "rgba(6,182,212,0.15)";
    ctx.lineWidth = 1;
    for (const obj of messier) {
      const [px, py] = toCanvas(obj.ra, obj.dec);
      if (!isVisible(px, py)) continue;
      // Diamond shape
      const size = 4;
      ctx.beginPath();
      ctx.moveTo(px, py - size);
      ctx.lineTo(px + size, py);
      ctx.lineTo(px, py + size);
      ctx.lineTo(px - size, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (showDSOLabels) {
        ctx.fillStyle = "rgba(6,182,212,0.7)";
        ctx.fillText(obj.name.split(" ")[0], px + size + 2, py + 3);
        ctx.fillStyle = "rgba(6,182,212,0.15)";
      }
    }
    ctx.restore();

    // ── Mount crosshair ──
    if (status?.connected && status?.right_ascension != null && status?.declination != null) {
      const [px, py] = toCanvas(status.right_ascension, status.declination);
      ctx.save();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 6;
      const arm = 12;
      ctx.beginPath();
      ctx.moveTo(px - arm, py); ctx.lineTo(px + arm, py);
      ctx.moveTo(px, py - arm); ctx.lineTo(px, py + arm);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── Target (dashed circle) when slewing ──
    if (status?.slewing && status?.target_ra != null && status?.target_dec != null) {
      const [px, py] = toCanvas(status.target_ra, status.target_dec);
      ctx.save();
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.shadowColor = "#06b6d4";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── Horizon indicator (altitude 0°) ──
    if (status?.connected) {
      ctx.save();
      ctx.strokeStyle = "rgba(239,68,68,0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 8]);
      ctx.beginPath();
      let first = true;
      // Approximate horizon: alt=0 projected onto chart via azimuth
      // Simpler: draw the Dec = (90° - lat) circle in alt-az space...
      // Instead, mark the celestial equator as a guide
      for (let ra = 0; ra <= 24; ra += 0.25) {
        const [px, py] = toCanvas(ra, 0);
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [stars, messier, constellationLines, status]);

  // Resize observer + redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      draw();
    });
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [draw]);

  // Redraw whenever dependencies change
  useEffect(() => {
    draw();
  }, [draw]);

  // ── Mouse events ──
  function getCanvasCoords(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function onMouseDown(e) {
    stateRef.current.dragging = true;
    stateRef.current.lastX = e.clientX;
    stateRef.current.lastY = e.clientY;
  }

  function onMouseMove(e) {
    const s = stateRef.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.lastX;
    const dy = e.clientY - s.lastY;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.offsetX += dx;
    s.offsetY += dy;
    draggedRef.current = true;
    draw();
  }

  function onMouseUp(e) {
    const s = stateRef.current;
    const wasDragging = s.dragging;
    s.dragging = false;
    // If mouse barely moved, treat as click
    const dx = Math.abs(e.clientX - s.lastX);
    const dy = Math.abs(e.clientY - s.lastY);
    if (wasDragging && dx < 4 && dy < 4) {
      handleClick(e);
    }
  }

  function handleClick(e) {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    const [mouseX, mouseY] = getCanvasCoords(e);
    const cx = canvas.offsetWidth / 2 + s.offsetX;
    const cy = canvas.offsetHeight / 2 + s.offsetY;
    const { ra, dec } = xyToRADec(mouseX - cx, mouseY - cy, s.centerRA, s.centerDec, s.scale);
    setTooltip({ x: mouseX, y: mouseY, ra, dec });
    onClickCoords?.({ ra, dec });
  }

  function onWheel(e) {
    e.preventDefault();
    const s = stateRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    s.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s.scale * factor));
    draw();
  }

  function onDoubleClick() {
    // Reset pan, re-lock to LST
    stateRef.current.offsetX = 0;
    stateRef.current.offsetY = 0;
    draggedRef.current = false;
    draw();
  }

  return (
    <div className="chart-wrapper">
      <canvas
        ref={canvasRef}
        style={{ cursor: "crosshair", width: "100%", height: "100%" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onClick={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="status-bar"
          style={{
            left: tooltip.x,
            top: tooltip.y + 16,
            transform: "translateX(-50%)",
            bottom: "unset",
          }}
        >
          {formatRA(tooltip.ra)} · {formatDec(tooltip.dec)}
        </div>
      )}
      <div className="status-bar" style={{ pointerEvents: "none" }}>
        Scroll to zoom · Drag to pan · Double-click to reset
      </div>
    </div>
  );
}
