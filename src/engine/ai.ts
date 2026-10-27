import type { GameState, PolicyId, StructureType, Tile } from './types';
import {
  DIFFICULTY,
  MARKET,
  PERSONA_WEIGHTS,
  STRUCTURES,
  TERRAIN_INFO,
  type PersonaWeights,
} from './balance';
import { Rng } from './rng';
import { planPower, playerStructures } from './grid';
import { installedGeneration } from './derived';
import { buildCost } from './compute';
import {
  canBuild,
  claimCost,
  claimCandidates,
  claimTile,
  buildStructure,
  canUpgrade,
  upgradeFacility,
  researchTech,
  setDataCenterPolicy,
  buildCandidates,
} from './actions';
import { availableTechs, structureUnlocked, techSummary } from './tech';

/** Optional trace of AI decisions, used by the headless balance harness. */
export const AI_TRACE: string[] = [];

interface BuildOption {
  kind: 'claim' | 'build' | 'upgrade';
  score: number;
  type: StructureType;
  tile: Tile;
  cost: number;
}

const ADJ = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as Array<[number, number]>;

function ownStructureAt(state: GameState, x: number, y: number, playerId: number) {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
  const tile = state.tiles[y * state.width + x];
  return tile.structure && tile.structure.owner === playerId ? tile.structure : null;
}

function adjacentOwnGrid(state: GameState, tile: Tile, playerId: number): boolean {
  for (const [dx, dy] of ADJ) {
    const s = ownStructureAt(state, tile.x + dx, tile.y + dy, playerId);
    if (s && (s.type === 'line' || s.type === 'substation')) return true;
  }
  return false;
}

function adjacentOwnStructures(state: GameState, tile: Tile, playerId: number): number {
  let count = 0;
  for (const [dx, dy] of ADJ) if (ownStructureAt(state, tile.x + dx, tile.y + dy, playerId)) count++;
  return count;
}

function typeWeight(type: StructureType, persona: PersonaWeights): number {
  switch (type) {
    case 'solar':
    case 'wind':
      return 0.8 + persona.renewable * 0.6;
    case 'hydro':
      return 0.7 + persona.renewable * 0.35;
    case 'geothermal':
      return 0.9 + persona.grid * 0.2;
    case 'gas':
      return 0.6 + (1 / persona.renewable) * 0.6;
    case 'nuclear':
      return 0.8 + persona.compute * 0.3;
    case 'battery':
      return 0.3 + persona.storage * 0.9;
    case 'line':
    case 'substation':
      return 0.4 + persona.grid * 0.8;
    case 'lab':
      return 0.4 + persona.research * 0.5;
    case 'edge_dc':
    case 'hyper_dc':
    case 'giga_dc':
      return 0.5 + persona.compute * 0.7;
    default:
      return 1;
  }
}

function placementScore(state: GameState, tile: Tile, type: StructureType, playerId: number): number {
  const info = TERRAIN_INFO[tile.terrain];
  switch (type) {
    case 'solar':
      return 0.7 + info.solar * 0.6;
    case 'wind':
      return 0.7 + info.wind * 0.6;
    case 'hydro':
    case 'geothermal':
      return 1.3;
    case 'gas':
      return 1.15;
    case 'nuclear':
      return 0.9 + info.cooling * 0.2;
    case 'line':
      return 1 + adjacentOwnStructures(state, tile, playerId) * 0.15;
    case 'substation':
      return 1 + adjacentOwnStructures(state, tile, playerId) * 0.2;
    case 'edge_dc':
    case 'hyper_dc':
    case 'giga_dc':
      return 0.7 + info.cooling * 0.5;
    default:
      return 1;
  }
}

