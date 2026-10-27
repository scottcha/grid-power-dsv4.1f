import type { GameState, IslandInfo, PowerLink, PowerNode, PowerPlan, Structure, Tile } from './types';
import { MARKET, STRUCTURES } from './balance';
import { techSummary } from './tech';
import {
  batteryStats,
  dataCenterPue,
  generationCapacity,
  linkCapacity,
  marginalCost,
  policyOf,
  policyUtil,
} from './compute';
import { maxFlow, type FlowEdgeInput } from './flow';

export interface PlayerStructure {
  tile: Tile;
  structure: Structure;
}

export function playerStructures(state: GameState, playerId: number): PlayerStructure[] {
  const out: PlayerStructure[] = [];
  for (const tile of state.tiles) {
    if (tile.structure && tile.structure.owner === playerId) out.push({ tile, structure: tile.structure });
  }
  return out;
}

export function ownedStructureCount(state: GameState, playerId: number): number {
  let count = 0;
  for (const tile of state.tiles) if (tile.structure && tile.structure.owner === playerId) count++;
  return count;
}

export function ownedTileCount(state: GameState, playerId: number): number {
  let count = 0;
  for (const tile of state.tiles) if (tile.owner === playerId) count++;
  return count;
}

/** Adjacent owned structures form the player's electrical graph. */
export function gridAdjacency(refs: PlayerStructure[]): Array<[number, number]> {
  const lookup = new Map<string, number>();
  refs.forEach((r, i) => lookup.set(`${r.tile.x},${r.tile.y}`, i));
  const pairs: Array<[number, number]> = [];
  refs.forEach((r, i) => {
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as Array<[number, number]>) {
      const j = lookup.get(`${r.tile.x + dx},${r.tile.y + dy}`);
      if (j !== undefined) pairs.push([i, j]);
    }
  });
  return pairs;
}

const KIND_BY_CATEGORY = {
  generation: 'generation',
  data: 'data',
  storage: 'storage',
  research: 'research',
  grid: 'grid',
} as const;

/**
 * Plan one player's power dispatch. Pure with respect to `state`; the resolver
 * applies battery state-of-charge and credits from the returned plan, so the UI
 * can call this freely for previews and overlays.
 */
