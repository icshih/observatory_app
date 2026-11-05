import { useRef, useEffect, useCallback, useState } from "react";
import { raDecToXY, xyToRADec } from "../lib/projection.js";
import { formatRA, formatDec } from "../lib/format.js";
import { getHorizonPoints, drawHorizon } from "../lib/horizon.js";

const OBSERVER_LAT = import.meta.env.VITE_OBSERVER_LATITUDE
  ? parseFloat(import.meta.env.VITE_OBSERVER_LATITUDE)
  : 48.8;
const MIN_SCALE = 80;
const MAX_SCALE = 2000;
const DEFAULT_SCALE = 280;

const CONSTELLATION_LABELS = [
  { name: "Orion",  ra:  5.58, dec:  2.0 },
  { name: "UMa",    ra: 11.90, dec: 52.0 },
  { name: "CMa",    ra:  6.95, dec: -21.0 },
  { name: "Tau",    ra:  4.70, dec: 18.0 },
  { name: "Sco",    ra: 16.90, dec: -33.0 },
  { name: "Cru",    ra: 12.50, dec: -60.0 },
  { name: "Cen",    ra: 13.50, dec: -47.0 },
  { name: "Leo",    ra: 10.70, dec: 16.0 },
  { name: "Per",    ra:  3.40, dec: 47.0 },
  { name: "Aur",    ra:  5.60, dec: 41.0 },
];


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
    startX: 0,
    startY: 0,
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
    // Work in CSS pixels: the device-pixel-ratio transform is applied in the
    // ResizeObserver callback, so canvas.width/height (device px) must not be used here.
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
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

    // ── Horizon indicator (altitude 0°) ──
    if (status?.connected) {
      const horizonPoints = getHorizonPoints(OBSERVER_LAT, centerRA);
      drawHorizon(ctx, horizonPoints, toCanvas);
    }

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

    // ── Constellation labels ──
    if (scale > 150) {
      ctx.save();
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(100,140,200,0.65)";
      for (const { name, ra, dec } of CONSTELLATION_LABELS) {
        const [px, py] = toCanvas(ra, dec);
        if (!isVisible(px, py)) continue;
        ctx.fillText(name, px, py);
      }
      ctx.restore();
    }

    // ── Stars ──
    ctx.save();
    const showStarLabels = scale > 500;
    ctx.font = "10px 'JetBrains Mono', monospace";
    for (const star of stars) {
      const [px, py] = toCanvas(star.ra, star.dec);
      if (!isVisible(px, py)) continue;
      const r = magToRadius(star.magnitude);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      if (r > 1.5) {
        // warm white glow for brighter stars only — gradients are costly
        // and the catalog has ~9k stars.
        const grad = ctx.createRadialGradient(px, py, 0, px, py, r * 2);
        grad.addColorStop(0, "rgba(255,248,230,1)");
        grad.addColorStop(1, "rgba(255,248,230,0)");
        ctx.fillStyle = grad;
      } else {
        // faint stars: dimmer as magnitude increases
        const alpha = Math.max(0.35, Math.min(0.9, 1.1 - star.magnitude / 8));
        ctx.fillStyle = `rgba(255,248,230,${alpha.toFixed(2)})`;
      }
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
  }, [stars, messier, constellationLines, status]);

  // Latest draw function, so long-lived listeners don't need re-registering
  // every time status changes (once per poll).
  const drawRef = useRef(draw);
  drawRef.current = draw;

  // Resize observer — the only place the pixel-ratio transform is applied.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      // Setting width/height resets the transform, so scale exactly once here.
      canvas.getContext("2d").scale(dpr, dpr);
      drawRef.current();
    });
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom — must be a non-passive native listener for preventDefault()
  // to work (React registers onWheel as passive).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(e) {
      e.preventDefault();
      const s = stateRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      s.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s.scale * factor));
      drawRef.current();
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // Redraw whenever dependencies change
  useEffect(() => {
    draw();
  }, [draw]);

  // ── Mouse events ──
  function getCanvasCoords(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const s = stateRef.current;
    s.dragging = true;
    s.lastX = s.startX = e.clientX;
    s.lastY = s.startY = e.clientY;
    // Keep receiving move/up events even if the pointer leaves the canvas.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setTooltip(null);
  }

  function onPointerMove(e) {
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

  function onPointerUp(e) {
    const s = stateRef.current;
    const wasDragging = s.dragging;
    s.dragging = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    // Treat as a click only if the pointer barely moved since pointerdown.
    const dx = Math.abs(e.clientX - s.startX);
    const dy = Math.abs(e.clientY - s.startY);
    if (wasDragging && dx < 4 && dy < 4) {
      handleClick(e);
    }
  }

  function onPointerCancel() {
    stateRef.current.dragging = false;
  }

  function handleClick(e) {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    const [mouseX, mouseY] = getCanvasCoords(e);
    const cx = canvas.clientWidth / 2 + s.offsetX;
    const cy = canvas.clientHeight / 2 + s.offsetY;
    const { ra, dec } = xyToRADec(mouseX - cx, mouseY - cy, s.centerRA, s.centerDec, s.scale);
    setTooltip({ x: mouseX, y: mouseY, ra, dec });
    onClickCoords?.({ ra, dec });
  }

  function onDoubleClick() {
    // Reset pan, re-lock to LST
    stateRef.current.offsetX = 0;
    stateRef.current.offsetY = 0;
    draggedRef.current = false;
    setTooltip(null);
    draw();
  }

  return (
    <div className="chart-wrapper">
      <canvas
        ref={canvasRef}
        style={{ cursor: "crosshair", width: "100%", height: "100%", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={onDoubleClick}
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
