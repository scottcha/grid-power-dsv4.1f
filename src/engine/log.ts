import type { GameState, LogKind } from './types';

export function addLog(state: GameState, kind: LogKind, text: string, player: number | null = null): void {
  state.log.push({ id: state.nextLogId++, turn: state.turn, kind, text, player });
  if (state.log.length > 220) state.log.splice(0, state.log.length - 220);
}
