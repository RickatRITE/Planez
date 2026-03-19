import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import type { Airline } from '../../types';
import { citiesById } from '../../data/cities';

import { formatMoney } from '../../utils/helpers';

export default function CompetitorPanel() {
  const {
    airlines,
    currentPlayerIndex,
    routes,
    ownedAircraft,
    financialHistory,
    selectCity,
  } = useGameStore();

  // We'll track competitor overlay in local-ish state via the store if extended,
  // but for now use a simple approach with selectCity to highlight on map
  const currentAirline = airlines[currentPlayerIndex];

  // Compute metrics for each airline
  const airlineMetrics = useMemo(() => {
    return airlines.map((airline) => {
      const airlineRoutes = routes.filter((r) => r.airlineId === airline.id);
      const airlineAircraft = ownedAircraft.filter((a) => a.airlineId === airline.id);
      const history = financialHistory.filter((f) => f.airlineId === airline.id);
      const latestReport = history[history.length - 1];

      const estimatedRevenue = airlineRoutes.reduce(
        (sum, r) => sum + r.quarterlyRevenue,
        0
      );

      return {
        airline,
        routeCount: airlineRoutes.length,
        fleetSize: airlineAircraft.length,
        estimatedRevenue,
        netWorth: latestReport?.netWorth ?? airline.cash - airline.loans,
        stockPrice: latestReport?.stockPrice ?? 10,
        hubCity: citiesById[airline.hubCityId],
      };
    });
  }, [airlines, routes, ownedAircraft, financialHistory]);

  // Revenue ranking
  const sortedByRevenue = [...airlineMetrics]
    .filter((m) => !m.airline.eliminated)
    .sort((a, b) => b.estimatedRevenue - a.estimatedRevenue);

  const getRevenueRank = (airlineId: number): number => {
    const idx = sortedByRevenue.findIndex((m) => m.airline.id === airlineId);
    return idx >= 0 ? idx + 1 : airlines.length;
  };

  // Bar chart metrics
  const maxRoutes = Math.max(1, ...airlineMetrics.map((m) => m.routeCount));
  const maxFleet = Math.max(1, ...airlineMetrics.map((m) => m.fleetSize));
  const maxRevenue = Math.max(1, ...airlineMetrics.map((m) => m.estimatedRevenue));

  return (
    <div className="glass rounded-xl p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-semibold text-white mb-3">Competitors</h2>

      {/* Airline cards grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {airlineMetrics.map((m) => {
          const isCurrentPlayer = m.airline.id === currentAirline?.id;
          const isEliminated = m.airline.eliminated;

          return (
            <motion.div
              key={m.airline.id}
              whileHover={!isEliminated ? { scale: 1.02 } : undefined}
              className={`relative rounded-lg border p-3 transition-all ${
                isEliminated
                  ? 'bg-white/[0.02] border-white/5 opacity-50'
                  : isCurrentPlayer
                  ? 'bg-white/10 border-sky-500/40 ring-1 ring-sky-500/20'
                  : 'bg-white/5 border-white/10 hover:bg-white/8 cursor-pointer'
              }`}
              onClick={() => {
                if (!isEliminated && !isCurrentPlayer && m.hubCity) {
                  selectCity(m.airline.hubCityId);
                }
              }}
            >
              {/* Bankrupt overlay */}
              {isEliminated && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <span className="text-red-500/70 text-xs font-black tracking-widest rotate-[-15deg] border-2 border-red-500/40 px-2 py-0.5 rounded">
                    BANKRUPT
                  </span>
                </div>
              )}

              {/* Airline header */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20"
                  style={{ backgroundColor: m.airline.color }}
                />
                <span className="text-white text-sm font-semibold truncate">
                  {m.airline.name}
                </span>
              </div>

              {/* Hub city */}
              <p className="text-white/40 text-[10px] mb-2">
                Hub: {m.hubCity?.name ?? m.airline.hubCityId}
              </p>

              {/* Stats */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/40">Fleet</span>
                  <span className="text-white">{m.fleetSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Routes</span>
                  <span className="text-white">{m.routeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Revenue Rank</span>
                  <span
                    className={`font-semibold ${
                      getRevenueRank(m.airline.id) === 1
                        ? 'text-amber-400'
                        : 'text-white'
                    }`}
                  >
                    #{getRevenueRank(m.airline.id)}
                  </span>
                </div>
              </div>

              {/* Current player badge */}
              {isCurrentPlayer && (
                <div className="mt-2">
                  <span className="text-[9px] px-1.5 py-0.5 bg-sky-500/30 text-sky-300 rounded-full uppercase tracking-wider font-semibold">
                    You
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Comparison bar charts */}
      <div>
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
          Comparison
        </h3>
        <div className="bg-white/5 rounded-lg border border-white/10 p-3 space-y-3">
          <ComparisonChart
            label="Routes"
            airlines={airlineMetrics}
            getValue={(m) => m.routeCount}
            maxValue={maxRoutes}
          />
          <ComparisonChart
            label="Fleet"
            airlines={airlineMetrics}
            getValue={(m) => m.fleetSize}
            maxValue={maxFleet}
          />
          <ComparisonChart
            label="Revenue"
            airlines={airlineMetrics}
            getValue={(m) => m.estimatedRevenue}
            maxValue={maxRevenue}
            formatValue={(v) => formatMoney(v)}
          />
        </div>
      </div>
    </div>
  );
}

// --- Comparison bar chart sub-component ---

interface AirlineMetric {
  airline: Airline;
  routeCount: number;
  fleetSize: number;
  estimatedRevenue: number;
}

function ComparisonChart({
  label,
  airlines,
  getValue,
  maxValue,
  formatValue,
}: {
  label: string;
  airlines: AirlineMetric[];
  getValue: (m: AirlineMetric) => number;
  maxValue: number;
  formatValue?: (v: number) => string;
}) {
  return (
    <div>
      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <div className="space-y-1">
        {airlines.map((m) => {
          const value = getValue(m);
          const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;

          return (
            <div key={m.airline.id} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: m.airline.color }}
              />
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: m.airline.eliminated
                      ? 'rgba(255,255,255,0.1)'
                      : m.airline.color,
                    opacity: m.airline.eliminated ? 0.3 : 0.7,
                  }}
                />
              </div>
              <span className="text-white/50 text-[10px] w-12 text-right">
                {formatValue ? formatValue(value) : value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
