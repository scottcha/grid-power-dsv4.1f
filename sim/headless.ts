/**
 * Headless match runner: plays complete all-AI games and reports outcomes.
 * Usage: npm run sim -- [games] [startSeed]
 */
import { createGame, endTurn } from '../src/engine/game';
import { STRUCTURES } from '../src/engine/balance';
import { ownedTileCount, ownedStructureCount, planPower } from '../src/engine/grid';
import { firmCapacity } from '../src/engine/derived';
import type { GameState } from '../src/engine/types';

const args = process.argv.slice(2);
const gameCount = Number(args[0] ?? 4);
const startSeed = Number(args[1] ?? 42);

interface MatchResult {
  seed: number;
  winner: string;
  winType: string;
  turn: number;
  ms: number;
  players: Array<{
    company: string;
    score: number;
    credits: number;
    tiles: number;
    structures: number;
    techs: number;
    compute: number;
    share: number;
    firm: number;
    stability: number;
    efficiency: number;
    mix: string;
  }>;
  logSize: number;
}

function checkInvariants(state: GameState, where: string): string[] {
  const issues: string[] = [];
  for (const tile of state.tiles) {
    if (tile.owner !== -1 && (tile.owner < 0 || tile.owner >= state.players.length)) issues.push(`${where}: bad owner ${tile.owner}`);
    const s = tile.structure;
    if (!s) continue;
    if (!STRUCTURES[s.type]) issues.push(`${where}: bad structure ${s.type}`);
    const def = STRUCTURES[s.type];
    if (def.battery) {
      if (!Number.isFinite(s.soc) || s.soc < -1e-6) issues.push(`${where}: battery soc ${s.soc}`);
      const cap = def.battery.capacity * 1.5;
      if (s.soc > cap + 1e-6) issues.push(`${where}: battery soc over cap ${s.soc} > ${cap}`);
    }
  }
  for (const p of state.players) {
    for (const key of ['credits', 'researchPoints'] as const) {
      if (!Number.isFinite(p[key])) issues.push(`${where}: ${p.company} ${key}=${p[key]}`);
    }
    if (!Number.isFinite(p.stats.share)) issues.push(`${where}: ${p.company} share NaN`);
  }
  return issues;
}

function refineMix(state: GameState, playerId: number): string {
  const counts = new Map<string, number>();
  for (const t of state.tiles) {
    if (!t.structure || t.structure.owner !== playerId) continue;
    const key = t.structure.type;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([k, v]) => `${k}:${v}`).join(' ');
}

function play(seed: number): MatchResult {
  const started = performance.now();
  const state = createGame({ seed, allAI: true });
  const issues: string[] = [];
  let guard = 0;
  while (state.phase === 'playing' && guard++ < 60) {
    endTurn(state);
    if (guard % 5 === 0) issues.push(...checkInvariants(state, `seed ${seed} turn ${state.turn}`));
    if (issues.length > 8) break;
  }
  if (issues.length > 0) {
    console.error(`INVARIANTS FAILED seed ${seed}:`);
    for (const issue of issues.slice(0, 8)) console.error('  ' + issue);
  }
  const ms = performance.now() - started;
  const result = state.result;
  const winner = result ? state.players[result.winner] : null;
  // Final-turn power sanity for each player.
  for (const player of state.players) {
    if (player.eliminated) continue;
    const plan = planPower(state, player.id);
    for (const node of plan.nodes) {
      if (node.kind === 'data' && node.served > node.demand + 1e-4) issues.push(`seed ${seed}: served>demand ${player.company}`);
      if (node.kind === 'generation' && node.produced > node.cap + 1e-4) issues.push(`seed ${seed}: produced>cap ${player.company}`);
    }
  }
  return {
    seed,
    winner: winner?.company ?? 'none',
    winType: result?.winType ?? 'none',
    turn: state.turn,
    ms: Math.round(ms),
    logSize: state.log.length,
    players: state.players.map((p) => ({
      company: p.company,
      score: Math.round(result?.scores[p.id] ?? 0),
      credits: Math.round(p.credits),
      tiles: ownedTileCount(state, p.id),
      structures: ownedStructureCount(state, p.id),
      techs: p.techs.length,
      compute: Math.round(p.stats.compute),
      share: Number((p.stats.share * 100).toFixed(1)),
      firm: Math.round(firmCapacity(state, p.id)),
      stability: Number(p.stats.stability.toFixed(2)),
      efficiency: Number(p.stats.efficiency.toFixed(1)),
      mix: refineMix(state, p.id),
    })),
  };
}

const results: MatchResult[] = [];
for (let i = 0; i < gameCount; i++) {
  const seed = startSeed + i;
  const result = play(seed);
  results.push(result);
  console.log(
    `seed ${String(seed).padStart(4)} | turn ${String(result.turn).padStart(2)} | ${result.winner} (${result.winType}) | ${result.ms}ms`,
  );
  for (const p of result.players) {
    console.log(
      `   ${p.company.padEnd(14)} score ${String(p.score).padStart(5)} | $${String(p.credits).padStart(5)} | tiles ${String(p.tiles).padStart(3)} | str ${String(p.structures).padStart(2)} | tech ${p.techs} | CU ${String(p.compute).padStart(4)} (${p.share}%) | firm ${p.firm}MW | stab ${p.stability} | eff ${p.efficiency} | ${p.mix}`,
    );
  }
}

const wins = new Map<string, number>();
for (const r of results) wins.set(`${r.winner}/${r.winType}`, (wins.get(`${r.winner}/${r.winType}`) ?? 0) + 1);
console.log('\nOutcomes:', Object.fromEntries(wins));
console.log(
  `avg turn ${(results.reduce((s, r) => s + r.turn, 0) / results.length).toFixed(1)} · avg ${Math.round(
    results.reduce((s, r) => s + r.ms, 0) / results.length,
  )}ms/match`,
);