export function planPower(state: GameState, playerId: number): PowerPlan {
  const player = state.players[playerId];
  const mods = techSummary(player.techs);
  const conditions = state.conditions;
  const refs = playerStructures(state, playerId);
  const emptyPlan: PowerPlan = {
    nodes: [],
    links: [],
    islands: [],
    genCap: 0,
    demand: 0,
    delivered: 0,
    shortfall: 0,
    surplus: 0,
    curtailed: 0,
    imports: 0,
    exports: 0,
    drRevenue: 0,
    stability: 0.8,
    congested: 0,
    batteryCharge: 0,
    batteryDischarge: 0,
    dcEfficiency: 0,
    compute: 0,
    computeRevenue: 0,
    importCost: 0,
    exportRevenue: 0,
  };
  if (refs.length === 0) return emptyPlan;

  const nodes: PowerNode[] = refs.map((ref, index) => {
    const def = STRUCTURES[ref.structure.type];
    const battery = def.battery ? batteryStats(def, mods) : null;
    const soc = battery ? Math.min(battery.capacity, Math.max(0, ref.structure.soc)) : 0;
    return {
      index,
      x: ref.tile.x,
      y: ref.tile.y,
      type: ref.structure.type,
      kind: KIND_BY_CATEGORY[def.category],
      cap: def.generation ? generationCapacity(ref.tile, ref.structure, conditions, mods) : def.tie,
      tie: linkCapacity(ref.structure.type, mods),
      supply: 0,
      demand: 0,
      marginal: marginalCost(ref.structure.type, conditions),
      produced: 0,
      served: 0,
      island: -1,
      soc,
      socAfter: soc,
      marketRole: 'none',
      pue: 1,
      compute: 0,
      revenue: 0,
    };
  });

  refs.forEach((ref, index) => {
    const def = STRUCTURES[ref.structure.type];
    const node = nodes[index];
    if (def.dc) {
      const pue = dataCenterPue(state, ref.tile, def, conditions, mods);
      node.pue = pue;
      node.demand = def.dc.it * pue * policyUtil(ref.structure, conditions);
    } else if (def.category === 'research') {
      node.demand = 1;
    } else if (def.generation) {
      node.supply = node.cap;
    }
  });

  const pairs = gridAdjacency(refs);
  const links: PowerLink[] = pairs.map(([a, b]) => ({
    a,
    b,
    cap: Math.min(nodes[a].tie, nodes[b].tie),
    flow: 0,
    congested: false,
  }));
  const flowEdges: FlowEdgeInput[] = links.map((l) => ({ a: l.a, b: l.b, cap: l.cap }));

  const adjacency: number[][] = nodes.map(() => []);
  for (const [a, b] of pairs) {
    adjacency[a].push(b);
    adjacency[b].push(a);
  }
  const islands: number[][] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].island >= 0) continue;
    const id = islands.length;
    const queue = [i];
    nodes[i].island = id;
    const members: number[] = [];
    while (queue.length > 0) {
      const v = queue.pop() as number;
      members.push(v);
      for (const next of adjacency[v]) {
        if (nodes[next].island < 0) {
          nodes[next].island = id;
          queue.push(next);
        }
      }
    }
    islands.push(members);
  }

  const importPerSub = MARKET.importPerSub * (1 + mods.importPct / 100);
  const exportPerSub = MARKET.exportPerSub * (1 + mods.exportPct / 100);
  const importPrice = conditions.elecPrice * MARKET.importFee;
  const clearingPrice = conditions.computePrice * state.marketSaturation;

  // Per-island planning: storage scheduling, imports/exports, merit order.
  for (const members of islands) {
    const genNodes = members.filter((i) => nodes[i].kind === 'generation');
    const storageNodes = members.filter((i) => nodes[i].kind === 'storage');
    const subNodes = members.filter((i) => nodes[i].type === 'substation');
    const genTotal = genNodes.reduce((sum, i) => sum + nodes[i].cap, 0);
    const demandBase = members.reduce((sum, i) => sum + nodes[i].demand, 0);

    let battPower = 0;
    let battRoom = 0;
    const dischargeCaps = new Map<number, number>();
    const roomCaps = new Map<number, number>();
    for (const i of storageNodes) {
      const stats = batteryStats(STRUCTURES[refs[i].structure.type], mods);
      const stored = Math.min(stats.capacity, Math.max(0, refs[i].structure.soc));
      const dischargeCap = Math.min(stats.power, stored * stats.eff);
      const room = Math.min(stats.power, Math.max(0, stats.capacity - stored) / stats.eff);
      dischargeCaps.set(i, dischargeCap);
      roomCaps.set(i, room);
      battPower += dischargeCap;
      battRoom += room;
    }

    const deficit = demandBase - genTotal;
    let chargeTarget = 0;
    let exportTarget = 0;

    if (deficit > 0.001) {
      for (const i of storageNodes) nodes[i].supply = dischargeCaps.get(i) ?? 0;
      const remainingDeficit = Math.max(0, deficit - battPower);
      if (remainingDeficit > 0.001 && subNodes.length > 0) {
        const perSub = Math.min(importPerSub, remainingDeficit / subNodes.length);
        for (const i of subNodes) {
          nodes[i].supply = perSub;
          nodes[i].marginal = importPrice;
          nodes[i].marketRole = 'import';
        }
      }
    } else if (deficit < -0.001) {
      const surplus = -deficit;
      chargeTarget = Math.min(battRoom, surplus * 0.7);
      for (const i of storageNodes) {
        const room = roomCaps.get(i) ?? 0;
        nodes[i].demand = battRoom > 0 ? Math.min(room, (chargeTarget * room) / battRoom) : 0;
      }
      if (subNodes.length > 0) {
        exportTarget = Math.min(surplus - chargeTarget, exportPerSub * subNodes.length);
        if (exportTarget > 0.001) {
          const perSub = exportTarget / subNodes.length;
          for (const i of subNodes) {
            nodes[i].demand = perSub;
            nodes[i].marketRole = 'export';
          }
        }
      }
    }

    const need = demandBase + chargeTarget + exportTarget;
    const supplyNodes = members
      .filter((i) => nodes[i].supply > 0)
      .sort((a, b) => nodes[a].marginal - nodes[b].marginal || a - b);
    let remaining = need;
    for (const i of supplyNodes) {
      const planned = Math.min(nodes[i].supply, Math.max(0, remaining));
      nodes[i].supply = planned;
      remaining -= planned;
    }
    // Generators that were not selected in merit order inject nothing.
    for (const i of genNodes) if (remaining < 0 || !supplyNodes.includes(i)) nodes[i].supply = Math.min(nodes[i].supply, 0);
  }

  const flow = maxFlow(
    nodes.length,
    nodes.map((n) => n.supply),
    nodes.map((n) => n.demand),
    flowEdges,
  );
  nodes.forEach((node, i) => {
    node.produced = flow.produced[i];
    node.served = flow.served[i];
  });
  const congestedLinks = links.filter((_, i) => flow.congested[i]).length;
  links.forEach((link, i) => {
    link.flow = Math.abs(flow.edgeFlow[i]);
    link.congested = flow.congested[i];
  });

  let genCap = 0;
  let demandTotal = 0;
  let delivered = 0;
  let shortfall = 0;
  let curtailed = 0;
  let imports = 0;
  let exportsTotal = 0;
  let importCost = 0;
  let exportRevenue = 0;
  let batteryCharge = 0;
  let batteryDischarge = 0;
  let drRevenue = 0;
  let computeTotal = 0;
  let computeRevenue = 0;
  let loadWeightedStability = 0;
  let loadWeight = 0;
  let dcServedTotal = 0;
  const computeMult = 1 + mods.computePct / 100;
  const islandInfos: IslandInfo[] = [];

  for (let islandId = 0; islandId < islands.length; islandId++) {
    const members = islands[islandId];
    const dataNodes = members.filter((i) => nodes[i].kind === 'data');
    const labNodes = members.filter((i) => nodes[i].kind === 'research');
    const storageNodes = members.filter((i) => nodes[i].kind === 'storage');
    const genNodes = members.filter((i) => nodes[i].kind === 'generation');
    const islandCongested = links.filter((l) => nodes[l.a].island === islandId && l.congested).length;

    const islandGenCap = genNodes.reduce((sum, i) => sum + nodes[i].cap, 0);
    const dcDemand = dataNodes.reduce((sum, i) => sum + nodes[i].demand, 0);
    const labDemand = labNodes.reduce((sum, i) => sum + nodes[i].demand, 0);
    const islandDemand = dcDemand + labDemand;
    const dcServed = dataNodes.reduce((sum, i) => sum + nodes[i].served, 0);
    const islandShortfall = Math.max(0, dcDemand - dcServed);
    const islandCurtailed = genNodes.reduce((sum, i) => sum + Math.max(0, nodes[i].cap - nodes[i].produced), 0);
    const islandImports = members.reduce(
      (sum, i) => sum + (nodes[i].marketRole === 'import' ? nodes[i].produced : 0),
      0,
    );
    const islandExports = members.reduce(
      (sum, i) => sum + (nodes[i].marketRole === 'export' ? nodes[i].served : 0),
      0,
    );

    let stability = 0.8;
    if (islandDemand > 0.01) {
      const policyBonus = dataNodes.length
        ? dataNodes.reduce((sum, i) => sum + policyOf(refs[i].structure).stability, 0) / dataNodes.length
        : 0;
      const surplusRatio = (islandGenCap - islandDemand) / Math.max(1, islandDemand);
      stability =
        0.66 +
        0.28 * Math.max(-1, Math.min(1, surplusRatio)) +
        mods.stabilityAdd +
        policyBonus -
        (islandShortfall / Math.max(1, islandDemand)) * 1.15 -
        islandCongested * 0.012;
      if (conditions.weather === 'storm') stability -= 0.035;
      if (conditions.marketEvent === 'grid_emergency') stability -= 0.045;
      stability = Math.max(0.05, Math.min(0.99, stability));
    }

    for (const i of storageNodes) {
      const node = nodes[i];
      const stats = batteryStats(STRUCTURES[refs[i].structure.type], mods);
      if (node.demand > 0.001) {
        node.socAfter = Math.min(stats.capacity, node.soc + node.served * stats.eff);
        batteryCharge += node.served * stats.eff;
      } else if (node.supply > 0.001) {
        node.socAfter = Math.max(0, node.soc - node.produced / stats.eff);
        batteryDischarge += node.produced;
      } else {
        node.socAfter = node.soc;
      }
    }

    const stabilityFactor = 0.75 + 0.25 * stability;
    for (const i of dataNodes) {
      const node = nodes[i];
      const def = STRUCTURES[refs[i].structure.type];
      if (!def.dc) continue;
      const itPower = node.served / Math.max(1.001, node.pue);
      const compute = itPower * def.dc.eff * computeMult * stabilityFactor;
      node.compute = compute;
      node.revenue = compute * clearingPrice * (1 + mods.pricePct / 100);
      computeTotal += compute;
      computeRevenue += node.revenue;
      dcServedTotal += node.served;
      if (node.demand > 0.001) {
        loadWeightedStability += stability * node.demand;
        loadWeight += node.demand;
      }
      if (conditions.marketEvent === 'grid_emergency') {
        const policy = policyOf(refs[i].structure);
        const shedIt = def.dc.it * (policy.util - policyUtil(refs[i].structure, conditions));
        const shedMw = Math.max(0, shedIt * node.pue);
        drRevenue += shedMw * MARKET.drBase * conditions.elecPrice * policy.dr * (1 + mods.drPct / 100);
      }
    }
    if (conditions.marketEvent === 'grid_emergency') {
      for (const i of storageNodes) {
        const stats = batteryStats(STRUCTURES[refs[i].structure.type], mods);
        drRevenue += stats.power * 0.5 * conditions.elecPrice * (1 + mods.drPct / 100);
      }
    }

    importCost += islandImports * importPrice;
    exportRevenue += islandExports * conditions.elecPrice * MARKET.exportFee;

    genCap += islandGenCap;
    demandTotal += islandDemand;
    delivered += dcServed + labNodes.reduce((sum, i) => sum + nodes[i].served, 0);
    shortfall += islandShortfall;
    curtailed += islandCurtailed;
    imports += islandImports;
    exportsTotal += islandExports;

    islandInfos.push({
      id: islandId,
      genCap: islandGenCap,
      demand: islandDemand,
      delivered: dcServed,
      shortfall: islandShortfall,
      surplus: Math.max(0, islandGenCap - islandDemand),
      stability,
      congested: islandCongested,
      nodes: members.length,
    });
  }

  return {
    nodes,
    links,
    islands: islandInfos,
    genCap,
    demand: demandTotal,
    delivered,
    surplus: exportsTotal,
    shortfall,
    curtailed,
    imports,
    exports: exportsTotal,
    drRevenue,
    stability: loadWeight > 0 ? loadWeightedStability / loadWeight : 0.8,
    congested: congestedLinks,
    batteryCharge,
    batteryDischarge,
    dcEfficiency: dcServedTotal > 0.001 ? computeTotal / dcServedTotal : 0,
    compute: computeTotal,
    computeRevenue,
    importCost,
    exportRevenue,
  };
}
