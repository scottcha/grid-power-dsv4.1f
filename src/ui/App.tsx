import type { JSX } from 'react';
import { useGame } from './store';
import { MainMenu } from './MainMenu';
import { GameView } from './GameView';

export function App(): JSX.Element {
  const screen = useGame((s) => s.screen);
  return screen === 'menu' ? <MainMenu /> : <GameView />;
}
