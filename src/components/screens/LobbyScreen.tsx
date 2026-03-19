import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import {
  createOnlineGame,
  joinOnlineGame,
  getGameByCode,
  startOnlineGame,
  setPlayerReady,
  subscribeToPlayerUpdates,
  subscribeToGameUpdates,
} from '../../multiplayer/multiplayerService';
import type { GameInfo, PlayerInfo } from '../../multiplayer/multiplayerService';
import { isSupabaseConfigured } from '../../multiplayer/supabaseClient';
import { cities } from '../../data/cities';
import type { Era, Difficulty } from '../../types';

// ── Constants ──────────────────────────────────────────────────

const hubCities = cities.filter((c) => c.hubCity);

const ERAS: { era: Era; years: string; label: string }[] = [
  { era: 1, years: '1963-1983', label: 'Jet Age Dawn' },
  { era: 2, years: '1975-1995', label: 'Deregulation Era' },
  { era: 3, years: '1987-2007', label: 'Global Expansion' },
  { era: 4, years: '2000-2020', label: 'Modern Challenges' },
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

// ── Types ──────────────────────────────────────────────────────

type LobbyTab = 'create' | 'join';

// ── Animation helpers ──────────────────────────────────────────

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.12 * i, duration: 0.45, ease: 'easeOut' as const },
  }),
};

// ── Component ──────────────────────────────────────────────────

