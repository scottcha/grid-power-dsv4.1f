import type { GameResult, GameState, PlayerReport, TurnReport, WinType } from './types';
import { ECONOMY, STRUCTURES, VICTORY } from './balance';
import { Rng } from './rng';
import { techSummary } from './tech';
import { planPower } from './grid';
import { firmCapacity, gridLinkCount, playerScore } from './derived';
import { addLog } from './log';

const EMPTY_REPORT = (playerId: number): PlayerReport => ({
  playerId,
  revenue: 0,
  expenses: 0,
  netProfit: 0,
  powerGen: 0,
  powerDemand: 0,
  powerDelivered: 0,
  curtailed: 0,
  imported: 0,
  exported: 0,
  compute: 0,
  research: 0,
  stability: 0,
  drRevenue: 0,
  fuelCost: 0,
  opex: 0,
  shortfall: 0,
  islands: 0,
  congestedLinks: 0,
  charged: 0,
  discharged: 0,
  outages: 0,
  share: 0,
  creditsAfter: 0,
});

export function resolveTurn(state: GameState, rng: Rng): TurnReport {
  const reports: PlayerReport[] = [];
  const worldNotes: string[] = [...state.pendingNotes];
  state.pendingNotes = [];
  const condition = state.conditions;
  const previousCompute = state.report?.players.reduce((sum, p) => sum + p.compute, 0) ?? 0;
  state.marketSaturation = 1 / (1 + previousCompute / 20000);
  if (state.marketSaturation < 0.86) {
    worldNotes.push(
      `Compute glut: fleet-wide supply cut clearing prices to ${(state.marketSaturation * 100).toFixed(0)}% of spot.`,
    );
  }

  for (const player of state.players) {
    if (player.eliminated) {
      const empty = EMPTY_REPORT(player.id);
      empty.creditsAfter = player.credits;
      reports.push(empty);
      continue;
    }
    const mods = techSummary(player.techs);
    const plan = planPower(state, player.id);

    // Commit battery state of charge from the dispatch plan.
    for (const node of plan.nodes) {
      if (node.kind !== 'storage') continue;
      const tile = state.tiles[node.y * state.width + node.x];
      if (tile?.structure) tile.structure.soc = Math.max(0, Math.min(node.socAfter, 1e9));
    }

    let opex = 0;
    for (const tile of state.tiles) {
      const s = tile.structure;
      if (s && s.owner === player.id) opex += STRUCTURES[s.type].opex * ECONOMY.opexMultiplier;
    }

    let fuelCost = 0;
    let powerGen = 0;
    for (const node of plan.nodes) {
      if (node.kind !== 'generation') continue;
      powerGen += node.produced;
      fuelCost += node.produced * node.marginal;
    }

    let research = ECONOMY.baseResearch;
    for (const node of plan.nodes) {
      const def = STRUCTURES[node.type];
      if (def.dc) {
        const ratio = node.demand > 0.001 ? Math.min(1, node.served / node.demand) : 0;
        research += def.dc.research * ratio;
      } else if (def.labResearch) {
        research += def.labResearch * Math.min(1, node.served);
      }
    }
    research *= 1 + mods.researchPct / 100;

    let compute = plan.compute;
    let computeRevenue = plan.computeRevenue;
    let outages = 0;
    if (plan.stability < 0.34 && rng.next() < (0.36 - plan.stability) * 1.5) {
      outages = 1;
      compute *= 0.7;
      computeRevenue *= 0.7;
      addLog(state, 'bad', `${player.company}: grid instability caused a 30% compute outage.`, player.id);
    }

    const revenue = computeRevenue + plan.exportRevenue + plan.drRevenue;
    const expenses = opex + fuelCost + plan.importCost;
    const netProfit = revenue - expenses;
    player.credits += netProfit;
    player.researchPoints += research;
    player.stats.compute = compute;
    player.stats.revenue = revenue;
    player.stats.expenses = expenses;
    player.stats.netProfit = netProfit;
    player.stats.powerGen = powerGen;
    player.stats.powerUsed = plan.delivered;
    player.stats.stability = plan.stability;
    player.stats.efficiency = plan.dcEfficiency;
    player.stats.lifetimeRevenue += revenue;
    player.stats.lifetimeCompute += compute;

    if (plan.shortfall > 0.5) {
      addLog(
        state,
        'warn',
        `${player.company}: ${plan.shortfall.toFixed(0)} MW of load unserved — data centers throttled${plan.congested > 0 ? ' (transmission congestion)' : ''}.`,
        player.id,
      );
    }
    if (player.credits < ECONOMY.minCredits) {
      player.insolventTurns++;
      addLog(state, 'bad', `${player.company} is insolvent (${player.credits.toFixed(0)} credits).`, player.id);
    } else {
      player.insolventTurns = 0;
    }
    if (player.insolventTurns >= ECONOMY.insolventTurnsToFail) {
      eliminatePlayer(state, player.id);
      worldNotes.push(`${player.company} was wound up by its creditors — assets abandoned.`);
    }

    reports.push({
      playerId: player.id,
      revenue,
      expenses,
      netProfit,
      powerGen,
      powerDemand: plan.demand,
      powerDelivered: plan.delivered,
      curtailed: plan.curtailed,
      imported: plan.imports,
      exported: plan.exports,
      compute,
      research,
      stability: plan.stability,
      drRevenue: plan.drRevenue,
      fuelCost,
      opex,
      shortfall: plan.shortfall,
      islands: plan.islands.length,
      congestedLinks: plan.congested,
      charged: plan.batteryCharge,
      discharged: plan.batteryDischarge,
      outages,
      share: 0,
      creditsAfter: player.credits,
    });
  }

  // Market share of compute.
  const totalCompute = reports.reduce((sum, r) => sum + r.compute, 0);
  for (const report of reports) {
    const player = state.players[report.playerId];
    report.share = totalCompute > 0.001 ? report.compute / totalCompute : 0;
    player.stats.share = report.share;
    player.history.push({
      turn: state.turn,
      credits: player.credits,
      compute: report.compute,
      profit: report.netProfit,
      share: report.share,
    });
    if (player.history.length > 60) player.history.shift();
  }

  return { turn: state.turn, conditions: condition, players: reports, worldNotes };
}

