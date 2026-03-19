import { AnimatePresence } from 'framer-motion';
import { useGameStore } from './store/gameStore';
import TitleScreen from './components/screens/TitleScreen';
import SetupScreen from './components/screens/SetupScreen';
import LobbyScreen from './components/screens/LobbyScreen';
import GameScreen from './components/screens/GameScreen';

function App() {
  const currentScreen = useGameStore((s) => s.currentScreen);

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
