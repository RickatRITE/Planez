import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { FinancialReport } from '../../types';
import { formatMoney } from '../../utils/helpers';

export default function FinancePanel() {
  const {
    airlines,
    currentPlayerIndex,
    financialHistory,
    routes,
    takeLoan,
    repayLoan,
    setAdvertisingBudget,
  } = useGameStore();

  const [loanAmount, setLoanAmount] = useState(10);

  const airline = airlines[currentPlayerIndex];
  if (!airline) return null;

  // Derive current-quarter financials from routes
  const myRoutes = routes.filter((r) => r.airlineId === airline.id);
  const totalRevenue = myRoutes.reduce((sum, r) => sum + r.quarterlyRevenue, 0);
  const totalCost = myRoutes.reduce((sum, r) => sum + r.quarterlyCost, 0);
  const currentProfit = totalRevenue - totalCost;

  // Last financial report for detailed breakdown
  const myHistory = financialHistory.filter((f) => f.airlineId === airline.id);
  const latestReport: FinancialReport | undefined = myHistory[myHistory.length - 1];
  const prevReport: FinancialReport | undefined = myHistory[myHistory.length - 2];

  // Trend helper
  const trend = (current: number, previous: number | undefined): 'up' | 'down' | 'flat' => {
    if (previous === undefined) return 'flat';
    if (current > previous * 1.01) return 'up';
    if (current < previous * 0.99) return 'down';
    return 'flat';
  };

  // Stock price and net worth from latest report or defaults
  const stockPrice = latestReport?.stockPrice ?? 10;
  const netWorth = latestReport?.netWorth ?? airline.cash - airline.loans;

  // Quarterly profits for bar chart (last 8 quarters)
  const chartData = useMemo(() => {
    return myHistory.slice(-8).map((r) => ({
      label: `Q${r.quarter} ${r.year}`,
      value: r.profit,
    }));
  }, [myHistory]);

  const maxAbsProfit = Math.max(
    1,
    ...chartData.map((d) => Math.abs(d.value))
  );

  return (
    <div className="glass rounded-xl p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-semibold text-white mb-3">Financial Dashboard</h2>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <StatCard
          title="Cash"
          value={formatMoney(airline.cash)}
          trend={trend(airline.cash, prevReport?.cash)}
          positiveIsGood
        />
        <StatCard
          title="Revenue"
          value={formatMoney(latestReport?.revenue ?? totalRevenue)}
          trend={trend(latestReport?.revenue ?? totalRevenue, prevReport?.revenue)}
          positiveIsGood
        />
        <StatCard
          title="Costs"
          value={formatMoney(latestReport?.totalCosts ?? totalCost)}
          trend={trend(latestReport?.totalCosts ?? totalCost, prevReport?.totalCosts)}
          positiveIsGood={false}
        />
        <StatCard
          title="Profit"
          value={formatMoney(latestReport?.profit ?? currentProfit)}
          trend={trend(latestReport?.profit ?? currentProfit, prevReport?.profit)}
          positiveIsGood
          valueColor={
            (latestReport?.profit ?? currentProfit) >= 0
              ? 'text-emerald-400'
              : 'text-red-400'
          }
        />
      </div>

      {/* Income statement */}
      {latestReport && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            Income Statement (Q{latestReport.quarter} {latestReport.year})
          </h3>
          <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                <IncomeRow label="Revenue" value={latestReport.revenue} positive />
                <IncomeRow label="Fuel Costs" value={-latestReport.fuelCosts} />
                <IncomeRow label="Crew Costs" value={-latestReport.crewCosts} />
                <IncomeRow label="Maintenance" value={-latestReport.maintenanceCosts} />
                <IncomeRow label="Airport Fees" value={-latestReport.airportFees} />
                <IncomeRow label="Lease Costs" value={-latestReport.leaseCosts} />
                <IncomeRow label="Loan Interest" value={-latestReport.loanInterest} />
                <IncomeRow label="Advertising" value={-latestReport.advertisingCosts} />
                <IncomeRow label="Admin" value={-latestReport.adminCosts} />
                <tr className="border-t border-white/10">
                  <td className="px-3 py-1.5 text-white/60">Total Costs</td>
                  <td className="px-3 py-1.5 text-right text-red-400 font-medium">
                    {formatMoney(-latestReport.totalCosts)}
                  </td>
                </tr>
                <tr className="border-t border-white/20 bg-white/5">
                  <td className="px-3 py-2 text-white font-semibold">Net Profit</td>
                  <td
                    className={`px-3 py-2 text-right font-bold ${
                      latestReport.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {latestReport.profit >= 0 ? '+' : ''}
                    {formatMoney(latestReport.profit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loans section */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
          Loans
        </h3>
        <div className="bg-white/5 rounded-lg border border-white/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-sm">Outstanding Loans</span>
            <span
              className={`text-sm font-semibold ${
                airline.loans > 0 ? 'text-red-400' : 'text-white'
              }`}
            >
              {formatMoney(airline.loans)}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white/40 text-xs">Amount:</span>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={loanAmount}
              onChange={(e) => setLoanAmount(Number(e.target.value))}
              className="flex-1 h-1 accent-sky-400 cursor-pointer"
            />
            <span className="text-white text-xs font-mono w-12 text-right">
              {formatMoney(loanAmount)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => takeLoan(loanAmount)}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/60 hover:bg-sky-400/60 text-white transition-all cursor-pointer"
            >
              Take Loan
            </button>
            <button
              onClick={() => repayLoan(Math.min(loanAmount, airline.loans))}
              disabled={airline.loans <= 0 || airline.cash < 5}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                airline.loans > 0 && airline.cash >= 5
                  ? 'bg-emerald-500/60 hover:bg-emerald-400/60 text-white cursor-pointer'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
            >
              Repay Loan
            </button>
          </div>
        </div>
      </div>

      {/* Advertising budget */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
          Advertising Budget
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={airline.advertisingBudget}
            onChange={(e) => setAdvertisingBudget(Number(e.target.value))}
            className="flex-1 h-1 accent-purple-400 cursor-pointer"
          />
          <span className="text-white text-sm font-mono w-16 text-right">
            {formatMoney(airline.advertisingBudget)}/Q
          </span>
        </div>
      </div>

      {/* Stock price & Net worth */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white/5 rounded-lg border border-white/10 p-3 text-center">
          <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">
            Stock Price
          </p>
          <p className="text-white text-lg font-bold">${stockPrice.toFixed(2)}</p>
        </div>
        <div className="bg-white/5 rounded-lg border border-white/10 p-3 text-center">
          <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">
            Net Worth
          </p>
          <p
            className={`text-lg font-bold ${
              netWorth >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {formatMoney(netWorth)}
          </p>
        </div>
      </div>

      {/* Quarterly profit bar chart */}
      {chartData.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            Quarterly Profit History
          </h3>
          <div className="bg-white/5 rounded-lg border border-white/10 p-3">
            <svg
              viewBox={`0 0 ${chartData.length * 50} 120`}
              className="w-full h-28"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Zero line */}
              <line
                x1="0"
                y1="60"
                x2={chartData.length * 50}
                y2="60"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
              />

              {chartData.map((d, i) => {
                const barHeight = (Math.abs(d.value) / maxAbsProfit) * 50;
                const isPositive = d.value >= 0;
                const y = isPositive ? 60 - barHeight : 60;

                return (
                  <g key={i}>
                    <rect
                      x={i * 50 + 10}
                      y={y}
                      width={30}
                      height={Math.max(1, barHeight)}
                      rx={3}
                      fill={isPositive ? 'rgba(52, 211, 153, 0.7)' : 'rgba(248, 113, 113, 0.7)'}
                    />
                    <text
                      x={i * 50 + 25}
                      y={112}
                      textAnchor="middle"
                      fontSize="8"
                      fill="rgba(255,255,255,0.4)"
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function StatCard({
  title,
  value,
  trend,
  positiveIsGood,
  valueColor,
}: {
  title: string;
  value: string;
  trend: 'up' | 'down' | 'flat';
  positiveIsGood: boolean;
  valueColor?: string;
}) {
  const trendIcon = trend === 'up' ? '\u25B2' : trend === 'down' ? '\u25BC' : '\u25AC';
  const trendClr =
    trend === 'flat'
      ? 'text-white/40'
      : trend === 'up'
      ? positiveIsGood
        ? 'text-emerald-400'
        : 'text-red-400'
      : positiveIsGood
      ? 'text-red-400'
      : 'text-emerald-400';

  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-3">
      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">{title}</p>
      <div className="flex items-end justify-between">
        <p className={`text-lg font-bold ${valueColor ?? 'text-white'}`}>{value}</p>
        <span className={`text-xs ${trendClr}`}>{trendIcon}</span>
      </div>
    </div>
  );
}

function IncomeRow({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <tr className="border-b border-white/5 last:border-b-0">
      <td className="px-3 py-1 text-white/50">{label}</td>
      <td
        className={`px-3 py-1 text-right ${
          positive
            ? 'text-emerald-400'
            : value < 0
            ? 'text-red-400/80'
            : 'text-white/60'
        }`}
      >
        {value >= 0 ? '+' : ''}
        {formatMoney(value)}
      </td>
    </tr>
  );
}
