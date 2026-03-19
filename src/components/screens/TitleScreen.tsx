import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';

// Simple SVG airplane silhouette
const AirplaneSVG = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 64 64"
    fill="currentColor"
    className="text-white/70"
  >
    <path d="M62 30.5L44 24V10c0-3.3-2.7-6-6-6h-4v20L14 18.5 14 14l-6-2v6l-6-2v6l6 2v6l6-2v-4.5L34 30v20h-4l-4 8h12l6-8h-4V30.5z" />
  </svg>
);

export default function TitleScreen() {
  const setScreen = useGameStore((s) => s.setScreen);

  const buttons = [
    { label: 'Local Game', action: () => setScreen('setup'), disabled: false },
    { label: 'Online Multiplayer', action: () => setScreen('lobby'), disabled: false },
    { label: 'Load Game', action: () => {}, disabled: true },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-950">
      {/* Animated gradient background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(30, 58, 138, 0.35) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(15, 23, 42, 0.9) 0%, transparent 60%)',
        }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          background: [
            'radial-gradient(ellipse at 20% 50%, rgba(30, 64, 175, 0.15) 0%, transparent 50%)',
            'radial-gradient(ellipse at 80% 30%, rgba(30, 64, 175, 0.15) 0%, transparent 50%)',
            'radial-gradient(ellipse at 50% 70%, rgba(30, 64, 175, 0.15) 0%, transparent 50%)',
            'radial-gradient(ellipse at 20% 50%, rgba(30, 64, 175, 0.15) 0%, transparent 50%)',
          ],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      />

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Animated airplane crossing the screen */}
      <motion.div
        className="pointer-events-none absolute"
        initial={{ x: '-10vw', y: '25vh', rotate: -5 }}
        animate={{ x: '110vw', y: '15vh', rotate: -5 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear', repeatDelay: 6 }}
      >
        <AirplaneSVG />
      </motion.div>

      {/* Second airplane, slower, different path */}
      <motion.div
        className="pointer-events-none absolute opacity-30"
        initial={{ x: '110vw', y: '60vh', rotate: 175, scale: 0.5 }}
        animate={{ x: '-10vw', y: '55vh', rotate: 175, scale: 0.5 }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear', repeatDelay: 4, delay: 8 }}
      >
        <AirplaneSVG />
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-12 px-4">
        {/* Title block */}
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          <h1
            className="text-6xl font-bold tracking-[0.3em] text-white"
            style={{
              textShadow:
                '0 0 40px rgba(59, 130, 246, 0.5), 0 0 80px rgba(59, 130, 246, 0.2)',
            }}
          >
            PLANEZ
          </h1>
          <motion.p
            className="text-lg tracking-[0.15em] text-blue-300/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
          >
            Global Aviation Domination
          </motion.p>

          {/* Decorative line */}
          <motion.div
            className="mt-2 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"
            initial={{ width: 0 }}
            animate={{ width: 240 }}
            transition={{ delay: 1.2, duration: 1, ease: 'easeOut' }}
          />
        </motion.div>

        {/* Buttons */}
        <div className="flex flex-col items-center gap-4">
          {buttons.map((btn, i) => (
            <motion.button
              key={btn.label}
              onClick={btn.action}
              disabled={btn.disabled}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6 + i * 0.2, duration: 0.6, ease: 'easeOut' }}
              whileHover={btn.disabled ? {} : { scale: 1.04 }}
              whileTap={btn.disabled ? {} : { scale: 0.97 }}
              className={`
                w-64 rounded-xl border px-8 py-3.5 text-sm font-semibold tracking-widest uppercase
                backdrop-blur-md transition-colors duration-200
                ${
                  btn.disabled
                    ? 'cursor-not-allowed border-white/5 bg-white/[0.03] text-white/25'
                    : 'border-white/10 bg-white/[0.06] text-white hover:border-blue-400/30 hover:bg-white/[0.1] hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]'
                }
              `}
            >
              {btn.label}
            </motion.button>
          ))}
        </div>

        {/* Footer */}
        <motion.p
          className="mt-8 text-xs tracking-wider text-white/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.6, duration: 1 }}
        >
          A Modern Remake &middot; 2026
        </motion.p>
      </div>
    </div>
  );
}
