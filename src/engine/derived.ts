import type { GameState, Player, StructureType } from './types';
import { STRUCTURES, VICTORY } from './balance';
import { ownedTileCount } from './grid';
import { techOutputPct } from './compute';
import { techSummary } from './tech';

const FIRM_TYPES: StructureType[] = ['nuclear', 'hydro', 'geothermal', 'gas'];

export function firmCapacity(state: GameState, playerId: number): number {
  let total = 0;
  for (const tile of state.tiles) {
    const s = tile.structure;
    if (!s || s.owner !== playerId) continue;
    const def = STRUCTURES[s.type];
    if (!def.generation || !FIRM_TYPES.includes(s.type)) continue;
    total += def.generation.mw * (s.type === 'gas' ? 0.5 : 1);
  }
  return total;
}

/** Nameplate generation (weather-independent), used for planning reserves. */
export function installedGeneration(state: GameState, playerId: number): number {
  const mods = techSummary(state.players[playerId].techs);
  let total = 0;
  for (const tile of state.tiles) {
    const s = tile.structure;
    if (!s || s.owner !== playerId) continue;
    const def = STRUCTURES[s.type];
    if (!def.generation) continue;
    total += def.generation.mw * (1 + techOutputPct(s.type, mods) / 100);
  }
  return total;
}

export function gridLinkCount(state: GameState, playerId: number): number {
  let total = 0;
  for (const tile of state.tiles) {
    const s = tile.structure;
    if (!s || s.owner !== playerId) continue;
    if (s.type === 'line' || s.type === 'substation') total++;
  }
  return total;
}

export function playerScore(state: GameState, playerId: number): number {
  const player = state.players[playerId];
  const cfg = VICTORY.score;
  return (
    player.stats.lifetimeRevenue * cfg.perRevenue +
    player.techs.length * cfg.perTech +
    ownedTileCount(state, playerId) * cfg.perTile +
    player.stats.share * cfg.perShare +
    Math.max(-50, player.credits) * cfg.perCredit
  );
}

export function ranking(state: GameState): Array<{ player: Player; score: number }> {
  return state.players
    .filter((p) => !p.eliminated)
    .map((p) => ({ player: p, score: playerScore(state, p.id) }))
    .sort((a, b) => b.score - a.score);
}

export interface VictoryProgress {
  computeShare: number;
  computeStreak: number;
  computeGoal: number;
  computeTurns: number;
  firmGen: number;
  firmGoal: number;
  gridLinks: number;
  gridGoal: number;
  treasury: number;
  treasuryGoal: number;
  profit: number;
  profitGoal: number;
  efficiency: number;
  efficiencyGoal: number;
  hasUltimate: boolean;
  leadershipStreak: number;
  leadershipTurns: number;
  energyStreak: number;
  energyTurns: number;
}

export function victoryProgress(state: GameState, playerId: number): VictoryProgress {
  const player = state.players[playerId];
  const report = state.report?.players.find((r) => r.playerId === playerId);
  return {
    computeShare: player.stats.share,
    computeStreak: player.dominanceStreak,
    computeGoal: VICTORY.computeShare,
    computeTurns: VICTORY.computeShareTurns,
    firmGen: firmCapacity(state, playerId),
    firmGoal: VICTORY.firmGen,
    gridLinks: gridLinkCount(state, playerId),
    gridGoal: VICTORY.gridLinks,
    treasury: player.credits,
    treasuryGoal: VICTORY.treasury,
    profit: report?.netProfit ?? 0,
    profitGoal: VICTORY.profit,
    efficiency: player.stats.efficiency,
    efficiencyGoal: VICTORY.efficiency,
    hasUltimate: player.techs.includes('autonomous_fleet'),
    leadershipStreak: player.leadershipStreak,
    leadershipTurns: VICTORY.leadershipTurns,
    energyStreak: player.energyStreak,
    energyTurns: VICTORY.energyTurns,
  };
}
