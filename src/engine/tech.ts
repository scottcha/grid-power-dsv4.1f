import type { Player, StructureType } from './types';
import { TECH_MAP, TECHS, type TechDef, type TechFx } from './balance';

type NumericFxKey = Exclude<keyof TechFx, 'unlock'>;

export interface TechSummary {
  computePct: number;
  pueDelta: number;
  solarPct: number;
  windPct: number;
  hydroPct: number;
  nuclearPct: number;
  geoPct: number;
  gasPct: number;
  linkPct: number;
  drPct: number;
  stabilityAdd: number;
  batteryCapPct: number;
  batteryPowerPct: number;
  batteryEffPct: number;
  dcCostPct: number;
  lineCostPct: number;
  subCostPct: number;
  batteryCostPct: number;
  importPct: number;
  exportPct: number;
  pricePct: number;
  researchPct: number;
  unlocked: Record<string, boolean>;
}

const NUMERIC_FX_KEYS: NumericFxKey[] = [
  'computePct',
  'pueDelta',
  'solarPct',
  'windPct',
  'hydroPct',
  'nuclearPct',
  'geoPct',
  'gasPct',
  'linkPct',
  'drPct',
  'stabilityAdd',
  'batteryCapPct',
  'batteryPowerPct',
  'batteryEffPct',
  'dcCostPct',
  'lineCostPct',
  'subCostPct',
  'batteryCostPct',
  'importPct',
  'exportPct',
  'pricePct',
  'researchPct',
];

export function techSummary(techs: readonly string[]): TechSummary {
  const summary: TechSummary = {
    computePct: 0,
    pueDelta: 0,
    solarPct: 0,
    windPct: 0,
    hydroPct: 0,
    nuclearPct: 0,
    geoPct: 0,
    gasPct: 0,
    linkPct: 0,
    drPct: 0,
    stabilityAdd: 0,
    batteryCapPct: 0,
    batteryPowerPct: 0,
    batteryEffPct: 0,
    dcCostPct: 0,
    lineCostPct: 0,
    subCostPct: 0,
    batteryCostPct: 0,
    importPct: 0,
    exportPct: 0,
    pricePct: 0,
    researchPct: 0,
    unlocked: {},
  };
  for (const id of techs) {
    const tech = TECH_MAP[id];
    if (!tech) continue;
    for (const key of NUMERIC_FX_KEYS) {
      const value = tech.fx[key];
      if (typeof value === 'number') summary[key] += value;
    }
    if (tech.fx.unlock) for (const s of tech.fx.unlock) summary.unlocked[s] = true;
  }
  return summary;
}

export function hasTech(player: Player, id: string): boolean {
  return player.techs.includes(id);
}

export function canResearch(player: Player, id: string): boolean {
  const tech = TECH_MAP[id];
  if (!tech || hasTech(player, id)) return false;
  return tech.requires.every((req) => hasTech(player, req));
}

export function availableTechs(player: Player): TechDef[] {
  return TECHS.filter((t) => canResearch(player, t.id) && player.researchPoints >= t.cost);
}

export function structureTech(type: StructureType): string | null {
  switch (type) {
    case 'nuclear':
      return 'advanced_nuclear';
    case 'hyper_dc':
      return 'modular_datacenters';
    case 'giga_dc':
      return 'ai_factory';
    default:
      return null;
  }
}

export function structureUnlocked(player: Player, type: StructureType): boolean {
  const req = structureTech(type);
  return !req || hasTech(player, req);
}

export function techName(id: string): string {
  return TECH_MAP[id]?.name ?? id;
}
