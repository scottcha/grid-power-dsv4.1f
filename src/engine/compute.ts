import type { Conditions, Structure, StructureType, Tile } from './types';
import { MARKET, POLICIES, STRUCTURES, TERRAIN_INFO, type PolicyDef, type StructureDef } from './balance';
import type { TechSummary } from './tech';
import { neighboursOf } from './worldgen';
import type { GameState } from './types';

export function defOf(type: StructureType): StructureDef {
  return STRUCTURES[type];
}

export interface BatteryStats {
  power: number;
  capacity: number;
  eff: number;
}

export function batteryStats(def: StructureDef, mods: TechSummary): BatteryStats {
  const b = def.battery;
  if (!b) return { power: 0, capacity: 0, eff: 0.9 };
  const eff = Math.min(0.98, b.eff * (1 + mods.batteryEffPct / 100));
  return {
    power: b.power * (1 + mods.batteryPowerPct / 100),
    capacity: b.capacity * (1 + mods.batteryCapPct / 100),
    eff,
  };
}

export function policyOf(structure: Structure): PolicyDef {
  return POLICIES[structure.policy] ?? POLICIES.max_compute;
}

/** Effective utilisation target for a data center, including emergency load shedding. */
export function policyUtil(structure: Structure, conditions: Conditions): number {
  const policy = policyOf(structure);
  if (conditions.marketEvent === 'grid_emergency') {
    return Math.max(0.3, policy.util - policy.flex * 0.85);
  }
  if (structure.policy === 'max_profit' && conditions.computePrice < MARKET.computeBase * 0.8) {
    return policy.util * 0.86;
  }
  return policy.util;
}

export function dataCenterPue(
  state: GameState,
  tile: Tile,
  def: StructureDef,
  conditions: Conditions,
  mods: TechSummary,
): number {
  if (!def.dc) return 1;
  let pue = def.dc.pue + mods.pueDelta / 1;
  pue -= (TERRAIN_INFO[tile.terrain].cooling - 1) * 0.4;
  pue += (conditions.cooling - 1) * 0.45;
  const nearWater = neighboursOf(state.tiles, state.width, state.height, tile.x, tile.y).some(
    (n) => n.terrain === 'river' || n.terrain === 'coast' || n.terrain === 'ocean',
  );
  if (nearWater) pue -= 0.035;
  return Math.max(1.05, pue);
}

export function weatherFactor(type: StructureType, conditions: Conditions): number {
  const gen = STRUCTURES[type].generation;
  if (!gen) return 1;
  switch (gen.weather) {
    case 'solar':
      return conditions.solar;
    case 'wind':
      return conditions.wind;
    case 'hydro':
      return conditions.hydro;
    default:
      return 1;
  }
}

export function techOutputPct(type: StructureType, mods: TechSummary): number {
  switch (type) {
    case 'solar':
      return mods.solarPct;
    case 'wind':
      return mods.windPct;
    case 'hydro':
      return mods.hydroPct;
    case 'nuclear':
      return mods.nuclearPct;
    case 'geothermal':
      return mods.geoPct;
    case 'gas':
      return mods.gasPct;
    default:
      return 0;
  }
}

/** Weather- and terrain-adjusted generation capacity in MW. */
export function generationCapacity(
  tile: Tile,
  structure: Structure,
  conditions: Conditions,
  mods: TechSummary,
): number {
  const def = STRUCTURES[structure.type];
  if (!def.generation) return 0;
  const terrain = TERRAIN_INFO[tile.terrain];
  let factor = 1;
  if (structure.type === 'solar') factor *= terrain.solar;
  if (structure.type === 'wind') factor *= terrain.wind;
  factor *= weatherFactor(structure.type, conditions);
  factor *= 1 + techOutputPct(structure.type, mods) / 100;
  return def.generation.mw * factor;
}

export function marginalCost(type: StructureType, conditions: Conditions): number {
  switch (type) {
    case 'gas':
      return conditions.fuelPrice * 0.55;
    case 'hydro':
      return 0.35;
    case 'nuclear':
      return 0.3;
    case 'geothermal':
      return 0.25;
    default:
      return 0;
  }
}

export function linkCapacity(type: StructureType, mods: TechSummary): number {
  return STRUCTURES[type].tie * (1 + mods.linkPct / 100);
}

export function buildCost(type: StructureType, mods: TechSummary): number {
  const base = STRUCTURES[type].cost;
  switch (type) {
    case 'line':
      return Math.max(1, Math.round(base * (1 + mods.lineCostPct / 100)));
    case 'substation':
      return Math.max(1, Math.round(base * (1 + mods.subCostPct / 100)));
    case 'battery':
      return Math.max(1, Math.round(base * (1 + mods.batteryCostPct / 100)));
    default:
      if (STRUCTURES[type].category === 'data') return Math.max(1, Math.round(base * (1 + mods.dcCostPct / 100)));
      return base;
  }
}
