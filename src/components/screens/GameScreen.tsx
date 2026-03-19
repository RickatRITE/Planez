import { useGameStore } from '../../store/gameStore';
import WorldMap from '../map/WorldMap';
import RoutePanel from '../panels/RoutePanel';
import FleetPanel from '../panels/FleetPanel';
import FinancePanel from '../panels/FinancePanel';
import CompetitorPanel from '../panels/CompetitorPanel';
import NewsOverlay from './NewsOverlay';
import ResultsOverlay from './ResultsOverlay';
import { motion, AnimatePresence } from 'framer-motion';

const panelTabs = [
  { key: 'routes' as const, label: 'Routes' },
  { key: 'fleet' as const, label: 'Fleet' },
  { key: 'finance' as const, label: 'Finance' },
  { key: 'competitors' as const, label: 'Competitors' },
];

function ActivePanel() {
  const activePanel = useGameStore((s) => s.activePanel);

  switch (activePanel) {
    case 'routes':
      return <RoutePanel />;
    case 'fleet':
      return <FleetPanel />;
    case 'finance':
      return <FinancePanel />;
    case 'competitors':
      return <CompetitorPanel />;
    default:
      return null;
  }
}

export default function GameScreen() {
  const currentYear = useGameStore((s) => s.currentYear);
  const currentQuarter = useGameStore((s) => s.currentQuarter);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const activePanel = useGameStore((s) => s.activePanel);
  const setActivePanel = useGameStore((s) => s.setActivePanel);
  const endTurn = useGameStore((s) => s.endTurn);
  const phase = useGameStore((s) => s.phase);
  const airlines = useGameStore((s) => s.airlines);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const activeEvents = useGameStore((s) => s.activeEvents);

  const airline = airlines[currentPlayerIndex];
  if (!airline) return null;

  const showSidePanel = activePanel !== 'map' && activePanel !== 'news';

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* ── Top Bar ── */}
      <div className="h-12 flex items-center justify-between px-4 bg-white/5 backdrop-blur-md border-b border-white/10 shrink-0 z-20">
        {/* Left: Airline identity + time */}
        <div className="flex items-center gap-3 text-sm">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: airline.color }}
          />
          <span className="font-semibold tracking-wide">{airline.name}</span>
          <span className="text-white/50">|</span>
          <span className="text-sky-300 font-mono">
            Q{currentQuarter} {currentYear}
          </span>
          <span className="text-white/40 font-mono">Turn {turnNumber}</span>
        </div>

        {/* Center: Panel tabs */}
        <div className="flex items-center gap-1">
          {panelTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() =>
                setActivePanel(activePanel === tab.key ? 'map' : tab.key)
              }
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activePanel === tab.key
                  ? 'bg-sky-500/30 text-sky-200 ring-1 ring-sky-400/40'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Cash + Actions + End Turn */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-emerald-400 font-mono font-semibold">
            ${airline.cash.toFixed(1)}M
          </span>

          <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ring-amber-400/30">
            {airline.actionsRemaining} actions
          </span>

          <button
            onClick={endTurn}
            disabled={phase !== 'planning'}
            className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold uppercase tracking-wider transition-colors"
          >
            End Turn
          </button>
        </div>
      </div>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-row min-h-0">
        {/* Map */}
        <div className="flex-1 relative">
          <WorldMap />
        </div>

        {/* Side Panel */}
        <AnimatePresence mode="wait">
          {showSidePanel && (
            <motion.div
              key={activePanel}
              initial={{ x: 384, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 384, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-96 border-l border-white/10 bg-slate-900/80 backdrop-blur-md overflow-y-auto shrink-0"
            >
              <ActivePanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="h-8 flex items-center justify-between px-4 bg-white/5 backdrop-blur-md border-t border-white/10 shrink-0 text-xs text-white/50 z-20">
        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className="inline-block"
          >
            {activeEvents.length > 0
              ? activeEvents
                  .map((e) => `${e.title} — ${e.description}`)
                  .join('   ///   ')
              : 'No active events.'}
            {'   ///   '}
          </motion.div>
        </div>

        <span className="ml-4 shrink-0 text-white/40 uppercase tracking-widest">
          {phase}
        </span>
      </div>

      {/* ── Overlays ── */}
      <AnimatePresence>
        {phase === 'news' && <NewsOverlay />}
        {phase === 'results' && <ResultsOverlay />}
      </AnimatePresence>
    </div>
  );
}
