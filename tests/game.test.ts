import { describe, expect, it } from 'vitest';
import { blankState, put } from './helpers';
import {
  buildStructure,
  claimTile,
  claimCost,
  demolishFacility,
  researchTech,
  setDataCenterPolicy,
  surveyArea,
  upgradeFacility,
  isRevealed,
} from '../src/engine/actions';
import { planPower } from '../src/engine/grid';
import { createGame, endTurn } from '../src/engine/game';
import { checkVictory, eliminatePlayer, resolveTurn } from '../src/engine/resolve';
import { parseGame, serializeGame } from '../src/engine/save';
import { Rng } from '../src/engine/rng';
import { canResearch, structureUnlocked, techSummary } from '../src/engine/tech';
import { playerScore, firmCapacity, gridLinkCount } from '../src/engine/derived';
import { tileAt } from '../src/engine/worldgen';
import { STRUCTURES } from '../src/engine/balance';
import type { GameState, PlayerReport, TurnReport } from '../src/engine/types';

function reportWith(state: GameState, shares: number[], profits = 10): TurnReport {
  const players: PlayerReport[] = state.players.map((p, i) => ({
    playerId: p.id,
    revenue: 100,
    expenses: 100 - profits,
    netProfit: profits,
    powerGen: 0,
    powerDemand: 0,
    powerDelivered: 0,
    curtailed: 0,
    imported: 0,
    exported: 0,
    compute: i === 0 ? 100 : 50,
    research: 5,
    stability: 0.9,
    drRevenue: 0,
    fuelCost: 0,
    opex: 0,
    shortfall: 0,
    islands: 1,
    congestedLinks: 0,
    charged: 0,
    discharged: 0,
    outages: 0,
    share: shares[i] ?? 0,
    creditsAfter: p.credits,
  }));
  return { turn: state.turn, conditions: state.conditions, players, worldNotes: [] };
}

