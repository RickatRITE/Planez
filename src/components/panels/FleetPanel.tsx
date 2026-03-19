import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import type { OwnedAircraft } from '../../types';
import { citiesById } from '../../data/cities';
import { aircraftTypes, aircraftTypesById } from '../../data/aircraft';
import { formatMoney, formatNumber } from '../../utils/helpers';

export default function FleetPanel() {
  const {
    airlines,
    currentPlayerIndex,
    ownedAircraft,
    routes,
    aircraftOrders,
    selectedAircraftId,
    selectAircraft,
    purchaseAircraft,
    sellAircraft,
    currentYear,
    currentQuarter,
  } = useGameStore();

  const airline = airlines[currentPlayerIndex];
  if (!airline) return null;

  const myAircraft = ownedAircraft.filter((a) => a.airlineId === airline.id);
  const myOrders = aircraftOrders.filter((o) => o.airlineId === airline.id);
  const selected = myAircraft.find((a) => a.id === selectedAircraftId);
  const selectedType = selected ? aircraftTypesById[selected.typeId] : null;

  // Filter aircraft types available for purchase in the current era
  const availableTypes = useMemo(() => {
    return aircraftTypes.filter(
      (t) => t.introYear <= currentYear && t.retireYear >= currentYear
    );
  }, [currentYear]);

  const getAircraftStatus = (ac: OwnedAircraft): { label: string; color: string } => {
    if (ac.assignedRouteId) {
      const route = routes.find((r) => r.id === ac.assignedRouteId);
      if (route) {
        const origin = citiesById[route.originCityId];
        const dest = citiesById[route.destinationCityId];
        return {
          label: `${origin?.name ?? '?'} → ${dest?.name ?? '?'}`,
          color: 'text-sky-400',
        };
      }
      return { label: 'Assigned', color: 'text-sky-400' };
    }
    return { label: 'Available', color: 'text-emerald-400' };
  };

  const getAge = (ac: OwnedAircraft): string => {
    const quarters =
      (currentYear - ac.purchaseYear) * 4 + (currentQuarter - ac.purchaseQuarter);
    const years = Math.floor(quarters / 4);
    if (years < 1) return `${quarters}Q`;
    return `${years}y`;
  };

  const getSaleValue = (ac: OwnedAircraft): number => {
    const acType = aircraftTypesById[ac.typeId];
    if (!acType) return 0;
    const ageQuarters =
      (currentYear - ac.purchaseYear) * 4 + (currentQuarter - ac.purchaseQuarter);
    const depreciationRate = Math.max(0.2, 1 - ageQuarters * 0.01);
    return acType.purchasePrice * depreciationRate * 0.6;
  };

  return (
    <div className="glass rounded-xl p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-semibold text-white mb-3">Fleet Management</h2>

      {/* Fleet list */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
          Owned Aircraft ({myAircraft.length})
        </h3>

        {myAircraft.length === 0 ? (
          <p className="text-white/30 text-sm italic">No aircraft owned yet.</p>
        ) : (
          <div className="space-y-1">
            {myAircraft.map((ac) => {
              const acType = aircraftTypesById[ac.typeId];
              const status = getAircraftStatus(ac);
              const isSelected = selectedAircraftId === ac.id;

              return (
                <div key={ac.id}>
                  <button
                    onClick={() => selectAircraft(isSelected ? null : ac.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white/15 border border-white/20'
                        : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-medium">
                        {acType?.name ?? ac.typeId}
                      </span>
                      <span className="text-white/40 text-xs">{getAge(ac)}</span>
                    </div>

                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs ${status.color}`}>{status.label}</span>
                      {ac.isLeased && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/30 text-purple-300 rounded">
                          LEASED
                        </span>
                      )}
                    </div>

                    {/* Condition bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/40 w-12">Condition</span>
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            ac.condition > 70
                              ? 'bg-emerald-400'
                              : ac.condition > 40
                              ? 'bg-amber-400'
                              : 'bg-red-400'
                          }`}
                          style={{ width: `${ac.condition}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-white/50 w-8 text-right">
                        {ac.condition}%
                      </span>
                    </div>
                  </button>

                  {/* Selected aircraft detail */}
                  <AnimatePresence>
                    {isSelected && selected && selectedType && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 py-3 mb-1 bg-white/5 rounded-b-lg border border-t-0 border-white/10">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
                            <StatRow label="Manufacturer" value={selectedType.manufacturer} />
                            <StatRow label="Range" value={`${formatNumber(selectedType.range)} km`} />
                            <StatRow label="Speed" value={`${selectedType.speed} km/h`} />
                            <StatRow
                              label="Capacity"
                              value={`${selectedType.capacity.economy + selectedType.capacity.business + selectedType.capacity.first} pax`}
                            />
                            <StatRow label="Economy" value={`${selectedType.capacity.economy}`} />
                            <StatRow label="Business" value={`${selectedType.capacity.business}`} />
                            <StatRow label="First" value={`${selectedType.capacity.first}`} />
                            <StatRow
                              label="Op. Cost/hr"
                              value={`$${selectedType.operatingCostPerHour}K`}
                            />
                            <StatRow
                              label="Maint./Qtr"
                              value={`$${selectedType.maintenanceCostPerQuarter}K`}
                            />

                            {/* Stat bars */}
                            <div className="col-span-2 mt-1">
                              <MiniBar label="Fuel Eff." value={selectedType.fuelEfficiency} max={10} color="bg-emerald-400" />
                              <MiniBar label="Reliability" value={selectedType.reliability} max={10} color="bg-sky-400" />
                              <MiniBar label="Noise" value={selectedType.noiseRating} max={10} color="bg-purple-400" />
                            </div>
                          </div>

                          {/* Sell button */}
                          <button
                            onClick={() => sellAircraft(selected.id)}
                            className="w-full px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/60 hover:bg-red-400/60 text-white transition-all cursor-pointer"
                          >
                            Sell for {formatMoney(getSaleValue(selected))}
                          </button>
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

      {/* Pending orders */}
      {myOrders.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            Pending Deliveries ({myOrders.length})
          </h3>
          <div className="space-y-1">
            {myOrders.map((order) => {
              const acType = aircraftTypesById[order.aircraftTypeId];
              return (
                <div
                  key={order.id}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-dashed border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">
                      {acType?.name ?? order.aircraftTypeId}
                    </span>
                    <span className="text-amber-400 text-xs">
                      {order.deliveryQuartersRemaining}Q remaining
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-white/40 text-xs">
                      {order.isLease ? 'Lease' : 'Purchase'}
                    </span>
                    <span className="text-white/50 text-xs">
                      {formatMoney(order.cost)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Purchase aircraft */}
      <div>
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
          Purchase Aircraft
        </h3>
        <div className="grid grid-cols-1 gap-1.5">
          {availableTypes.map((acType) => {
            const canAfford = airline.cash >= acType.purchasePrice;
            const totalCap =
              acType.capacity.economy + acType.capacity.business + acType.capacity.first;

            return (
              <button
                key={acType.id}
                onClick={() => purchaseAircraft(acType.id)}
                disabled={!canAfford}
                className={`text-left px-3 py-2.5 rounded-lg border transition-all ${
                  canAfford
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer'
                    : 'bg-white/[0.02] border-white/5 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm font-medium">{acType.name}</span>
                  <span
                    className={`text-sm font-semibold ${
                      canAfford ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {formatMoney(acType.purchasePrice)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/50">
                  <span>{totalCap} pax</span>
                  <span>{formatNumber(acType.range)} km</span>
                  <span>${acType.operatingCostPerHour}K/hr</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Helper sub-components ---

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-white/40">{label}</span>
      <span className="text-white text-right">{value}</span>
    </>
  );
}

function MiniBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-white/40 w-16">{label}</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="text-white/50 w-6 text-right">{value}</span>
    </div>
  );
}
