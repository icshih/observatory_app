# Frontend Sky Chart Logic - v1

## Overview
The sky chart is implemented as a **React + Canvas** application in `/frontend/src/`, with core logic in `CelestialChart.jsx` and supporting utilities in `projection.js` and `format.js`. It renders a stereographic projection of the sky, showing stars, Messier objects, constellation lines, and mount status.

---

## Core Components

### 1. `App.jsx`
- **Purpose**: Root component integrating all panels.
- **Key Features**:
  - Polls mount status via `useMountStatus(1000)`.
  - Fetches catalog via `useCatalog()`.
  - Renders `<StatusPanel>`, `<CelestialChart>`, and `<CommandPanel>`.
  - Handles app-level actions (e.g., connect/disconnect).
- **Interaction**: Clicking the chart triggers `handleChartClick` (currently a stub).

---

### 2. `CelestialChart.jsx`
- **Purpose**: Renders the sky chart and handles user interactions.
- **Key Features**:
  - **Stereographic Projection**: Centers on observer latitude (default: 48.8°).
  - **Rendering Pipeline**:
    1. RA/Dec grid (every 15° in Dec, every 1h in RA).
    2. Constellation lines (hardcoded star indices).
    3. Stars (circles sized by magnitude, labels for bright stars).
    4. Messier objects (diamond shapes, cyan labels when zoomed).
    5. Mount crosshair (orange) for current position.
    6. Target indicator (dashed cyan circle) during slew.
    7. Horizon indicator (approximate celestial equator as placeholder).
  - **User Interactions**:
    - **Drag**: Pan the chart (updates `offsetX`, `offsetY`).
    - **Scroll**: Zoom in/out (scale clamped to `MIN_SCALE=80`, `MAX_SCALE=2000`).
    - **Click**: Read coordinates via `xyToRADec` and show tooltip.
    - **Double-Click**: Not yet implemented (stub in `draggedRef`).
  - **State Management**:
    - Uses `stateRef` to track scale, offset, dragging, and center RA/Dec.
    - `draggedRef` prevents auto-centering during manual drags.
    - `ResizeObserver` handles canvas resizing and high-DPI displays.
  - **Performance**:
    - Skips rendering off-screen objects (`isVisible` check).
    - Redraws only when dependencies change (via `useEffect`).

---

### 3. `CommandPanel.jsx`
- **Purpose**: Manual slew, abort, tracking, park/unpark controls.
- **Key Features**:
  - **Input Parsing**:
    - Uses `parseRA` and `parseDec` from `format.js` for flexible input (HMS/DMS/decimal).
  - **Validation**:
    - RA: 0–24 hours.
    - Dec: ±90 degrees.
  - **Actions**:
    - Slew to coordinates (POST `/api/slew`).
    - Abort slew (POST `/api/abort`).
    - Toggle tracking (POST `/api/tracking`).
    - Park/unpark (POST `/api/park`, `/api/unpark`).
  - **Catalog Integration**:
    - Clicking a catalog object fills the slew form via `fillFromObject`.
    - Slew form can also be manually edited.

---

### 4. `useMountStatus.js`
- **Purpose**: Polls mount status via `/api/status` every second.
- **Key Features**:
  - Uses `AbortController` to cancel pending requests on unmount.
  - Handles errors gracefully (sets `error` state).
  - Returns `status`, `loading`, and `error` for UI feedback.

---

### 5. `useCatalog.js`
- **Purpose**: Fetches catalog from `/api/catalog`.
- **Key Features**:
  - Returns `stars`, `messier`, and `constellationLines` for rendering.
  - Handles loading/error states.

---

## Projection System

### `projection.js`
- **Functions**:
  - `raDecToXY(ra, dec, centerRA, centerDec, scale)`: Converts RA/Dec to canvas coordinates using stereographic projection.
  - `xyToRADec(dx, dy, centerRA, centerDec, scale)`: Converts canvas coordinates to RA/Dec (inverse projection).
  - `angularSep(...)`: Calculates angular separation between two points.

- **Stereographic Projection**:
  - Preserves angles but distorts shapes far from the center.
  - Centered on observer latitude (hardcoded to 48.8°).
  - Scale parameter controls zoom level (pixels per radian).

---

## Formatting Utilities

### `format.js`
- **Functions**:
  - `formatRA(hours)`: Formats RA as `HHh MMm SS.ss`.
  - `formatDec(degrees)`: Formats Dec as `±DD° MM' SS"`.
  - `formatHMS(hours)`: Formats RA as `HH:MM:SS`.
  - `parseRA(str)`: Parses RA in HMS, decimal, or colon-separated format.
  - `parseDec(str)`: Parses Dec in DMS, decimal, or colon-separated format.

---

## Key Algorithms

### 1. Stereographic Projection
- **Formula**:
  - For a point `(ra, dec)` and center `(centerRA, centerDec)`:
    - Convert to radians.
    - Compute `k = (2 * scale) / (1 + sinφ0 * sinφ + cosφ0 * cosφ * cosΔλ)`.
    - Compute `x = -k * cosφ * sin(Δλ)`, `y = -k * (cosφ0 * sinφ - sinφ0 * cosφ * cosΔλ)`.