describe('territory and construction', () => {
  it('claims adjacent land and charges an escalating price', () => {
    const state = blankState();
    state.players[0].credits = 500;
    put(state, 5, 5, 'edge_dc');
    const target = tileAt(state, 6, 5)!;
    target.owner = -1;
    target.structure = null;
    const before = state.players[0].credits;
    const price = claimCost(state, 0, target);
    expect(claimTile(state, 0, 6, 5).ok).toBe(true);
    expect(target.owner).toBe(0);
    expect(state.players[0].credits).toBe(before - price);
    expect(isRevealed(target, 0)).toBe(true);

    // Far away tiles cannot be claimed out of thin air.
    const far = tileAt(state, 1, 1)!;
    far.owner = -1;
    far.structure = null;
    expect(claimTile(state, 0, 1, 1).ok).toBe(false);
    expect(far.owner).toBe(-1);

    // Cost rises with empire size.
    for (let x = 2; x <= 10; x++) {
      const tile = tileAt(state, x, 8)!;
      tile.owner = 0;
      tile.terrain = 'plains';
    }
    expect(claimCost(state, 0, target)).toBeGreaterThan(price);
  });

  it('acquires neutral substations when their tile is claimed', () => {
    const state = blankState();
    state.players[0].credits = 500;
    put(state, 5, 5, 'edge_dc');
    put(state, 6, 5, 'substation', -1);
    const price = claimCost(state, 0, tileAt(state, 6, 5)!);
    expect(claimTile(state, 0, 6, 5).ok).toBe(true);
    expect(tileAt(state, 6, 5)?.structure?.owner).toBe(0);
    expect(price).toBeGreaterThan(10);
  });

  it('enforces terrain, ownership and technology when building', () => {
    const state = blankState();
    state.players[0].credits = 1000;
    put(state, 5, 5, 'edge_dc');
    const plot = tileAt(state, 6, 5)!;
    plot.owner = 0;
    plot.terrain = 'plains';
    plot.structure = null;

    expect(buildStructure(state, 0, 'solar', 6, 5).ok).toBe(true);
    expect(tileAt(state, 6, 5)?.structure?.owner).toBe(0);

    // Wrong terrain.
    const riverPlot = tileAt(state, 7, 5)!;
    riverPlot.owner = 0;
    riverPlot.terrain = 'plains';
    riverPlot.structure = null;
    expect(buildStructure(state, 0, 'hydro', 7, 5).ok).toBe(false);

    // Unowned plot.
    const wild = tileAt(state, 9, 9)!;
    wild.owner = -1;
    wild.structure = null;
    wild.terrain = 'plains';
    expect(buildStructure(state, 0, 'solar', 9, 9).ok).toBe(false);

    // Locked by technology.
    const nucPlot = tileAt(state, 8, 5)!;
    nucPlot.owner = 0;
    nucPlot.terrain = 'plains';
    nucPlot.structure = null;
    expect(buildStructure(state, 0, 'nuclear', 8, 5).ok).toBe(false);
    state.players[0].techs = ['hv_transmission', 'modular_substations', 'advanced_nuclear'];
    expect(buildStructure(state, 0, 'nuclear', 8, 5).ok).toBe(true);
    expect(structureUnlocked(state.players[0], 'nuclear')).toBe(true);

    // Affordability.
    state.players[0].credits = 0;
    const poorPlot = tileAt(state, 4, 5)!;
    poorPlot.owner = 0;
    poorPlot.terrain = 'plains';
    poorPlot.structure = null;
    expect(buildStructure(state, 0, 'wind', 4, 5).ok).toBe(false);
  });

  it('upgrades data centers only with the right technology and cash', () => {
    const state = blankState();
    put(state, 5, 5, 'edge_dc');
    state.players[0].credits = 1000;
    expect(upgradeFacility(state, 0, 5, 5).ok).toBe(false);
    state.players[0].techs = ['modular_datacenters'];
    expect(upgradeFacility(state, 0, 5, 5).ok).toBe(true);
    expect(tileAt(state, 5, 5)?.structure?.type).toBe('hyper_dc');
    expect(upgradeFacility(state, 0, 5, 5).ok).toBe(false);
    state.players[0].techs.push('liquid_cooling', 'efficient_gpus', 'ai_accelerators', 'ai_factory');
    expect(upgradeFacility(state, 0, 5, 5).ok).toBe(true);
    expect(tileAt(state, 5, 5)?.structure?.type).toBe('giga_dc');
  });

  it('demolishes owned facilities for salvage', () => {
    const state = blankState();
    put(state, 5, 5, 'solar');
    const before = state.players[0].credits;
    expect(demolishFacility(state, 0, 5, 5).ok).toBe(true);
    expect(tileAt(state, 5, 5)?.structure).toBe(null);
    expect(state.players[0].credits).toBeGreaterThan(before);
  });

  it('surveys distant fog but rejects out-of-range requests', () => {
    const state = blankState();
    state.players[0].credits = 100;
    put(state, 5, 5, 'edge_dc');
    const target = tileAt(state, 8, 5)!;
    target.revealed = 0;
    expect(surveyArea(state, 0, 8, 5).ok).toBe(true);
    expect(isRevealed(target, 0)).toBe(true);
    const far = tileAt(state, 17, 17)!;
    far.revealed = 0;
    expect(surveyArea(state, 0, 17, 17).ok).toBe(false);
  });
});

describe('research', () => {
  it('enforces prerequisites and spends points', () => {
    const state = blankState();
    const player = state.players[0];
    player.researchPoints = 500;
    expect(researchTech(state, 0, 'ai_accelerators').ok).toBe(false);
    expect(researchTech(state, 0, 'efficient_gpus').ok).toBe(true);
    expect(player.researchPoints).toBe(500 - 34);
    expect(canResearch(player, 'ai_accelerators')).toBe(true);
    expect(researchTech(state, 0, 'ai_accelerators').ok).toBe(true);
    expect(player.techs).toContain('ai_accelerators');
    player.researchPoints = 10;
    expect(researchTech(state, 0, 'advanced_cooling').ok).toBe(false);
  });

  it('folds technology modifiers into generation, PUE and compute', () => {
    const mods = techSummary(['solar_cells', 'advanced_cooling', 'efficient_gpus', 'hv_transmission']);
    expect(mods.solarPct).toBe(25);
    expect(mods.pueDelta).toBeLessThan(0);
    expect(mods.computePct).toBeGreaterThan(10);
    expect(mods.linkPct).toBe(50);
  });
});