export function takeAITurn(state: GameState, playerId: number, rng: Rng): void {
  const player = state.players[playerId];
  if (player.eliminated || state.phase !== 'playing') return;
  const persona = PERSONA_WEIGHTS[player.persona];
  const diff = DIFFICULTY[state.settings.difficulty];
  const aggression = diff.aiAggression;
  const beforeStructures = countCategory(state, playerId, 'generation') +
    countCategory(state, playerId, 'grid') +
    countCategory(state, playerId, 'data') +
    countCategory(state, playerId, 'storage') +
    countCategory(state, playerId, 'research');
  const beforeTiles = state.tiles.filter((t) => t.owner === playerId).length;

  // Policy posture responds to market conditions and corporate identity.
  let policy: PolicyId = 'max_compute';
  if (state.conditions.marketEvent === 'grid_emergency') {
    policy = player.persona === 'titan' ? 'max_profit' : 'grid_flexible';
  } else if (player.stats.stability < 0.55) {
    policy = 'reliability_first';
  } else if (state.conditions.computePrice < MARKET.computeBase * 0.85) {
    policy = 'max_profit';
  } else if (player.persona === 'volt') {
    policy = 'grid_flexible';
  }
  if (policy !== player.defaultPolicy) {
    player.defaultPolicy = policy;
    for (const tile of state.tiles) {
      const s = tile.structure;
      if (s && s.owner === playerId && STRUCTURES[s.type].dc) {
        setDataCenterPolicy(state, playerId, tile.x, tile.y, policy);
      }
    }
  }

  // Research: spend RP toward the branch the persona values.
  const branchWeight = {
    compute: persona.compute,
    energy: persona.renewable,
    optimization: persona.research,
    infrastructure: persona.grid,
  };
  for (let i = 0; i < 2; i++) {
    const options = availableTechs(player).filter((t) => t.id !== 'autonomous_fleet' || state.turn > 15);
    if (options.length === 0) break;
    const dcCount = countCategory(state, playerId, 'data');
    const scored = options
      .map((t) => {
        let score = (branchWeight[t.branch] * 120) / t.cost + (t.ultimate ? 40 : 0) + rng.next() * 2;
        if (t.fx.unlock?.includes('hyper_dc') && dcCount >= 3) score += 30;
        if (t.fx.unlock?.includes('giga_dc') && dcCount >= 4) score += 35;
        if (t.id === 'advanced_nuclear' && state.turn > 12 && player.stats.stability < 0.8) score += 28;
        if (t.ultimate && state.turn > 22) score += 70;
        return { t, score };
      })
      .sort((a, b) => b.score - a.score);
    if (!researchTech(state, playerId, scored[0].t.id).ok) break;
  }

  const reserve = Math.max(2, 8 - persona.risk * 6);
  const maxActions = (player.credits > 1200 ? 6 : 4) + (diff.aiBudget > 1 ? 1 : 0);
  let claimsThisTurn = 0;
  let transmissionBuilt = 0;
  const maxClaims = player.persona === 'helios' ? 3 : 2;

  for (let step = 0; step < maxActions; step++) {
    const plan = planPower(state, playerId);
    const available = player.credits - reserve;
    if (available < 3) break;
    const options: BuildOption[] = [];
    const mods = techSummary(player.techs);

    // Claims are secondary to construction: keep a small buffer of usable plots.
    const emptyOwnedTiles = state.tiles.filter((t) => t.owner === playerId && !t.structure);
    if (claimsThisTurn < maxClaims && emptyOwnedTiles.length < 4 && player.credits > 30) {
      const all = claimCandidates(state, playerId);
      const contiguous = all.filter((t) => adjacentOwnStructures(state, t, playerId) > 0);
      const pool = contiguous.length > 0 ? contiguous : all;
      for (const tile of pool) {
        const cost = claimCost(state, playerId, tile);
        if (cost > available - 8) continue;
        const info = TERRAIN_INFO[tile.terrain];
        let value = 1.5 + info.claimValue * 1.4 + persona.expansion * (0.8 + rng.next() * 0.6);
        if (tile.structure && tile.structure.owner === -1) value += 14;
        if (adjacentOwnGrid(state, tile, playerId)) value += 4;
        if (adjacentOwnStructures(state, tile, playerId) >= 2) value += 1;
        options.push({ kind: 'claim', type: 'line', tile, cost, score: (value - cost * 0.3) * aggression });
      }
    }

    const reserveTarget = plan.demand * (state.turn >= 12 ? 1.25 : 1.02);
    const installed = installedGeneration(state, playerId);
    const genGap = reserveTarget - installed;
    const stranded = plan.curtailed;
    const genTypes: StructureType[] = ['solar', 'wind', 'gas', 'geothermal', 'hydro'];
    if (player.techs.includes('advanced_nuclear')) genTypes.push('nuclear');
    for (const type of genTypes) {
      for (const tile of buildCandidates(state, playerId, type)) {
        if (adjacentOwnStructures(state, tile, playerId) === 0) continue;
        const cost = buildCost(type, mods);
        if (cost > available) continue;
        let value: number;
        const headroom = installed - plan.demand;
        if (genGap > 0.5) {
          value = 26 + genGap * 1.8;
          if (stranded > 2) value *= 0.5;
        } else if (headroom < 22 && countCategory(state, playerId, 'data') > 0) {
          // Stay one step ahead of the next data center.
          value = 12 + (22 - headroom) * 1.0;
        } else {
          value = 1.5 + persona.renewable;
          if (state.forecast.conditions.marketEvent === 'grid_emergency') value += 2;
        }
        value *= typeWeight(type, persona) * placementScore(state, tile, type, playerId);
        value *= diversityPenalty(state, playerId, type);
        value *= weatherRisk(type, state.forecast.conditions.weather);
        if (state.turn > 12 && plan.stability < 0.8 && (type === 'gas' || type === 'geothermal' || type === 'nuclear')) {
          value *= 1.4;
        }
        options.push({ kind: 'build', type, tile, cost, score: value - cost * 0.14 });
      }
    }

    const dcCount = countCategory(state, playerId, 'data');
    for (const type of ['edge_dc', 'hyper_dc', 'giga_dc'] as StructureType[]) {
      const def = STRUCTURES[type];
      if (!def.dc || !structureUnlocked(player, type)) continue;
      for (const tile of buildCandidates(state, playerId, type)) {
        if (adjacentOwnStructures(state, tile, playerId) === 0) continue;
        const cost = buildCost(type, mods);
        if (cost > available) continue;
        const headroom = installed - plan.demand;
        let value = 30 + persona.compute * 7;
        value *= typeWeight(type, persona) * placementScore(state, tile, type, playerId);
        value *= diversityPenalty(state, playerId, type);
        if (plan.shortfall > 0.5) value *= 0.05;
        else if (headroom < def.dc.it * def.dc.pue) value *= 0.04;
        else if (headroom < def.dc.it * def.dc.pue * 1.4) value *= 0.22;
        if (expectedDcProfit(state, player, type) < 8) value *= 0.2;
        if (dcCount < 3) value *= 1.4;
        value *= Math.max(0.55, 1 - dcCount * 0.02);
        if (state.conditions.computePrice > MARKET.computeBase * 1.05) value *= 1.2;
        if (state.forecast.conditions.computePrice > MARKET.computeBase * 1.1) value *= 1.1;
        options.push({ kind: 'build', type, tile, cost, score: value - cost * 0.08 });
      }
    }

    const batteryCount = countStructures(state, playerId, 'battery');
    const storageUseful =
      stranded > 6 ||
      plan.shortfall > 2 ||
      state.forecast.conditions.marketEvent === 'grid_emergency' ||
      (player.persona === 'volt' && batteryCount < 3);
    if (storageUseful) {
      for (const tile of buildCandidates(state, playerId, 'battery')) {
        if (adjacentOwnStructures(state, tile, playerId) === 0) continue;
        const cost = buildCost('battery', mods);
        if (cost > available) continue;
        let value = 3 + persona.storage * 5 - batteryCount * 6;
        if (stranded > 8) value += 14;
        if (state.forecast.conditions.marketEvent === 'grid_emergency') value += 18;
        if (plan.shortfall > 2) value += 8;
        options.push({ kind: 'build', type: 'battery', tile, cost, score: value - cost * 0.1 });
      }
    }

    const subCount = countStructures(state, playerId, 'substation');
    const lineCount = countStructures(state, playerId, 'line');
    const congested = plan.congested > 0;
    const transmissionUseful =
      transmissionBuilt === 0 &&
      (congested || (subCount === 0 && player.credits > 220));
    if (transmissionUseful) {
      for (const type of ['line', 'substation'] as StructureType[]) {
        for (const tile of buildCandidates(state, playerId, type)) {
          if (adjacentOwnStructures(state, tile, playerId) === 0) continue;
          const cost = buildCost(type, mods);
          if (cost > available) continue;
          const emptyAdjacent = emptyOwnedTiles.filter(
            (e) => Math.max(Math.abs(e.x - tile.x), Math.abs(e.y - tile.y)) === 1,
          ).length;
          let value = 4 + persona.grid * 4;
          if (congested) value += 18;
          if (type === 'substation' && subCount === 0) value += 12;
          value += emptyAdjacent * 3;
          value -= type === 'line' ? Math.max(0, lineCount - 6) * 3 : subCount * 4;
          value *= placementScore(state, tile, type, playerId);
          options.push({ kind: 'build', type, tile, cost, score: value - cost * 0.1 });
        }
      }
    }

    const labCount = countStructures(state, playerId, 'lab');
    for (const tile of buildCandidates(state, playerId, 'lab')) {
      if (adjacentOwnStructures(state, tile, playerId) === 0) continue;
      const cost = buildCost('lab', mods);
      if (cost > available) continue;
      let value = 10 + persona.research * 8 - labCount * 9;
      if (state.turn < 7) value *= 0.45;
      if (value > 2) options.push({ kind: 'build', type: 'lab', tile, cost, score: value - cost * 0.1 });
    }

    for (const ref of playerStructures(state, playerId)) {
      const check = canUpgrade(state, playerId, ref.tile.x, ref.tile.y);
      if (!check.ok || !check.cost || !check.to) continue;
      if (check.cost > available) continue;
      const def = STRUCTURES[check.to];
      const oldDef = STRUCTURES[ref.structure.type];
      const headroom = installed - plan.demand;
      const addedLoad = def.dc && oldDef.dc ? def.dc.it * def.dc.pue - oldDef.dc.it * oldDef.dc.pue : 0;
      let value = 30 + persona.compute * 8 + (ref.structure.type === 'edge_dc' ? 6 : 0);
      if (plan.shortfall > 0.5 || headroom < addedLoad * 1.35) value *= 0.05;
      if (expectedDcProfit(state, player, check.to) < 8) value *= 0.2;
      options.push({
        kind: 'upgrade',
        type: check.to,
        tile: ref.tile,
        cost: check.cost,
        score: value - check.cost * 0.07,
      });
    }

    options.sort((a, b) => b.score - a.score);
    const best = options.find((o) => o.score > 1);
    if (!best) {
      AI_TRACE.push(`t${state.turn} P${playerId} idle: no viable option (credits ${Math.round(player.credits)})`);
      break;
    }
    AI_TRACE.push(
      `t${state.turn} P${playerId} ${best.kind} ${best.type} @${best.tile.x},${best.tile.y} score ${best.score.toFixed(1)} cost ${best.cost}`,
    );
    if (AI_TRACE.length > 6000) AI_TRACE.splice(0, 2000);
    if (best.kind === 'claim') {
      if (!claimTile(state, playerId, best.tile.x, best.tile.y).ok) continue;
      claimsThisTurn++;
    } else if (best.kind === 'upgrade') {
      if (!upgradeFacility(state, playerId, best.tile.x, best.tile.y).ok) continue;
    } else {
      if (!canBuild(state, playerId, best.type, best.tile.x, best.tile.y).ok) continue;
      if (!buildStructure(state, playerId, best.type, best.tile.x, best.tile.y).ok) continue;
      if (best.type === 'line' || best.type === 'substation') transmissionBuilt++;
    }
  }

  const afterStructures = countCategory(state, playerId, 'generation') +
    countCategory(state, playerId, 'grid') +
    countCategory(state, playerId, 'data') +
    countCategory(state, playerId, 'storage') +
    countCategory(state, playerId, 'research');
  const built = afterStructures - beforeStructures;
  const claimed = state.tiles.filter((t) => t.owner === playerId).length - beforeTiles;
  if (built > 0 || claimed > 0) {
    state.pendingNotes.push(`${player.company} added ${built} facilities and claimed ${claimed} tiles.`);
  }

  // Safety net: never sit on a powered-down data center.
  if (
    player.credits > reserve + 34 &&
    countStructures(state, playerId, 'solar') + countStructures(state, playerId, 'gas') + countStructures(state, playerId, 'wind') === 0
  ) {
    const plan = planPower(state, playerId);
    if (plan.demand > 0 && plan.genCap < plan.demand) {
      for (const type of ['solar', 'gas', 'wind'] as StructureType[]) {
        const tile = buildCandidates(state, playerId, type).find(
          (t) => adjacentOwnStructures(state, t, playerId) > 0 && canBuild(state, playerId, type, t.x, t.y).ok,
        );
        if (tile) {
          buildStructure(state, playerId, type, tile.x, tile.y);
          break;
        }
      }
    }
  }
}

