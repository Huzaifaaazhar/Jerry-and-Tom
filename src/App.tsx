import { useEffect, useState } from 'react';
import { useGame } from '@engine/core/store';
import { audio } from '@engine/audio/audio';
import { MainMenu } from './ui/screens/MainMenu';
import { EpisodeSelect } from './ui/screens/EpisodeSelect';
import { CharacterSelect } from './ui/screens/CharacterSelect';
import { HowTo } from './ui/screens/HowTo';
import { Scrapbook } from './ui/screens/Scrapbook';
import { GameView } from './ui/GameView';
import { HUD } from './ui/hud/HUD';
import { PauseMenu } from './ui/hud/PauseMenu';
import { Results } from './ui/hud/Results';
import { TouchControls } from './ui/hud/TouchControls';

function useTouchEnabled() {
  const mode = useGame((s) => s.settings.touchControls);
  const [coarse, setCoarse] = useState(() => globalThis.matchMedia?.('(pointer: coarse)').matches ?? false);
  useEffect(() => {
    const mq = globalThis.matchMedia?.('(pointer: coarse)');
    const on = () => setCoarse(mq.matches);
    mq?.addEventListener('change', on);
    return () => mq?.removeEventListener('change', on);
  }, []);
  return mode === 'on' || (mode === 'auto' && coarse);
}

export function App() {
  const screen = useGame((s) => s.screen);
  const paused = useGame((s) => s.paused);
  const settings = useGame((s) => s.settings);
  const touch = useTouchEnabled();
  useEffect(() => audio.setVolumes(settings.sfxVolume, settings.musicVolume), [settings.sfxVolume, settings.musicVolume]);
  const inGame = screen === 'playing' || screen === 'results';
  return (
    <div className={`app ${touch ? 'touch-mode' : ''}`} onPointerDown={() => audio.unlock()}>
      {inGame && <GameView />}
      {screen === 'menu' && <MainMenu />}
      {screen === 'episodes' && <EpisodeSelect />}
      {screen === 'characters' && <CharacterSelect />}
      {screen === 'howto' && <HowTo />}
      {screen === 'scrapbook' && <Scrapbook />}
      {screen === 'playing' && <HUD />}
      {screen === 'playing' && touch && !paused && <TouchControls />}
      {screen === 'playing' && paused && <PauseMenu />}
      {screen === 'results' && <Results />}
    </div>
  );
}
