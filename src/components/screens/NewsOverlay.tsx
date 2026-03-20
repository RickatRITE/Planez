import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { audioManager } from '../../utils/audioManager';
import { motion } from 'framer-motion';
import type { EventCategory, GameEvent } from '../../types';

function isNegativeEvent(event: GameEvent): boolean {
  const e = event.effect;
  let score = 0;
  if (e.demandMultiplier != null) score += e.demandMultiplier < 1 ? -1 : e.demandMultiplier > 1 ? 1 : 0;
  if (e.fuelCostMultiplier != null) score += e.fuelCostMultiplier > 1 ? -1 : e.fuelCostMultiplier < 1 ? 1 : 0;
  if (e.maintenanceCostMultiplier != null) score += e.maintenanceCostMultiplier > 1 ? -1 : e.maintenanceCostMultiplier < 1 ? 1 : 0;
  if (e.reputationChange != null) score += e.reputationChange < 0 ? -1 : e.reputationChange > 0 ? 1 : 0;
  if (e.cashChange != null) score += e.cashChange < 0 ? -1 : e.cashChange > 0 ? 1 : 0;
  if (e.slotsChange != null) score += e.slotsChange < 0 ? -1 : e.slotsChange > 0 ? 1 : 0;
  if (e.cityAvailable === false) score -= 1;
  return score < 0;
}

const categoryBadge: Record<EventCategory, { icon: string; color: string }> = {
  economic: { icon: '\u{1F4C8}', color: 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/30' },
  industry: { icon: '\u{2708}\uFE0F', color: 'bg-sky-500/20 text-sky-300 ring-sky-400/30' },
  world:    { icon: '\u{1F30D}', color: 'bg-violet-500/20 text-violet-300 ring-violet-400/30' },
  company:  { icon: '\u{1F3E2}', color: 'bg-amber-500/20 text-amber-300 ring-amber-400/30' },
};

function effectSummary(effect: {
  demandMultiplier?: number;
  fuelCostMultiplier?: number;
  maintenanceCostMultiplier?: number;
  reputationChange?: number;
  cashChange?: number;
  slotsChange?: number;
  cityAvailable?: boolean;
}): string[] {
  const parts: string[] = [];

  if (effect.demandMultiplier != null && effect.demandMultiplier !== 1) {
    const pct = Math.round((effect.demandMultiplier - 1) * 100);
    parts.push(`${pct >= 0 ? '+' : ''}${pct}% demand`);
  }
  if (effect.fuelCostMultiplier != null && effect.fuelCostMultiplier !== 1) {
    const pct = Math.round((effect.fuelCostMultiplier - 1) * 100);
    parts.push(`${pct >= 0 ? '+' : ''}${pct}% fuel costs`);
  }
  if (effect.maintenanceCostMultiplier != null && effect.maintenanceCostMultiplier !== 1) {
    const pct = Math.round((effect.maintenanceCostMultiplier - 1) * 100);
    parts.push(`${pct >= 0 ? '+' : ''}${pct}% maintenance`);
  }
  if (effect.reputationChange != null && effect.reputationChange !== 0) {
    parts.push(`${effect.reputationChange > 0 ? '+' : ''}${effect.reputationChange} reputation`);
  }
  if (effect.cashChange != null && effect.cashChange !== 0) {
    parts.push(`${effect.cashChange > 0 ? '+' : ''}$${effect.cashChange}M cash`);
  }
  if (effect.slotsChange != null && effect.slotsChange !== 0) {
    parts.push(`${effect.slotsChange > 0 ? '+' : ''}${effect.slotsChange} airport slots`);
  }
  if (effect.cityAvailable === false) {
    parts.push('City closed');
  }

  return parts;
}

export default function NewsOverlay() {
  const currentYear = useGameStore((s) => s.currentYear);
  const currentQuarter = useGameStore((s) => s.currentQuarter);
  const newsQueue = useGameStore((s) => s.newsQueue);
  const dismissNews = useGameStore((s) => s.dismissNews);

  // Play sound effects based on event sentiment
  useEffect(() => {
    if (newsQueue.length === 0) return;
    const hasNegative = newsQueue.some(isNegativeEvent);
    const hasPositive = newsQueue.some((e) => !isNegativeEvent(e));
    if (hasNegative) audioManager.playBadEvent();
    if (hasPositive) audioManager.playWinning();
  }, [newsQueue]);

  return (
    <motion.div
      key="news-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-lg mx-4 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-white/5">
          <h2 className="text-lg font-bold text-white tracking-wide">
            Q{currentQuarter} {currentYear} &mdash; World News
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          {newsQueue.length === 0 ? (
            <p className="text-white/50 text-center py-8 italic">
              A quiet quarter. No major events.
            </p>
          ) : (
            newsQueue.map((event) => {
              const badge = categoryBadge[event.category];
              const effects = effectSummary(event.effect);

              return (
                <div
                  key={event.id}
                  className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2"
                >
                  {/* Category + Title */}
                  <div className="flex items-start gap-3">
                    <span
                      className={`shrink-0 inline-flex items-center justify-center text-sm px-2 py-0.5 rounded-full ring-1 ${badge.color}`}
                    >
                      {badge.icon}
                    </span>
                    <h3 className="font-semibold text-white leading-tight">
                      {event.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-white/60 leading-relaxed">
                    {event.description}
                  </p>

                  {/* Effects + Duration */}
                  <div className="flex flex-wrap items-center gap-2">
                    {effects.map((eff, i) => (
                      <span
                        key={i}
                        className="text-xs bg-sky-500/15 text-sky-300 px-2 py-0.5 rounded-full ring-1 ring-sky-400/20"
                      >
                        {eff}
                      </span>
                    ))}
                    <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">
                      Lasts {event.duration} quarter{event.duration !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end">
          <button
            onClick={dismissNews}
            className="px-6 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold tracking-wide transition-colors"
          >
            Continue
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
