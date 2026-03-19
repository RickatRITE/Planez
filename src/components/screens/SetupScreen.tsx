import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { cities } from '../../data/cities';
import type { Era, Difficulty, AiPersonality, PlayerType } from '../../types';

// ── Constants ──────────────────────────────────────────────────

const hubCities = cities.filter((c) => c.hubCity);

const ERAS: { era: Era; years: string; label: string }[] = [
  { era: 1, years: '1963–1983', label: 'Jet Age Dawn' },
  { era: 2, years: '1975–1995', label: 'Deregulation Era' },
  { era: 3, years: '1987–2007', label: 'Global Expansion' },
  { era: 4, years: '2000–2020', label: 'Modern Challenges' },
];

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'ruthless'];

const GAME_LENGTHS: { label: string; years: number }[] = [
  { label: 'Short', years: 15 },
  { label: 'Standard', years: 20 },
  { label: 'Marathon', years: 30 },
];

const COLOR_SWATCHES = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
];

const AI_PERSONALITIES: AiPersonality[] = ['aggressive', 'conservative', 'regional', 'global'];

const DEFAULT_PLAYERS: PlayerConfig[] = [
  { name: 'Atlas Airways', color: '#3b82f6', hubCityId: 'new_york', playerType: 'human', aiPersonality: 'aggressive' },
  { name: 'Meridian Air', color: '#ef4444', hubCityId: 'london', playerType: 'cpu', aiPersonality: 'conservative' },
  { name: 'Zephyr Airlines', color: '#22c55e', hubCityId: 'tokyo', playerType: 'cpu', aiPersonality: 'regional' },
  { name: 'Polaris Aviation', color: '#f59e0b', hubCityId: 'sydney', playerType: 'cpu', aiPersonality: 'global' },
];

// ── Types ──────────────────────────────────────────────────────

interface PlayerConfig {
  name: string;
  color: string;
  hubCityId: string;
  playerType: PlayerType;
  aiPersonality: AiPersonality;
}

// ── Animation helpers ──────────────────────────────────────────

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 * i, duration: 0.5, ease: 'easeOut' as const },
  }),
};

// ── Component ──────────────────────────────────────────────────