- **Inverse**:
  - Compute `ρ = sqrt(x² + y²)`.
  - Compute `c = 2 * atan2(ρ, 2 * scale)`.
  - Compute `φ = asin(cos(c) * sin(φ0) + (y * sin(c) * cos(φ0)) / ρ)`.
  - Compute `Δλ = atan2(x * sin(c), ρ * cos(φ0) * cos(c) - y * sin(φ0) * sin(c))`.
  - Convert back to RA/Dec.

### 2. Magnitude to Radius
- **Formula**: `radius = max(1, 5 - (mag + 1.5) * (4 / 7.5))`
- **Purpose**: Maps star magnitude to visual size (brighter stars = larger circles).

### 3. Visibility Check
- **Formula**: `isVisible(px, py) = px > -20 && px < W + 20 && py > -20 && py < H + 20`
- **Purpose**: Skips rendering off-screen objects for performance.

---

## User Interactions

| Action | Description | Implementation |
|--------|-------------|----------------|
| **Drag** | Pan the chart | Updates `offsetX`, `offsetY` in `stateRef` |
| **Scroll** | Zoom in/out | Adjusts `scale` (clamped to min/max) |
| **Click** | Read coordinates | Calls `xyToRADec` and shows tooltip |
| **Double-Click** | Re-center chart | Not yet implemented (stub in `draggedRef`) |
| **Catalog Click** | Fill slew form | Calls `fillFromObject` in `CommandPanel` |

---

## Styling

### Colors
- **Stars**: Warm white gradient (bright → transparent).
- **Messier**: Cyan diamond with cyan text.
- **Constellation Lines**: Semi-transparent blue (`rgba(31,65,100,0.5)`).
- **Grid**: Semi-transparent gray (`rgba(31,45,69,0.7)`).
- **Mount Crosshair**: Orange with glow effect.
- **Target Indicator**: Cyan dashed circle.
- **Tooltip**: Semi-transparent red background.

### Fonts
- Monospace for labels (e.g., star names, Messier numbers).

---

## Performance Optimizations

1. **Off-Screen Culling**: Only renders visible objects (`isVisible` check).
2. **Efficient Updates**: Redraws only when `status`, `stars`, `messier`, or `constellationLines` change.
3. **High-DPI Support**: Uses `window.devicePixelRatio` and `ResizeObserver`.
4. **Debounced Events**: Mouse events are throttled by React’s event system.

---

## Missing/To-Do Features

1. **Horizon Calculation**:
   - Currently uses celestial equator as a placeholder.
   - **Suggestion**: Project horizon using observer latitude and altitude.
   - Use `status.altitude` to adjust horizon visibility.

2. **Double-Click Re-Center**:
   - Not yet implemented (stub in `handleClick`).
   - **Suggestion**: Reset `offsetX/Y` and `centerRA` to sidereal time on double-click.

3. **Configurable Observer Latitude**:
   - Hardcoded to 48.8° (Paris-ish).
   - **Suggestion**: Add a settings panel to adjust latitude.

4. **Constellation Labels**:
   - Currently no labels for constellations (e.g., "Orion").
   - **Suggestion**: Add labels when zoomed in.

5. **Error Handling**:
   - No user-friendly errors for failed slew/park actions.
   - **Suggestion**: Add error toasts or inline feedback.

---

## Strengths

1. **Minimal Dependencies**: Pure React + Canvas; no external charting libraries.
2. **Interactive**: Smooth drag/zoom, coordinate readout, and slew form filling.
3. **Modular Design**: Separation of concerns (projection, formatting, rendering).
4. **Responsive**: Handles high-DPI displays and window resizing.
5. **Performant**: Efficient rendering and state management.

---

## Suggested Improvements

1. **Horizon Calculation**:
   ```javascript
   // Approximate horizon as a circle in alt-az space
   const horizonDec = 90 - observerLat; // Simplified
   ```

2. **Double-Click Re-Center**:
   ```javascript
   function handleDoubleClick(e) {
     stateRef.current.offsetX = 0;
     stateRef.current.offsetY = 0;
     stateRef.current.centerRA = status.sidereal_time;
     draw();
   }
   ```

3. **Configurable Latitude**:
   - Add a settings panel or URL param (e.g., `?lat=48.8`).

4. **Constellation Labels**:
   - Use a constellation name array and render when `scale > 200`.

5. **Error Handling**:
   - Add a `useError` hook or toast system for API errors.

---

## File Dependencies

```
frontend/
├── src/
│   ├── App.jsx                    # Root component
│   ├── components/
│   │   ├── CelestialChart.jsx     # Sky chart logic
│   │   ├── CommandPanel.jsx       # Manual controls
│   │   └── StatusPanel.jsx         # Mount status display
│   ├── hooks/
│   │   ├── useCatalog.js          # Fetch catalog
│   │   └── useMountStatus.js       # Poll mount status
│   ├── lib/
│   │   ├── format.js              # RA/Dec formatting
│   │   └── projection.js           # Stereographic projection
│   ├── main.jsx                   # React entry point
│   └── styles.css                 # Global styles
```

---

## Backend Integration

- **Status Polling**: `/api/status` (FastAPI endpoint).
- **Catalog Fetch**: `/api/catalog` (returns stars, Messier, constellation lines).
- **Actions**: `/api/slew`, `/api/abort`, `/api/tracking`, `/api/park`, `/api/unpark`.

---

## Summary
The frontend’s sky chart is **well-architected**, **performant**, and **feature-complete** for the stated requirements. The stereographic projection and canvas rendering are the core strengths, while the interactive features (drag, zoom, click) are intuitive and responsive.