export default function LobbyScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startNewGame = useGameStore((s) => s.startNewGame);

  // Tab state
  const [activeTab, setActiveTab] = useState<LobbyTab>('create');

  // ── Create Game state ──────────────────────────────────────
  const [gameName, setGameName] = useState('Planez Match');
  const [selectedEra, setSelectedEra] = useState<Era>(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [gameLength, setGameLength] = useState(20);
  const [createAirlineName, setCreateAirlineName] = useState('Atlas Airways');
  const [createColor, setCreateColor] = useState('#3b82f6');
  const [createHubCity, setCreateHubCity] = useState(hubCities[0]?.id ?? '');
  const [createdGame, setCreatedGame] = useState<{ id: string; code: string } | null>(null);
  const [creating, setCreating] = useState(false);

  // ── Join Game state ────────────────────────────────────────
  const [gameCode, setGameCode] = useState('');
  const [foundGame, setFoundGame] = useState<GameInfo | null>(null);
  const [hostName, setHostName] = useState('');
  const [joinAirlineName, setJoinAirlineName] = useState('Atlas Airways');
  const [joinColor, setJoinColor] = useState('#ef4444');
  const [joinHubCity, setJoinHubCity] = useState('');
  const [finding, setFinding] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [joining, setJoining] = useState(false);

  // ── Shared lobby state ─────────────────────────────────────
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [error, setError] = useState('');

  // Current active game id (for subscriptions)
  const activeGameId = createdGame?.id ?? foundGame?.id ?? null;

  // ── Real-time subscriptions ────────────────────────────────

  useEffect(() => {
    if (!activeGameId) return;

    const unsubPlayers = subscribeToPlayerUpdates(activeGameId, (updatedPlayers: PlayerInfo[]) => {
      setPlayers(updatedPlayers);
    });

    return () => {
      unsubPlayers?.();
    };
  }, [activeGameId]);

  // Subscribe to game status changes (for joiners)
  useEffect(() => {
    if (!activeGameId || !joined) return;

    const unsubGame = subscribeToGameUpdates(activeGameId, (gameStatus: string) => {
      if (gameStatus === 'in_progress') {
        setScreen('game');
      }
    });

    return () => {
      unsubGame?.();
    };
  }, [activeGameId, joined, setScreen]);

  // ── Handlers ───────────────────────────────────────────────

  const handleCreateGame = async () => {
    setError('');
    setCreating(true);
    try {
      const result = await createOnlineGame({
        name: gameName,
        era: selectedEra,
        difficulty,
        gameLength,
        hostAirlineName: createAirlineName,
        hostColor: createColor,
        hostHubCityId: createHubCity,
      });
      setCreatedGame({ id: result.gameId, code: result.gameCode });
      // Host is the first player
      setPlayers([{
        seatIndex: 0,
        airlineName: createAirlineName,
        isReady: false,
        hasSubmittedTurn: false,
        isHost: true,
        lastSeen: new Date().toISOString(),
      }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  const handleFindGame = async () => {
    setError('');
    setFinding(true);
    try {
      const game = await getGameByCode(gameCode.toUpperCase());
      if (!game) {
        setError('Game not found');
        return;
      }
      setFoundGame(game);
      setPlayers(game.players ?? []);
      const host = (game.players ?? []).find((p) => p.isHost);
      setHostName(host?.airlineName ?? 'Unknown');
      // Default hub to first available — PlayerInfo doesn't include hubCityId,
      // so just pick the first hub city
      const available = hubCities[0];
      if (available) setJoinHubCity(available.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Game not found');
    } finally {
      setFinding(false);
    }
  };

  const handleJoinGame = async () => {
    if (!foundGame) return;
    setError('');
    setJoining(true);
    try {
      await joinOnlineGame(foundGame.code, joinAirlineName, joinColor, joinHubCity);
      setJoined(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setJoining(false);
    }
  };

  const handleToggleReady = async () => {
    if (!foundGame) return;
    try {
      await setPlayerReady(foundGame.id);
      setIsReady(!isReady);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update ready status');
    }
  };

  const handleStartGame = async () => {
    if (!createdGame) return;
    setError('');
    try {
      // Start the local game first to get the initial state
      startNewGame(
        selectedEra,
        difficulty,
        gameLength,
        players.map((p) => ({
          name: p.airlineName,
          color: '#3b82f6',
          hubCityId: '',
          playerType: 'human' as const,
          aiPersonality: undefined,
        })),
      );
      // Pass the game state to the server
      const gameState = useGameStore.getState();
      await startOnlineGame(createdGame.id, gameState as any);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start game');
    }
  };

  const handleCopyCode = () => {
    if (!createdGame) return;
    const url = `${window.location.origin}${window.location.pathname}?code=${createdGame.code}`;
    navigator.clipboard.writeText(url);
  };

  // ── Derived ────────────────────────────────────────────────

  const allReady = players.length >= 2 && players.every((p) => p.isReady || p.isHost);
  const availableHubsForJoin = hubCities;

  // ── Render ─────────────────────────────────────────────────

  const configured = isSupabaseConfigured();

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
        className="relative z-10 w-full max-w-[820px] rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-wide text-white">Online Multiplayer</h2>
          <button
            onClick={() => setScreen('title')}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium tracking-wider text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80"
          >
            Back
          </button>
        </div>

        {/* Not configured warning */}
        {!configured && (
          <motion.div
            className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-sm font-medium text-amber-300">
              Online play requires configuration. Set{' '}
              <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs font-mono text-amber-200">
                VITE_SUPABASE_URL
              </code>{' '}
              and{' '}
              <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs font-mono text-amber-200">
                VITE_SUPABASE_ANON_KEY
              </code>{' '}
              in{' '}
              <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs font-mono text-amber-200">
                .env
              </code>
            </p>
          </motion.div>
        )}

        {/* Error display */}
        {error && (
          <motion.div
            className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm text-red-300">{error}</p>
          </motion.div>
        )}

        {/* Tab toggle */}
        {!createdGame && !joined && (
          <div className="mb-6 flex overflow-hidden rounded-xl border border-white/10">
            {(['create', 'join'] as LobbyTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setError('');
                }}
                className={`flex-1 py-3 text-sm font-semibold uppercase tracking-wider transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-white/[0.02] text-white/40 hover:bg-white/[0.06] hover:text-white/60'
                }`}
              >
                {tab === 'create' ? 'Create Game' : 'Join Game'}
              </button>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* CREATE GAME TAB                                          */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === 'create' && !createdGame && (
          <div className="flex flex-col gap-6">
            {/* Game name */}
            <motion.section variants={sectionVariants} initial="hidden" animate="visible" custom={0}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
                Game Name
              </h3>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-blue-500/50 focus:bg-white/[0.06]"
              />
            </motion.section>

            {/* Era selection */}
            <motion.section variants={sectionVariants} initial="hidden" animate="visible" custom={1}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
                Select Era
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {ERAS.map((e) => (
                  <button
                    key={e.era}
                    onClick={() => setSelectedEra(e.era)}
                    className={`rounded-lg border p-3 text-left transition-all duration-200 ${
                      selectedEra === e.era
                        ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_16px_rgba(59,130,246,0.15)]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="text-[10px] font-bold text-white/40">Era {e.era}</div>
                    <div className="mt-0.5 text-[11px] font-medium text-white/70">{e.years}</div>
                    <div className="text-[10px] text-white/40">{e.label}</div>
                  </button>
                ))}
              </div>
            </motion.section>

            {/* Difficulty */}
            <motion.section variants={sectionVariants} initial="hidden" animate="visible" custom={2}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
                Difficulty
              </h3>
              <div className="flex gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
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

            {/* Game length */}
            <motion.section variants={sectionVariants} initial="hidden" animate="visible" custom={3}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
                Game Length
              </h3>
              <div className="flex gap-2">
                {GAME_LENGTHS.map((gl) => (
                  <button
                    key={gl.years}
                    onClick={() => setGameLength(gl.years)}
                    className={`flex-1 rounded-lg border py-2.5 text-center transition-all duration-200 ${
                      gameLength === gl.years
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div
                      className={`text-xs font-semibold ${
                        gameLength === gl.years ? 'text-blue-300' : 'text-white/60'
                      }`}
                    >
                      {gl.label}
                    </div>
                    <div className="text-[10px] text-white/30">{gl.years} years</div>
                  </button>
                ))}
              </div>
            </motion.section>

            {/* Your airline */}
            <motion.section variants={sectionVariants} initial="hidden" animate="visible" custom={4}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
                Your Airline
              </h3>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <input
                  type="text"
                  value={createAirlineName}
                  onChange={(e) => setCreateAirlineName(e.target.value)}
                  placeholder="Airline name"
                  className="mb-3 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-blue-500/50 focus:bg-white/[0.06]"
                />

                {/* Color swatches */}
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-xs text-white/40">Color:</span>
                  <div className="flex gap-1.5">
                    {COLOR_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.value}
                        onClick={() => setCreateColor(swatch.value)}
                        title={swatch.name}
                        className={`h-6 w-6 rounded-full border-2 transition-transform ${
                          createColor === swatch.value
                            ? 'scale-110 border-white'
                            : 'border-transparent hover:scale-110'
                        }`}
                        style={{ backgroundColor: swatch.value }}
                      />
                    ))}
                  </div>
                </div>

                {/* Hub city */}
                <select
                  value={createHubCity}
                  onChange={(e) => setCreateHubCity(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-blue-500/50"
                >
                  {hubCities.map((city) => (
                    <option key={city.id} value={city.id} className="bg-gray-900 text-white">
                      {city.name}, {city.country}
                    </option>
                  ))}
                </select>
              </div>
            </motion.section>

            {/* Create button */}
            <motion.div variants={sectionVariants} initial="hidden" animate="visible" custom={5}>
              <motion.button
                onClick={handleCreateGame}
                disabled={!configured || creating || !createAirlineName.trim()}
                whileHover={configured ? { scale: 1.02 } : {}}
                whileTap={configured ? { scale: 0.98 } : {}}
                className={`w-full rounded-xl border py-3.5 text-sm font-bold uppercase tracking-[0.2em] transition-all duration-200 ${
                  configured && !creating && createAirlineName.trim()
                    ? 'border-blue-500/40 bg-blue-600/20 text-blue-200 shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:bg-blue-600/30'
                    : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20'
                }`}
              >
                {creating ? 'Creating...' : 'Create Game'}
              </motion.button>
            </motion.div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* AFTER CREATING — HOST LOBBY VIEW                         */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === 'create' && createdGame && (
          <motion.div
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Game code display */}
            <div className="flex flex-col items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 py-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400/60">
                Share this code
              </p>
              <p
                className="text-5xl font-bold tracking-[0.3em] text-white"
                style={{
                  textShadow: '0 0 30px rgba(59, 130, 246, 0.4)',
                }}
              >
                {createdGame.code}
              </p>
              <button
                onClick={handleCopyCode}
                className="mt-1 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-1.5 text-xs font-medium tracking-wider text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white/80"
              >
                Copy Link
              </button>
            </div>

            {/* Player list */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
                Players
              </h3>
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((seat) => {
                  const player = players.find((p) => p.seatIndex === seat);
                  return (
                    <motion.div
                      key={seat}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                        player
                          ? 'border-white/10 bg-white/[0.04]'
                          : 'border-white/5 bg-white/[0.02]'
                      }`}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: seat * 0.08 }}
                    >
                      <span className="w-6 text-center text-xs font-bold text-white/30">
                        {seat + 1}
                      </span>
                      {player ? (
                        <>
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: '#3b82f6' }}
                          />
                          <span className="flex-1 text-sm font-medium text-white/80">
                            {player.airlineName}
                            {player.isHost && (
                              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-blue-400/60">
                                Host
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-xs font-semibold uppercase tracking-wider ${
                              player.isReady || player.isHost
                                ? 'text-green-400/80'
                                : 'text-white/30'
                            }`}
                          >
                            {player.isReady || player.isHost ? 'Ready' : 'Not Ready'}
                          </span>
                        </>
                      ) : (
                        <span className="flex-1 text-sm italic text-white/20">Waiting...</span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Start button */}
            <motion.button
              onClick={handleStartGame}
              disabled={!allReady}
              whileHover={allReady ? { scale: 1.02 } : {}}
              whileTap={allReady ? { scale: 0.98 } : {}}
              className={`w-full rounded-xl border py-3.5 text-sm font-bold uppercase tracking-[0.2em] transition-all duration-200 ${
                allReady
                  ? 'border-green-500/40 bg-green-600/20 text-green-200 shadow-[0_0_30px_rgba(34,197,94,0.2)] hover:bg-green-600/30'
                  : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20'
              }`}
            >
              Start Game
            </motion.button>
            {!allReady && (
              <p className="text-center text-xs text-white/30">
                Waiting for at least 2 players, all ready...
              </p>
            )}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* JOIN GAME TAB                                            */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === 'join' && !joined && (
          <div className="flex flex-col gap-6">
            {/* Game code input */}
            <motion.section variants={sectionVariants} initial="hidden" animate="visible" custom={0}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
                Game Code
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="A3X7K2"
                  maxLength={6}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center text-2xl font-bold tracking-[0.3em] text-white placeholder-white/15 outline-none transition-colors focus:border-blue-500/50 focus:bg-white/[0.06]"
                  style={{ fontFamily: 'monospace' }}
                />
                <motion.button
                  onClick={handleFindGame}
                  disabled={gameCode.length !== 6 || !configured || finding}
                  whileHover={gameCode.length === 6 ? { scale: 1.02 } : {}}
                  whileTap={gameCode.length === 6 ? { scale: 0.98 } : {}}
                  className={`rounded-xl border px-6 text-xs font-semibold uppercase tracking-wider transition-all ${
                    gameCode.length === 6 && configured && !finding
                      ? 'border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30'
                      : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20'
                  }`}
                >
                  {finding ? 'Searching...' : 'Find Game'}
                </motion.button>
              </div>
            </motion.section>

            {/* Found game info */}
            {foundGame && (
              <motion.div
                className="flex flex-col gap-5"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                {/* Game info card */}
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <h4 className="mb-2 text-sm font-bold text-white/80">{foundGame.name}</h4>
                  <div className="flex flex-wrap gap-3 text-xs text-white/50">
                    <span>
                      Era {foundGame.era} &middot; {ERAS.find((e) => e.era === foundGame.era)?.label}
                    </span>
                    <span>&middot;</span>
                    <span className="capitalize">{foundGame.difficulty}</span>
                    <span>&middot;</span>
                    <span>Host: {hostName}</span>
                    <span>&middot;</span>
                    <span>{players.length}/4 Players</span>
                  </div>
                </div>

                {/* Your airline setup */}
                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
                    Your Airline
                  </h3>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <input
                      type="text"
                      value={joinAirlineName}
                      onChange={(e) => setJoinAirlineName(e.target.value)}
                      placeholder="Airline name"
                      className="mb-3 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-blue-500/50 focus:bg-white/[0.06]"
                    />

                    {/* Color swatches */}
                    <div className="mb-3 flex items-center gap-3">
                      <span className="text-xs text-white/40">Color:</span>
                      <div className="flex gap-1.5">
                        {COLOR_SWATCHES.map((swatch) => (
                          <button
                            key={swatch.value}
                            onClick={() => setJoinColor(swatch.value)}
                            title={swatch.name}
                            className={`h-6 w-6 rounded-full border-2 transition-transform ${
                              joinColor === swatch.value
                                ? 'scale-110 border-white'
                                : 'border-transparent hover:scale-110'
                            }`}
                            style={{ backgroundColor: swatch.value }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Hub city (exclude taken hubs) */}
                    <select
                      value={joinHubCity}
                      onChange={(e) => setJoinHubCity(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-blue-500/50"
                    >
                      {availableHubsForJoin.map((city) => (
                        <option key={city.id} value={city.id} className="bg-gray-900 text-white">
                          {city.name}, {city.country}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Join button */}
                <motion.button
                  onClick={handleJoinGame}
                  disabled={!joinAirlineName.trim() || !joinHubCity || joining}
                  whileHover={joinAirlineName.trim() ? { scale: 1.02 } : {}}
                  whileTap={joinAirlineName.trim() ? { scale: 0.98 } : {}}
                  className={`w-full rounded-xl border py-3.5 text-sm font-bold uppercase tracking-[0.2em] transition-all duration-200 ${
                    joinAirlineName.trim() && joinHubCity && !joining
                      ? 'border-blue-500/40 bg-blue-600/20 text-blue-200 shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:bg-blue-600/30'
                      : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20'
                  }`}
                >
                  {joining ? 'Joining...' : 'Join Game'}
                </motion.button>
              </motion.div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* AFTER JOINING — PLAYER LOBBY VIEW                        */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === 'join' && joined && foundGame && (
          <motion.div
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Game info */}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <h4 className="mb-1 text-sm font-bold text-white/80">{foundGame.name}</h4>
              <p className="text-xs text-white/40">
                Era {foundGame.era} &middot;{' '}
                <span className="capitalize">{foundGame.difficulty}</span> &middot; Hosted by{' '}
                {hostName}
              </p>
            </div>

            {/* Player list */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400/80">
                Players
              </h3>
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((seat) => {
                  const player = players.find((p) => p.seatIndex === seat);
                  return (
                    <div
                      key={seat}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                        player
                          ? 'border-white/10 bg-white/[0.04]'
                          : 'border-white/5 bg-white/[0.02]'
                      }`}
                    >
                      <span className="w-6 text-center text-xs font-bold text-white/30">
                        {seat + 1}
                      </span>
                      {player ? (
                        <>
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: '#3b82f6' }}
                          />
                          <span className="flex-1 text-sm font-medium text-white/80">
                            {player.airlineName}
                            {player.isHost && (
                              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-blue-400/60">
                                Host
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-xs font-semibold uppercase tracking-wider ${
                              player.isReady || player.isHost
                                ? 'text-green-400/80'
                                : 'text-white/30'
                            }`}
                          >
                            {player.isReady || player.isHost ? 'Ready' : 'Not Ready'}
                          </span>
                        </>
                      ) : (
                        <span className="flex-1 text-sm italic text-white/20">Waiting...</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ready toggle */}
            <motion.button
              onClick={handleToggleReady}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full rounded-xl border py-3.5 text-sm font-bold uppercase tracking-[0.2em] transition-all duration-200 ${
                isReady
                  ? 'border-green-500/40 bg-green-600/20 text-green-200 shadow-[0_0_30px_rgba(34,197,94,0.2)]'
                  : 'border-white/10 bg-white/[0.06] text-white/60 hover:border-blue-400/30 hover:bg-white/[0.1]'
              }`}
            >
              {isReady ? 'Ready!' : 'Click When Ready'}
            </motion.button>

            <p className="text-center text-xs text-white/30">
              Waiting for the host to start the game...
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
