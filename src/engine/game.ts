import type { GameSettings, GameState, Player, TurnReport } from './types';
import { GAME_VERSION, ECONOMY, MAP, PLAYER_IDENTITIES, VICTORY } from './balance';
import { Rng } from './rng';
import { generateWorld, tileAt } from './worldgen';
import { makeForecast, rollConditions } from './market';
import { resolveTurn, checkVictory } from './resolve';
import { addLog } from './log';
import { takeAITurn } from './ai';

export interface CreateGameOptions {
  seed?: number;
  mapSize?: number;
  difficulty?: GameSettings['difficulty'];
  allAI?: boolean;
  maxTurns?: number;
}

export function createGame(options: CreateGameOptions = {}): GameState {
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  const mapSize = options.mapSize ?? MAP.standard;
  const difficulty = options.difficulty ?? 'standard';
  const settings: GameSettings = {
    mapSize,
    aiCount: MAP.players - 1,
    maxTurns: options.maxTurns ?? VICTORY.maxTurns,
    seed,
    difficulty,
  };

  const world = generateWorld(seed, mapSize, mapSize, MAP.players);
  const rng = new Rng(seed ^ 0x51ed270b);

  const players: Player[] = PLAYER_IDENTITIES.slice(0, MAP.players).map((identity, id) => ({
    id,
    company: identity.company,
    ceo: identity.ceo,
    persona: identity.persona,
    isAI: options.allAI ? true : id !== 0,
    eliminated: false,
    credits: ECONOMY.startingCredits,
    researchPoints: ECONOMY.startingResearch,
    techs: [],
    defaultPolicy: 'max_compute',
    insolventTurns: 0,
    stats: {
      compute: 0,
      revenue: 0,
      expenses: 0,
      netProfit: 0,
      powerGen: 0,
      powerUsed: 0,
      stability: 0.8,
      share: 0.25,
      lifetimeRevenue: 0,
      lifetimeCompute: 0,
      efficiency: 0,
    },
    history: [],
    dominanceStreak: 0,
    leadershipStreak: 0,
    energyStreak: 0,
  }));

  const state: GameState = {
    version: GAME_VERSION,
    seed,
    rngState: rng.state,
    turn: 1,
    settings,
    width: world.width,
    height: world.height,
    tiles: world.tiles,
    players,
    conditions: rollConditions(rng),
    forecast: makeForecast(rng),
    marketSaturation: 1,
    log: [],
    nextLogId: 1,
    nextStructureId: 100,
    report: null,
    phase: 'playing',
    result: null,
    pendingNotes: [],
  };

  world.starts.forEach((spot, playerId) => {
    placeStart(state, playerId, spot.x, spot.y);
  });

  addLog(state, 'info', `Season 1 — the grid opens. ${state.conditions.headline}: ${state.conditions.description}`);
  addLog(
    state,
    'info',
    'Claim land, connect generation to data centers, and sell compute. First to dominate the market wins.',
  );
  state.rngState = rng.state;
  return state;
}

function placeStart(state: GameState, playerId: number, cx: number, cy: number): void {
  const player = state.players[playerId];
  const offsets: Array<[number, number, 'dc' | 'sub' | 'solar' | 'claim']> = [
    [0, 0, 'dc'],
    [1, 0, 'sub'],
    [1, 1, 'solar'],
    [0, 1, 'claim'],
    [-1, 0, 'claim'],
  ];
  for (const [dx, dy, role] of offsets) {
    const tile = tileAt(state, cx + dx, cy + dy);
    if (!tile) continue;
    if (tile.structure && tile.structure.owner === -1) tile.structure = null;
    if (tile.terrain === 'ocean') tile.terrain = 'coast';
    if (role === 'dc' || role === 'sub' || role === 'solar') tile.terrain = 'plains';
    tile.owner = playerId;
  }
  const dcTile = tileAt(state, cx, cy);
  const subTile = tileAt(state, cx + 1, cy);
  const solarTile = tileAt(state, cx + 1, cy + 1);
  if (dcTile) {
    dcTile.structure = {
      id: state.nextStructureId++,
      type: 'edge_dc',
      owner: playerId,
      policy: player.defaultPolicy,
      soc: 0,
      builtTurn: 1,
    };
  }
  if (subTile) {
    subTile.structure = {
      id: state.nextStructureId++,
      type: 'substation',
      owner: playerId,
      policy: 'max_compute',
      soc: 0,
      builtTurn: 1,
    };
  }
  if (solarTile) {
    solarTile.structure = {
      id: state.nextStructureId++,
      type: 'solar',
      owner: playerId,
      policy: 'max_compute',
      soc: 0,
      builtTurn: 1,
    };
  }
  for (const t of state.tiles) {
    if (Math.max(Math.abs(t.x - cx), Math.abs(t.y - cy)) <= MAP.revealRadiusStart) t.revealed |= 1 << playerId;
  }
  addLog(state, 'build', `${player.company} commissioned a starter data center and solar farm.`, playerId);
}

/** Run rival build phases, resolve production, then advance the calendar. */
export function endTurn(state: GameState): TurnReport | null {
  if (state.phase !== 'playing') return state.report;
  const rng = new Rng(state.rngState);
  for (const player of state.players) {
    if (player.isAI && !player.eliminated) takeAITurn(state, player.id, rng);
  }
  const report = resolveTurn(state, rng);
  state.report = report;
  const result = checkVictory(state, report);
  if (result) {
    state.result = result;
    state.phase = 'gameover';
    const winner = state.players[result.winner];
    const how = {
      compute: 'Compute Dominance',
      energy: 'Energy Empire',
      technology: 'Technology Leadership',
      score: 'final score',
    }[result.winType];
    addLog(state, 'victory', `${winner.company} wins by ${how} on turn ${result.turn}.`, winner.id);
  } else {
    state.turn += 1;
    state.conditions = state.forecast.conditions;
    state.forecast = makeForecast(rng);
    addLog(state, 'weather', `Turn ${state.turn} — ${state.conditions.headline}. ${state.conditions.description}`);
    if (state.conditions.marketEvent !== 'none') {
      addLog(
        state,
        'market',
        `Electricity $${state.conditions.elecPrice.toFixed(2)}/MW · Compute $${state.conditions.computePrice.toFixed(2)}/CU · Fuel $${state.conditions.fuelPrice.toFixed(2)}`,
      );
    }
  }
  state.rngState = rng.state;
  return report;
}
