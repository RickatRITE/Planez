import React, { useState, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { cities, citiesById } from '../../data/cities';
import { latLngToSvg } from '../../utils/helpers';
import { CONTINENT_POLYGONS } from '../../data/continentOutlines';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAP_W = 1200;
const MAP_H = 600;
const POPULATION_MIN = 0.4;
const POPULATION_MAX = 32.5;
const RADIUS_MIN = 3;
const RADIUS_MAX = 8;
const LABEL_POP_THRESHOLD = 8; // millions

// ---------------------------------------------------------------------------
// Convert continent lat/lng polygons to SVG path strings
// ---------------------------------------------------------------------------

const CONTINENT_PATHS: { id: string; d: string }[] = CONTINENT_POLYGONS.map((poly) => {
  const svgPoints = poly.points.map(([lat, lng]) => latLngToSvg(lat, lng, MAP_W, MAP_H));
  const d =
    svgPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ') + ' Z';
  return { id: poly.id, d };
});

// ---------------------------------------------------------------------------
// Helper: generate grid lines (lat/lng at 30-degree intervals)
// ---------------------------------------------------------------------------

function generateGridLines(): { x1: number; y1: number; x2: number; y2: number }[] {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  // Longitude lines (vertical) every 30 degrees
  for (let lng = -180; lng <= 180; lng += 30) {
    const top = latLngToSvg(80, lng, MAP_W, MAP_H);
    const bottom = latLngToSvg(-60, lng, MAP_W, MAP_H);
    lines.push({ x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y });
  }

  // Latitude lines (horizontal) every 30 degrees
  for (let lat = -60; lat <= 80; lat += 30) {
    const left = latLngToSvg(lat, -180, MAP_W, MAP_H);
    const right = latLngToSvg(lat, 180, MAP_W, MAP_H);
    lines.push({ x1: left.x, y1: left.y, x2: right.x, y2: right.y });
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Helper: curved path between two SVG points
// ---------------------------------------------------------------------------

function curvedRoutePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Arc upward; amount proportional to distance
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const bulge = Math.min(dist * 0.2, 60);
  const cy = my - bulge;
  return `M ${x1},${y1} Q ${mx},${cy} ${x2},${y2}`;
}

// ---------------------------------------------------------------------------
// Helper: city radius from population
// ---------------------------------------------------------------------------

function cityRadius(population: number): number {
  const t = Math.min(
    1,
    Math.max(0, (population - POPULATION_MIN) / (POPULATION_MAX - POPULATION_MIN)),
  );
  return RADIUS_MIN + t * (RADIUS_MAX - RADIUS_MIN);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WorldMap: React.FC = () => {
  // --- Store ---
  const routes = useGameStore((s) => s.routes);
  const airlines = useGameStore((s) => s.airlines);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const selectCity = useGameStore((s) => s.selectCity);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);

  // --- Local state ---
  const [hoveredCityId, setHoveredCityId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: MAP_W, h: MAP_H });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; vbX: number; vbY: number } | null>(null);

  // --- Derived ---
  const currentAirline = airlines[currentPlayerIndex];

  const hubCityIds = useMemo(() => {
    const ids = new Set<string>();
    for (const airline of airlines) {
      ids.add(airline.hubCityId);
    }
    return ids;
  }, [airlines]);

  const airlineByIdMap = useMemo(() => {
    const m = new Map<number, (typeof airlines)[0]>();
    for (const a of airlines) m.set(a.id, a);
    return m;
  }, [airlines]);

  const gridLines = useMemo(() => generateGridLines(), []);

  const cityPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const city of cities) {
      map.set(city.id, latLngToSvg(city.lat, city.lng, MAP_W, MAP_H));
    }
    return map;
  }, []);

  // --- Pan handlers ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        vbX: viewBox.x,
        vbY: viewBox.y,
      };
    },
    [viewBox],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!dragRef.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = viewBox.w / rect.width;
      const scaleY = viewBox.h / rect.height;
      const dx = (e.clientX - dragRef.current.startX) * scaleX;
      const dy = (e.clientY - dragRef.current.startY) * scaleY;
      setViewBox((vb) => ({
        ...vb,
        x: dragRef.current!.vbX - dx,
        y: dragRef.current!.vbY - dy,
      }));
    },
    [viewBox.w, viewBox.h],
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // --- Zoom handler ---
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox((vb) => {
      const newW = Math.max(300, Math.min(MAP_W * 2, vb.w * zoomFactor));
      const newH = Math.max(150, Math.min(MAP_H * 2, vb.h * zoomFactor));
      // Zoom toward center
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      return {
        x: cx - newW / 2,
        y: cy - newH / 2,
        w: newW,
        h: newH,
      };
    });
  }, []);

  // --- City click ---
  const handleCityClick = useCallback(
    (cityId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      selectCity(cityId);
    },
    [selectCity],
  );

  // --- Render helpers ---
  const selectedPos = selectedCityId ? cityPositions.get(selectedCityId) : null;

  return (
    <div className="relative w-full h-full overflow-hidden select-none" style={{ background: '#0a0e1a' }}>
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* ── Definitions ───────────────────────────────────────── */}
        <defs>
          {/* Glow filter for hub cities */}
          <filter id="city-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Stronger glow for selected city */}
          <filter id="city-glow-selected" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Radial gradient for ocean background */}
          <radialGradient id="ocean-grad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#0f1528" />
            <stop offset="100%" stopColor="#0a0e1a" />
          </radialGradient>
        </defs>

        {/* ── Ocean background ──────────────────────────────────── */}
        <rect x="-200" y="-200" width={MAP_W + 400} height={MAP_H + 400} fill="url(#ocean-grad)" />

        {/* ── Grid lines ────────────────────────────────────────── */}
        {gridLines.map((line, i) => (
          <line
            key={`grid-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#151d30"
            strokeWidth={0.5}
          />
        ))}

        {/* ── Continent shapes ──────────────────────────────────── */}
        {CONTINENT_PATHS.map((c) => (
          <path
            key={c.id}
            d={c.d}
            fill="#1a2540"
            stroke="#2a3a5a"
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
        ))}

        {/* ── Route lines ───────────────────────────────────────── */}
        {routes.map((route) => {
          const origin = cityPositions.get(route.originCityId);
          const dest = cityPositions.get(route.destinationCityId);
          const airline = airlineByIdMap.get(route.airlineId);
          if (!origin || !dest || !airline) return null;

          return (
            <path
              key={route.id}
              d={curvedRoutePath(origin.x, origin.y, dest.x, dest.y)}
              fill="none"
              stroke={airline.color}
              strokeWidth={1.5}
              opacity={route.suspended ? 0.3 : 0.7}
              className="route-line-animated"
            />
          );
        })}

        {/* ── Potential route lines from selected city ───────────── */}
        {selectedCityId && selectedPos && (
          <>
            {cities.map((city) => {
              if (city.id === selectedCityId) return null;
              const pos = cityPositions.get(city.id);
              if (!pos) return null;
              return (
                <path
                  key={`potential-${city.id}`}
                  d={curvedRoutePath(selectedPos.x, selectedPos.y, pos.x, pos.y)}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={0.5}
                  strokeDasharray="4 6"
                  opacity={0.08}
                />
              );
            })}
          </>
        )}

        {/* ── City dots ─────────────────────────────────────────── */}
        {cities.map((city) => {
          const pos = cityPositions.get(city.id);
          if (!pos) return null;

          const isHub = hubCityIds.has(city.id);
          const isSelected = city.id === selectedCityId;
          const isHovered = city.id === hoveredCityId;
          const r = cityRadius(city.population);

          // Find if any airline uses this city as hub to get its color
          const hubAirline = airlines.find((a) => a.hubCityId === city.id);
          const dotColor = hubAirline ? hubAirline.color : isHub ? '#ffffff' : '#8899aa';

          return (
            <g key={city.id}>
              {/* Selected city pulsing ring */}
              {isSelected && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r + 6}
                  fill="none"
                  stroke={currentAirline?.color ?? '#ffffff'}
                  strokeWidth={1.5}
                  opacity={0.8}
                  className="city-pulse"
                  filter="url(#city-glow-selected)"
                />
              )}

              {/* Main city dot */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={dotColor}
                opacity={isHub ? 1 : 0.7}
                filter={isHub ? 'url(#city-glow)' : undefined}
                style={{ cursor: 'pointer' }}
                whileHover={{ scale: 1.4 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={(e) => handleCityClick(city.id, e)}
                onMouseEnter={() => setHoveredCityId(city.id)}
                onMouseLeave={() => setHoveredCityId(null)}
              />

              {/* City label — shown for large cities, hubs, selected, or hovered */}
              {(city.population > LABEL_POP_THRESHOLD || isHub || isSelected || isHovered) && (
                <text
                  x={pos.x + r + 4}
                  y={pos.y - r - 2}
                  fill="#ffffff"
                  fontSize={isHovered || isSelected ? 9 : 7}
                  fontFamily="system-ui, sans-serif"
                  opacity={isHovered || isSelected ? 0.95 : 0.55}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {city.name}
                </text>
              )}
            </g>
          );
        })}

        {/* ── Hovered city tooltip ───────────────────────────────── */}
        {hoveredCityId && (() => {
          const city = citiesById[hoveredCityId];
          const pos = cityPositions.get(hoveredCityId);
          if (!city || !pos) return null;

          const tooltipX = pos.x + 14;
          const tooltipY = pos.y - 14;

          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={tooltipX - 2}
                y={tooltipY - 14}
                width={Math.max(city.name.length * 5.5 + 20, 80)}
                height={34}
                rx={4}
                fill="#0d1225"
                stroke="#2a3a5a"
                strokeWidth={0.5}
                opacity={0.92}
              />
              <text
                x={tooltipX + 4}
                y={tooltipY}
                fill="#ffffff"
                fontSize={8}
                fontWeight="bold"
                fontFamily="system-ui, sans-serif"
              >
                {city.name}
              </text>
              <text
                x={tooltipX + 4}
                y={tooltipY + 13}
                fill="#8899bb"
                fontSize={6.5}
                fontFamily="system-ui, sans-serif"
              >
                {city.country} &middot; Pop: {city.population}M
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
};

export default WorldMap;