export default function SetupScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startNewGame = useGameStore((s) => s.startNewGame);

  const [selectedEra, setSelectedEra] = useState<Era>(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [gameLength, setGameLength] = useState(20);
  const [players, setPlayers] = useState<PlayerConfig[]>(DEFAULT_PLAYERS);

  // ── Validation ────────────────────────────────────────────

  const hasDuplicateHubs = useMemo(() => {
    const hubs = players.map((p) => p.hubCityId);
    return new Set(hubs).size !== hubs.length;
  }, [players]);

  const hasEmptyNames = useMemo(() => {
    return players.some((p) => p.name.trim() === '');
  }, [players]);

  const canStart = !hasDuplicateHubs && !hasEmptyNames;

  // ── Handlers ──────────────────────────────────────────────

  const updatePlayer = (index: number, patch: Partial<PlayerConfig>) => {
    setPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  };

  const handleStart = () => {
    if (!canStart) return;
    startNewGame(selectedEra, difficulty, gameLength, players);
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-auto bg-gray-950 p-6">
      {/* Background gradient */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(30, 58, 138, 0.2) 0%, transparent 60%)',
        }}
      />

      <motion.div
        className="relative z-10 w-full max-w-[800px] rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' as const }}
      >
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-wide text-white">Game Setup</h2>
          <button
            onClick={() => setScreen('title')}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium tracking-wider text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80"
          >
            Back
          </button>
        </div>

        {/* ── 1. Era Selection ──────────────────────────────────── */}
        <motion.section
          className="mb-8"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
            Select Era
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {ERAS.map((e) => (
              <button
                key={e.era}
                onClick={() => setSelectedEra(e.era)}
                className={`rounded-xl border p-4 text-left transition-all duration-200 ${
                  selectedEra === e.era
                    ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                }`}
              >
                <div className="text-xs font-bold text-white/40">Era {e.era}</div>
                <div className="mt-1 text-xs font-medium text-white/70">{e.years}</div>
                <div className="mt-0.5 text-[11px] text-white/40">{e.label}</div>
              </button>
            ))}
          </div>
        </motion.section>

        {/* ── 2. Difficulty ─────────────────────────────────────── */}
        <motion.section
          className="mb-8"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
            Difficulty
          </h3>
          <div className="flex gap-3">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                  difficulty === d
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:bg-white/[0.06] hover:text-white/70'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </motion.section>

        {/* ── 3. Player Setup ──────────────────────────────────── */}
        <motion.section
          className="mb-8"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          custom={2}
        >
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
            Airlines
          </h3>
          <div className="flex flex-col gap-3">
            {players.map((player, idx) => {
              const hubUsedByOther = players.some(
                (p, i) => i !== idx && p.hubCityId === player.hubCityId,
              );
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  {/* Row label */}
                  <div className="mb-3 flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: player.color }}
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                      Airline {idx + 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-4">
                    {/* Left column: name + hub + type */}
                    <div className="flex flex-col gap-3">
                      {/* Airline name */}
                      <input
                        type="text"
                        value={player.name}
                        onChange={(e) => updatePlayer(idx, { name: e.target.value })}
                        placeholder="Airline name"
                        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-blue-500/50 focus:bg-white/[0.06]"
                      />

                      <div className="flex gap-3">
                        {/* Hub city */}
                        <div className="flex-1">
                          <select
                            value={player.hubCityId}
                            onChange={(e) => updatePlayer(idx, { hubCityId: e.target.value })}
                            className={`w-full rounded-lg border bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-blue-500/50 ${
                              hubUsedByOther
                                ? 'border-red-500/50'
                                : 'border-white/10'
                            }`}
                          >
                            {hubCities.map((city) => (
                              <option
                                key={city.id}
                                value={city.id}
                                className="bg-gray-900 text-white"
                              >
                                {city.name}, {city.country}
                              </option>
                            ))}
                          </select>
                          {hubUsedByOther && (
                            <p className="mt-1 text-[10px] text-red-400">
                              Hub already chosen by another airline
                            </p>
                          )}
                        </div>

                        {/* Human / CPU toggle */}
                        <div className="flex overflow-hidden rounded-lg border border-white/10">
                          {(['human', 'cpu'] as PlayerType[]).map((type) => (
                            <button
                              key={type}
                              onClick={() => updatePlayer(idx, { playerType: type })}
                              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                                player.playerType === type
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-white/[0.02] text-white/30 hover:bg-white/[0.06] hover:text-white/50'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>

                        {/* AI Personality (visible only for CPU) */}
                        {player.playerType === 'cpu' && (
                          <select
                            value={player.aiPersonality}
                            onChange={(e) =>
                              updatePlayer(idx, {
                                aiPersonality: e.target.value as AiPersonality,
                              })
                            }
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white outline-none transition-colors focus:border-blue-500/50"
                          >
                            {AI_PERSONALITIES.map((p) => (
                              <option key={p} value={p} className="bg-gray-900 text-white">
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Right column: color swatches */}
                    <div className="grid grid-cols-4 gap-1.5 self-center">
                      {COLOR_SWATCHES.map((swatch) => (
                        <button
                          key={swatch.value}
                          onClick={() => updatePlayer(idx, { color: swatch.value })}
                          title={swatch.name}
                          className={`h-6 w-6 rounded-full border-2 transition-transform ${
                            player.color === swatch.value
                              ? 'scale-110 border-white'
                              : 'border-transparent hover:scale-110'
                          }`}
                          style={{ backgroundColor: swatch.value }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* ── 4. Game Length ────────────────────────────────────── */}
        <motion.section
          className="mb-10"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
            Game Length
          </h3>
          <div className="flex gap-3">
            {GAME_LENGTHS.map((gl) => (
              <button
                key={gl.years}
                onClick={() => setGameLength(gl.years)}
                className={`flex-1 rounded-xl border py-3 text-center transition-all duration-200 ${
                  gameLength === gl.years
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                }`}
              >
                <div
                  className={`text-sm font-semibold ${
                    gameLength === gl.years ? 'text-blue-300' : 'text-white/60'
                  }`}
                >
                  {gl.label}
                </div>
                <div className="mt-0.5 text-[11px] text-white/30">{gl.years} years</div>
              </button>
            ))}
          </div>
        </motion.section>

        {/* ── 5. Start Button ──────────────────────────────────── */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          custom={4}
        >
          <motion.button
            onClick={handleStart}
            disabled={!canStart}
            whileHover={canStart ? { scale: 1.02 } : {}}
            whileTap={canStart ? { scale: 0.98 } : {}}
            className={`w-full rounded-xl border py-4 text-sm font-bold uppercase tracking-[0.2em] transition-all duration-200 ${
              canStart
                ? 'border-blue-500/40 bg-blue-600/20 text-blue-200 shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:bg-blue-600/30 hover:shadow-[0_0_40px_rgba(59,130,246,0.3)]'
                : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20'
            }`}
          >
            Launch Airlines
          </motion.button>
          {hasDuplicateHubs && (
            <p className="mt-2 text-center text-xs text-red-400/70">
              Each airline must have a unique hub city.
            </p>
          )}
          {hasEmptyNames && (
            <p className="mt-2 text-center text-xs text-red-400/70">
              All airlines must have a name.
            </p>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