describe('dispatch policies and markets', () => {
  it('sheds flexible load and earns demand-response income in an emergency', () => {
    const state = blankState();
    put(state, 5, 5, 'edge_dc', 0, 'max_compute');
    put(state, 6, 5, 'substation');
    put(state, 7, 5, 'solar');
    state.conditions.marketEvent = 'grid_emergency';
    const rigid = planPower(state, 0);
    setDataCenterPolicy(state, 0, 5, 5, 'grid_flexible');
    const flexible = planPower(state, 0);
    expect(flexible.demand).toBeLessThan(rigid.demand);
    expect(flexible.drRevenue).toBeGreaterThan(0);
    expect(flexible.compute).toBeLessThan(rigid.compute);
  });

  it('responds to cooling weather and PUE technology', () => {
    const state = blankState();
    put(state, 5, 5, 'edge_dc');
    put(state, 6, 5, 'solar');
    put(state, 6, 6, 'solar');
    put(state, 6, 7, 'solar');
    const base = planPower(state, 0);
    state.players[0].techs = ['advanced_cooling'];
    const cooled = planPower(state, 0);
    expect(cooled.demand).toBeLessThan(base.demand);
    expect(cooled.dcEfficiency).toBeGreaterThan(base.dcEfficiency);
    state.players[0].techs = [];
    state.conditions.cooling = 1.2;
    expect(planPower(state, 0).demand).toBeGreaterThan(base.demand);
  });

  it('resolves a turn and credits the treasury', () => {
    const state = blankState();
    state.turn = 1;
    put(state, 5, 5, 'edge_dc');
    put(state, 6, 5, 'solar');
    const rng = new Rng(11);
    const before = state.players[0].credits;
    const report = resolveTurn(state, rng);
    const mine = report.players[0];
    expect(mine.compute).toBeGreaterThan(0);
    expect(mine.powerDelivered).toBeGreaterThan(0);
    expect(state.players[0].credits).toBeCloseTo(before + mine.netProfit, 6);
    expect(mine.netProfit).toBeCloseTo(mine.revenue - mine.expenses, 6);
    expect(state.players[0].stats.compute).toBeGreaterThan(0);
  });
});

describe('victory conditions', () => {
  it('awards compute dominance after three turns above the threshold', () => {
    const state = blankState();
    state.turn = 20;
    const report = reportWith(state, [0.7, 0.1, 0.1, 0.1]);
    expect(checkVictory(state, report)).toBe(null);
    expect(checkVictory(state, report)).toBe(null);
    const result = checkVictory(state, report);
    expect(result?.winner).toBe(0);
    expect(result?.winType).toBe('compute');
  });

  it('requires the threshold to be sustained', () => {
    const state = blankState();
    state.turn = 20;
    expect(checkVictory(state, reportWith(state, [0.7, 0.1, 0.1, 0.1]))).toBe(null);
    expect(checkVictory(state, reportWith(state, [0.2, 0.3, 0.3, 0.2]))).toBe(null);
    expect(state.players[0].dominanceStreak).toBe(0);
  });

  it('awards an energy empire with firm capacity, links, cash and profit', () => {
    const state = blankState();
    state.turn = 22;
    state.players[0].credits = 300;
    for (let i = 0; i < 3; i++) put(state, 5 + i, 5, 'nuclear');
    for (let i = 0; i < 12; i++) put(state, 2 + i, 8, 'line');
    expect(firmCapacity(state, 0)).toBeGreaterThanOrEqual(130);
    expect(gridLinkCount(state, 0)).toBeGreaterThanOrEqual(12);
    const report = reportWith(state, [0.2, 0.3, 0.3, 0.2], 50);
    expect(checkVictory(state, report)).toBe(null);
    const result = checkVictory(state, report);
    expect(result?.winner).toBe(0);
    expect(result?.winType).toBe('energy');
  });

  it('awards technology leadership at the efficiency target', () => {
    const state = blankState();
    state.turn = 25;
    state.players[0].techs = ['autonomous_fleet'];
    state.players[0].stats.efficiency = 15;
    const report = reportWith(state, [0.2, 0.3, 0.3, 0.2]);
    expect(checkVictory(state, report)).toBe(null);
    expect(checkVictory(state, report)?.winType).toBe('technology');
  });

  it('reaches technology leadership with a realistically optimised campus', () => {
    const state = blankState();
    state.players[0].techs = [
      'efficient_gpus',
      'advanced_cooling',
      'liquid_cooling',
      'ai_accelerators',
      'ai_factory',
      'gpu_power_limits',
      'dynamic_power',
      'workload_scheduling',
      'adaptive_inference',
      'demand_response',
      'autonomous_fleet',
    ];
    put(state, 5, 5, 'giga_dc');
    const campus = tileAt(state, 5, 5)!;
    campus.terrain = 'coast';
    put(state, 6, 5, 'nuclear');
    put(state, 6, 6, 'substation');
    state.turn = 25;
    const report = resolveTurn(state, new Rng(5));
    expect(state.players[0].stats.efficiency).toBeGreaterThanOrEqual(14);
    const mine = report.players[0];
    expect(mine.compute).toBeGreaterThan(40);
    expect(checkVictory(state, report)).toBe(null);
    expect(checkVictory(state, report)?.winType).toBe('technology');
  });

  it('falls back to score at the turn limit', () => {
    const state = blankState();
    state.turn = state.settings.maxTurns;
    state.players[0].credits = 50;
    state.players[1].credits = 5000;
    state.players[2].credits = 120;
    state.players[3].credits = 80;
    const result = checkVictory(state, reportWith(state, [0.2, 0.3, 0.3, 0.2]));
    expect(result?.winType).toBe('score');
    expect(result?.winner).toBe(1);
    expect(playerScore(state, 1)).toBeGreaterThan(playerScore(state, 0));
  });

  it('winds up insolvent companies and strips their assets', () => {
    const state = blankState();
    put(state, 5, 5, 'edge_dc');
    state.tiles[5 * state.width + 5].owner = 0;
    eliminatePlayer(state, 0);
    expect(state.players[0].eliminated).toBe(true);
    expect(state.tiles[5 * state.width + 5].structure).toBe(null);
    expect(state.tiles[5 * state.width + 5].owner).toBe(-1);
  });
});

