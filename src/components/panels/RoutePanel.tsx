import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import type { Route, FareLevel } from '../../types';
import { citiesById } from '../../data/cities';
import { aircraftTypesById } from '../../data/aircraft';
import { formatMoney, formatPercent } from '../../utils/helpers';

const FARE_LABELS: Record<FareLevel, string> = {
  1: 'Budget',
  2: 'Discount',
  3: 'Standard',
  4: 'Premium',
  5: 'Luxury',
};

export default function RoutePanel() {
  const {
    routes,
    airlines,
    currentPlayerIndex,
    ownedAircraft,
    selectedRouteId,
    selectedCityId,
    selectRoute,
    openRoute,
    closeRoute,
    adjustFare,
    adjustFrequency,
    assignAircraft,
  } = useGameStore();

  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  const airline = airlines[currentPlayerIndex];
  if (!airline) return null;

  const myRoutes = routes.filter((r) => r.airlineId === airline.id);
  const selectedRoute = myRoutes.find((r) => r.id === selectedRouteId);

  const availableAircraft = ownedAircraft.filter(
    (a) => a.airlineId === airline.id && a.assignedRouteId === null
  );

  const canOpenRoute = selectedCityId !== null;

  const handleOpenRoute = () => {
    if (!selectedCityId) return;
    openRoute(airline.hubCityId, selectedCityId);
  };

  const profit = (r: Route) => r.quarterlyRevenue - r.quarterlyCost;

  return (
    <div className="glass rounded-xl p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-semibold text-white mb-3">Route Management</h2>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleOpenRoute}
          disabled={!canOpenRoute}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            canOpenRoute
              ? 'bg-emerald-500/80 hover:bg-emerald-400/80 text-white cursor-pointer'
              : 'bg-white/5 text-white/30 cursor-not-allowed'
          }`}
        >
          + Open New Route
        </button>
        {selectedRoute && (
          <button
            onClick={() => closeRoute(selectedRoute.id)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/60 hover:bg-red-400/60 text-white transition-all cursor-pointer"
          >
            Close Route
          </button>
        )}
      </div>

      {/* Route list */}
      {myRoutes.length === 0 ? (
        <p className="text-white/40 text-sm italic">
          No routes yet. Select a city on the map and open a new route.
        </p>
      ) : (
        <div className="space-y-1">
          {myRoutes.map((route) => {
            const origin = citiesById[route.originCityId];
            const dest = citiesById[route.destinationCityId];
            const routeProfit = profit(route);
            const isProfitable = routeProfit >= 0;
            const isSelected = selectedRouteId === route.id;

            return (
              <div key={route.id}>
                {/* Route row */}
                <button
                  onClick={() => selectRoute(isSelected ? null : route.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white/15 border border-white/20'
                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white font-medium text-sm">
                      {origin?.name ?? route.originCityId} → {dest?.name ?? route.destinationCityId}
                    </span>
                    <span className="text-white/50 text-xs">
                      {Math.round(route.distance).toLocaleString()} km
                    </span>
                  </div>

                  {/* Load factor bar */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-white/40 w-8">Load</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          route.loadFactor > 0.8
                            ? 'bg-emerald-400'
                            : route.loadFactor > 0.5
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                        }`}
                        style={{ width: `${route.loadFactor * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-white/50 w-8 text-right">
                      {formatPercent(route.loadFactor)}
                    </span>
                  </div>

                  {/* Revenue / Cost / Profit */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/40">
                      Rev {formatMoney(route.quarterlyRevenue)} / Cost{' '}
                      {formatMoney(route.quarterlyCost)}
                    </span>
                    <span
                      className={`font-semibold ${
                        isProfitable ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isProfitable ? '+' : ''}
                      {formatMoney(routeProfit)}
                    </span>
                  </div>

                  {route.suspended && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-500/30 text-amber-300 text-[10px] rounded">
                      SUSPENDED
                    </span>
                  )}
                </button>

                {/* Route detail expansion */}
                <AnimatePresence>
                  {isSelected && selectedRoute && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 py-3 mb-1 bg-white/5 rounded-b-lg border border-t-0 border-white/10 space-y-3">
                        {/* Fare sliders */}
                        <div>
                          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                            Fare Levels
                          </h4>
                          <FareSlider
                            label="Economy"
                            value={selectedRoute.fareEconomy}
                            onChange={(v) => adjustFare(selectedRoute.id, 'economy', v)}
                          />
                          {selectedRoute.hasBusinessClass && (
                            <FareSlider
                              label="Business"
                              value={selectedRoute.fareBusiness}
                              onChange={(v) => adjustFare(selectedRoute.id, 'business', v)}
                            />
                          )}
                          {selectedRoute.hasFirstClass && (
                            <FareSlider
                              label="First"
                              value={selectedRoute.fareFirst}
                              onChange={(v) => adjustFare(selectedRoute.id, 'first', v)}
                            />
                          )}
                        </div>

                        {/* Frequency */}
                        <div>
                          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">
                            Weekly Frequency
                          </h4>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                adjustFrequency(
                                  selectedRoute.id,
                                  Math.max(1, selectedRoute.weeklyFrequency - 1)
                                )
                              }
                              className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center cursor-pointer"
                            >
                              -
                            </button>
                            <span className="text-white font-mono text-sm w-16 text-center">
                              {selectedRoute.weeklyFrequency}x / wk
                            </span>
                            <button
                              onClick={() =>
                                adjustFrequency(
                                  selectedRoute.id,
                                  Math.min(14, selectedRoute.weeklyFrequency + 1)
                                )
                              }
                              className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Assigned Aircraft */}
                        <div>
                          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">
                            Assigned Aircraft
                          </h4>
                          {selectedRoute.assignedAircraftId ? (
                            (() => {
                              const ac = ownedAircraft.find(
                                (a) => a.id === selectedRoute.assignedAircraftId
                              );
                              const acType = ac ? aircraftTypesById[ac.typeId] : null;
                              return (
                                <div className="flex items-center justify-between">
                                  <span className="text-white text-sm">
                                    {acType?.name ?? 'Unknown'}
                                  </span>
                                  <button
                                    onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                                    className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer"
                                  >
                                    Change
                                  </button>
                                </div>
                              );
                            })()
                          ) : (
                            <button
                              onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                              className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer"
                            >
                              Assign Aircraft
                            </button>
                          )}

                          {showAssignDropdown && (
                            <div className="mt-1 space-y-1">
                              {availableAircraft.length === 0 ? (
                                <p className="text-white/30 text-xs italic">
                                  No available aircraft
                                </p>
                              ) : (
                                availableAircraft.map((ac) => {
                                  const acType = aircraftTypesById[ac.typeId];
                                  return (
                                    <button
                                      key={ac.id}
                                      onClick={() => {
                                        assignAircraft(selectedRoute.id, ac.id);
                                        setShowAssignDropdown(false);
                                      }}
                                      className="w-full text-left px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white text-xs cursor-pointer"
                                    >
                                      {acType?.name ?? ac.typeId} — Condition:{' '}
                                      {ac.condition}%
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>

                        {/* Market Share */}
                        <div>
                          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">
                            Market Share
                          </h4>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-sky-400 rounded-full"
                                style={{ width: `${selectedRoute.marketShare * 100}%` }}
                              />
                            </div>
                            <span className="text-white text-sm font-mono">
                              {formatPercent(selectedRoute.marketShare)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Fare slider sub-component ---

function FareSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FareLevel;
  onChange: (level: FareLevel) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-white/50 text-xs w-14">{label}</span>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as FareLevel)}
        className="flex-1 h-1 accent-sky-400 cursor-pointer"
      />
      <span className="text-white text-xs w-16 text-right">
        {FARE_LABELS[value]}
      </span>
    </div>
  );
}