export function eliminatePlayer(state: GameState, playerId: number): void {
  const player = state.players[playerId];
  if (player.eliminated) return;
  player.eliminated = true;
  player.insolventTurns = 0;
  for (const tile of state.tiles) {
    if (tile.structure && tile.structure.owner === playerId) tile.structure = null;
    if (tile.owner === playerId) tile.owner = -1;
  }
  addLog(state, 'bad', `${player.company} has been eliminated.`, playerId);
}

export function checkVictory(state: GameState, report: TurnReport): GameResult | null {
  const cfg = VICTORY;
  const reports = new Map(report.players.map((r) => [r.playerId, r]));

  for (const player of state.players) {
    if (player.eliminated) {
      player.dominanceStreak = 0;
      player.energyStreak = 0;
      player.leadershipStreak = 0;
      continue;
    }
    const r = reports.get(player.id);
    const share = r?.share ?? 0;
    player.dominanceStreak =
      state.turn >= cfg.computeEarliestTurn && share >= cfg.computeShare ? player.dominanceStreak + 1 : 0;

    const energyOk =
      firmCapacity(state, player.id) >= cfg.firmGen &&
      gridLinkCount(state, player.id) >= cfg.gridLinks &&
      player.credits >= cfg.treasury &&
      (r?.netProfit ?? 0) >= cfg.profit;
    player.energyStreak = energyOk ? player.energyStreak + 1 : 0;

    const leadershipOk =
      player.techs.includes('autonomous_fleet') &&
      player.stats.efficiency >= cfg.efficiency &&
      (r?.compute ?? 0) >= 40;
    player.leadershipStreak = leadershipOk ? player.leadershipStreak + 1 : 0;
  }

  const scores = state.players.map((p) => (p.eliminated ? 0 : playerScore(state, p.id)));
  const resultFor = (playerId: number, winType: WinType): GameResult => ({
    winner: playerId,
    winType,
    scores,
    turn: state.turn,
  });

  const computeWinner = state.players
    .filter((p) => !p.eliminated && p.dominanceStreak >= cfg.computeShareTurns)
    .sort((a, b) => b.stats.share - a.stats.share)[0];
  if (computeWinner) return resultFor(computeWinner.id, 'compute');

  const techWinner = state.players.find((p) => !p.eliminated && p.leadershipStreak >= cfg.leadershipTurns);
  if (techWinner) return resultFor(techWinner.id, 'technology');

  const energyWinner = state.players.find((p) => !p.eliminated && p.energyStreak >= cfg.energyTurns);
  if (energyWinner) return resultFor(energyWinner.id, 'energy');

  const human = state.players.find((p) => !p.isAI);
  const aiAlive = state.players.filter((p) => p.isAI && !p.eliminated);
  if (human && human.eliminated) {
    const best = [...aiAlive].sort((a, b) => playerScore(state, b.id) - playerScore(state, a.id))[0];
    if (best) return resultFor(best.id, 'score');
  }
  if (human && aiAlive.length === 0 && !human.eliminated) return resultFor(human.id, 'score');

  if (state.turn >= state.settings.maxTurns) {
    const ranking = state.players.filter((p) => !p.eliminated).sort((a, b) => playerScore(state, b.id) - playerScore(state, a.id));
    if (ranking.length > 0) return resultFor(ranking[0].id, 'score');
  }
  return null;
}
