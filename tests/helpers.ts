import { createGame } from '../src/engine/game';
import { tileAt } from '../src/engine/worldgen';
import { STRUCTURES } from '../src/engine/balance';
import type { GameState, PolicyId, StructureType } from '../src/engine/types';

/** A clean, fully revealed board with no neutral infrastructure. */
export function blankState(seed = 7): GameState {
  const state = createGame({ seed, allAI: true });
  for (const tile of state.tiles) {
    tile.structure = null;
    tile.owner = -1;
    tile.revealed = 0b1111;
  }
  for (const player of state.players) {
    player.credits = 100_000;
    player.researchPoints = 5_000;
    player.techs = [];
  }
  state.conditions = {
    ...state.conditions,
    weather: 'clear',
    marketEvent: 'none',
    solar: 1,
    wind: 1,
    cooling: 1,
    hydro: 1,
    elecPrice: 1,
    computePrice: 0.5,
    fuelPrice: 1,
    headline: 'Test conditions',
    description: 'Deterministic test conditions.',
  };
  state.marketSaturation = 1;
  state.report = null;
  return state;
}

export function put(
  state: GameState,
  x: number,
  y: number,
  type: StructureType,
  owner = 0,
  policy: PolicyId = 'max_compute',
  soc = 0,
): void {
  const tile = tileAt(state, x, y);
  if (!tile) throw new Error(`No tile at ${x},${y}`);
  tile.terrain = STRUCTURES[type].build.includes('plains') ? 'plains' : STRUCTURES[type].build[0];
  tile.owner = owner;
  tile.revealed = 0b1111;
  tile.structure = {
    id: state.nextStructureId++,
    type,
    owner,
    policy,
    soc,
    builtTurn: 1,
  };
}