function countStructures(state: GameState, playerId: number, type: StructureType): number {
  return state.tiles.filter((t) => t.structure && t.structure.owner === playerId && t.structure.type === type).length;
}

function expectedDcProfit(state: GameState, player: GameState['players'][number], type: StructureType): number {
  const def = STRUCTURES[type];
  if (!def.dc) return 0;
  const mods = techSummary(player.techs);
  const price = state.conditions.computePrice * state.marketSaturation * (1 + mods.pricePct / 100);
  const revenue = def.dc.it * def.dc.eff * (1 + mods.computePct / 100) * price * 0.85;
  const powerCost = def.dc.it * def.dc.pue * 0.45;
  return revenue - def.opex - powerCost;
}

function weatherRisk(type: StructureType, weather: string): number {
  if (type === 'solar') {
    if (weather === 'storm' || weather === 'dust_storm') return 0.45;
    if (weather === 'heatwave') return 1.08;
  }
  if (type === 'wind') {
    if (weather === 'wind_drought') return 0.35;
    if (weather === 'storm' || weather === 'cold_snap') return 1.08;
  }
  if (type === 'hydro') {
    if (weather === 'wind_drought') return 0.75;
    if (weather === 'storm') return 1.1;
  }
  if (type === 'gas') {
    return 1.05;
  }
  return 1;
}

function diversityPenalty(state: GameState, playerId: number, type: StructureType): number {
  if (type !== 'solar' && type !== 'wind') return 1;
  const same = countStructures(state, playerId, type);
  return Math.max(0.45, 1 - same * 0.035);
}

function countCategory(state: GameState, playerId: number, category: 'generation' | 'grid' | 'data' | 'storage' | 'research'): number {
  return state.tiles.filter(
    (t) => t.structure && t.structure.owner === playerId && STRUCTURES[t.structure.type].category === category,
  ).length;
}
