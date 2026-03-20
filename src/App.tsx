import { useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from './store/gameStore';
import { audioManager } from './utils/audioManager';
import TitleScreen from './components/screens/TitleScreen';
import SetupScreen from './components/screens/SetupScreen';
import LobbyScreen from './components/screens/LobbyScreen';
import GameScreen from './components/screens/GameScreen';

function useHashDebugSync() {
  const screen = useGameStore((s) => s.currentScreen);
  const phase = useGameStore((s) => s.phase);
  const panel = useGameStore((s) => s.activePanel);
  const year = useGameStore((s) => s.currentYear);
  const quarter = useGameStore((s) => s.currentQuarter);
  const turn = useGameStore((s) => s.turnNumber);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const selectedRouteId = useGameStore((s) => s.selectedRouteId);

  useEffect(() => {
    const parts = [`screen=${screen}`];
    if (screen === 'game' || screen === 'results') {
      parts.push(`phase=${phase}`, `panel=${panel}`, `y=${year}`, `q=${quarter}`, `t=${turn}`);
      if (selectedCityId) parts.push(`city=${selectedCityId}`);
      if (selectedRouteId) parts.push(`route=${selectedRouteId}`);
    }
    window.location.hash = parts.join('&');
  }, [screen, phase, panel, year, quarter, turn, selectedCityId, selectedRouteId]);
}

function App() {
  const currentScreen = useGameStore((s) => s.currentScreen);
  const prevScreenRef = useRef(currentScreen);

  useHashDebugSync();

  // Unlock audio on first user interaction
  useEffect(() => {
    const unlock = () => audioManager.unlock();
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Transition background music when the screen changes
  useEffect(() => {
    if (prevScreenRef.current !== currentScreen) {
      prevScreenRef.current = currentScreen;
      audioManager.transitionMusic();
    }
  }, [currentScreen]);

  return (
    <div className="w-full h-full bg-[#0a0e1a]">
      <AnimatePresence mode="wait">
        {currentScreen === 'title' && <TitleScreen key="title" />}
        {currentScreen === 'setup' && <SetupScreen key="setup" />}
        {currentScreen === 'lobby' && <LobbyScreen key="lobby" />}
        {currentScreen === 'game' && <GameScreen key="game" />}
      </AnimatePresence>
    </div>
  );
}

export default App;