describe('persistence and determinism', () => {
  it('round-trips serialized state', () => {
    const state = createGame({ seed: 99, allAI: true });
    endTurn(state);
    const raw = serializeGame(state);
    const parsed = parseGame(raw);
    expect(parsed).not.toBe(null);
    expect(parsed?.turn).toBe(state.turn);
    expect(parsed?.players[0].credits).toBe(state.players[0].credits);
    expect(parsed?.tiles.length).toBe(state.tiles.length);
    expect(parsed?.tiles[80].terrain).toBe(state.tiles[80].terrain);
    expect(parseGame('{"version":1}')).toBe(null);
    expect(parseGame('not json')).toBe(null);
  });

  it('produces identical games from the same seed and decisions', () => {
    const a = createGame({ seed: 1234, allAI: true });
    const b = createGame({ seed: 1234, allAI: true });
    for (let i = 0; i < 6; i++) {
      endTurn(a);
      endTurn(b);
    }
    expect(JSON.stringify(a.tiles)).toBe(JSON.stringify(b.tiles));
    expect(JSON.stringify(a.players.map((p) => [p.credits, p.stats.compute, p.techs]))).toBe(
      JSON.stringify(b.players.map((p) => [p.credits, p.stats.compute, p.techs])),
    );
    expect(a.conditions).toEqual(b.conditions);
    expect(a.forecast).toEqual(b.forecast);
  });
});

describe('AI opponents', () => {
  it('build legal empires and finish a full match', () => {
    const state = createGame({ seed: 4242, allAI: true });
    let guard = 0;
    while (state.phase === 'playing' && guard++ < 50) endTurn(state);
    expect(state.phase).toBe('gameover');
    expect(state.result).not.toBe(null);
    for (const player of state.players) {
      expect(Number.isFinite(player.credits)).toBe(true);
      const owned = state.tiles.filter((t) => t.owner === player.id);
      for (const tile of owned) {
        expect(tile.owner).toBe(player.id);
        if (tile.structure) {
          expect(tile.structure.owner).toBe(player.id);
          expect(STRUCTURES[tile.structure.type]).toBeTruthy();
          expect(STRUCTURES[tile.structure.type].build).toContain(tile.terrain);
        }
      }
    }
    for (const player of state.players) {
      const plan = planPower(state, player.id);
      for (const node of plan.nodes) {
        expect(node.produced).toBeGreaterThanOrEqual(-1e-6);
        expect(node.served).toBeGreaterThanOrEqual(-1e-6);
        expect(node.produced).toBeLessThanOrEqual(node.cap + 1e-4);
      }
    }
  });
});
