import { useGameStore } from '../../store/gameStore';
import { motion } from 'framer-motion';

function formatMoney(value: number): string {
  return `$${value.toFixed(1)}M`;
}

export default function ResultsOverlay() {
  const currentYear = useGameStore((s) => s.currentYear);
  const currentQuarter = useGameStore((s) => s.currentQuarter);
  const financialHistory = useGameStore((s) => s.financialHistory);
  const airlines = useGameStore((s) => s.airlines);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const nextTurn = useGameStore((s) => s.nextTurn);

  const airline = airlines[currentPlayerIndex];

  // Find the latest financial report for the current player
  const latestReport = [...financialHistory]
    .filter((r) => r.airlineId === airline.id)
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.quarter - a.quarter;
    })[0];

  const eliminatedAirlines = airlines.filter((a) => a.eliminated);

  return (
    <motion.div
      key="results-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-2xl mx-4 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-white/5">
          <h2 className="text-lg font-bold text-white tracking-wide">
            Q{currentQuarter} {currentYear} &mdash; Quarterly Report
          </h2>
          <p className="text-sm text-white/50 mt-0.5">{airline.name}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto space-y-6">
          {latestReport ? (
            <>
              {/* Revenue vs Costs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                  <p className="text-xs uppercase tracking-widest text-emerald-400/70 mb-1">
                    Revenue
                  </p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {formatMoney(latestReport.revenue)}
                  </p>
                </div>
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
                  <p className="text-xs uppercase tracking-widest text-red-400/70 mb-1">
                    Total Costs
                  </p>
                  <p className="text-2xl font-bold text-red-400">
                    {formatMoney(latestReport.totalCosts)}
                  </p>
                </div>
              </div>

              {/* Profit / Loss */}
              <div className="text-center py-2">
                <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
                  {latestReport.profit >= 0 ? 'Profit' : 'Loss'}
                </p>
                <p
                  className={`text-4xl font-extrabold ${
                    latestReport.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {latestReport.profit >= 0 ? '+' : ''}
                  {formatMoney(latestReport.profit)}
                </p>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-xs text-white/40 mb-1">Passengers</p>
                  <p className="text-lg font-semibold text-white">
                    {latestReport.passengersCarried.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-xs text-white/40 mb-1">Routes</p>
                  <p className="text-lg font-semibold text-white">
                    {latestReport.routeCount}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-xs text-white/40 mb-1">Fleet Size</p>
                  <p className="text-lg font-semibold text-white">
                    {latestReport.fleetSize}
                  </p>
                </div>
              </div>

              {/* Financial Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <p className="text-xs text-white/40 mb-1">Cash Position</p>
                  <p className="text-lg font-semibold text-emerald-300">
                    {formatMoney(latestReport.cash)}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <p className="text-xs text-white/40 mb-1">Stock Price</p>
                  <p className="text-lg font-semibold text-sky-300">
                    ${latestReport.stockPrice.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Cost Breakdown */}
              <details className="group">
                <summary className="cursor-pointer text-xs uppercase tracking-widest text-white/40 hover:text-white/60 transition-colors">
                  Cost Breakdown
                </summary>
                <div className="mt-3 rounded-lg bg-white/5 border border-white/10 divide-y divide-white/5 text-sm">
                  {[
                    { label: 'Fuel', value: latestReport.fuelCosts },
                    { label: 'Crew', value: latestReport.crewCosts },
                    { label: 'Maintenance', value: latestReport.maintenanceCosts },
                    { label: 'Airport Fees', value: latestReport.airportFees },
                    { label: 'Lease Payments', value: latestReport.leaseCosts },
                    { label: 'Loan Interest', value: latestReport.loanInterest },
                    { label: 'Advertising', value: latestReport.advertisingCosts },
                    { label: 'Administration', value: latestReport.adminCosts },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between px-4 py-2"
                    >
                      <span className="text-white/60">{item.label}</span>
                      <span className="text-red-300 font-mono">
                        {formatMoney(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <p className="text-white/50 text-center py-8 italic">
              No financial data available for this quarter.
            </p>
          )}

          {/* Eliminated Airlines Alert */}
          {eliminatedAirlines.length > 0 && (
            <div className="rounded-xl bg-red-900/30 border border-red-500/30 p-4">
              <p className="text-sm font-semibold text-red-300 mb-2">
                Airlines Eliminated
              </p>
              {eliminatedAirlines.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm text-red-200/80">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                  <span>{a.name} has ceased operations.</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end">
          <button
            onClick={nextTurn}
            className="px-6 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold tracking-wide transition-colors"
          >
            Next Quarter
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
