/**
 * GRIDPOWER — centralised balance sheet. Every tunable number in the simulation
 * lives here so the game can be rebalanced without touching systems code.
 */
import type {
  PolicyId,
  StructureCategory,
  StructureType,
  Terrain,
  WeatherKind,
  MarketEventKind,
  Persona,
} from './types';

export const GAME_VERSION = 3;

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

export const MAP = {
  standard: 18,
  small: 13,
  large: 24,
  players: 4,
  revealRadiusStart: 3.5,
  revealRadiusClaim: 2,
  surveyRadius: 3,
  surveyCost: 12,
  neutralSubstations: 6,
};

export const TERRAIN_INFO: Record<
  Terrain,
  {
    name: string;
    blurb: string;
    buildable: boolean;
    solar: number;
    wind: number;
    cooling: number;
    claimValue: number;
  }
> = {
  ocean: {
    name: 'Open Water',
    blurb: 'Unbuildable. Blocks expansion and transmission.',
    buildable: false,
    solar: 0,
    wind: 0,
    cooling: 0,
    claimValue: 0,
  },
  plains: {
    name: 'Plains',
    blurb: 'Cheap construction, moderate solar. The workhorse land.',
    buildable: true,
    solar: 1,
    wind: 1,
    cooling: 1,
    claimValue: 1,
  },
  desert: {
    name: 'Desert',
    blurb: 'Excellent solar (+50%), but cooling costs are high.',
    buildable: true,
    solar: 1.5,
    wind: 0.9,
    cooling: 0.82,
    claimValue: 2,
  },
  mountain: {
    name: 'Mountain',
    blurb: 'Strong wind (+35%) and free cooling. Hard to build on.',
    buildable: true,
    solar: 0.85,
    wind: 1.35,
    cooling: 1.08,
    claimValue: 1.5,
  },
  forest: {
    name: 'Forest',
    blurb: 'Biomass research potential, slower/expensive construction.',
    buildable: true,
    solar: 0.8,
    wind: 0.9,
    cooling: 1.02,
    claimValue: 1.3,
  },
  river: {
    name: 'River',
    blurb: 'Hydro generation and excellent cooling.',
    buildable: true,
    solar: 0.9,
    wind: 0.9,
    cooling: 1.12,
    claimValue: 2.5,
  },
  coast: {
    name: 'Coast',
    blurb: 'Offshore wind and superb cooling for large campuses.',
    buildable: true,
    solar: 1,
    wind: 1.2,
    cooling: 1.15,
    claimValue: 2.3,
  },
  geothermal: {
    name: 'Geothermal Field',
    blurb: 'Reliable baseload geothermal generation.',
    buildable: true,
    solar: 0.9,
    wind: 0.9,
    cooling: 1.05,
    claimValue: 3,
  },
  urban: {
    name: 'Urban District',
    blurb: 'Strong compute demand and cheap grid connections.',
    buildable: true,
    solar: 1.05,
    wind: 0.9,
    cooling: 0.94,
    claimValue: 2.8,
  },
  basin: {
    name: 'Resource Basin',
    blurb: 'Natural gas field. Cheap dispatchable fuel generation.',
    buildable: true,
    solar: 1.05,
    wind: 1,
    cooling: 0.96,
    claimValue: 3,
  },
};

/* ------------------------------------------------------------------ */
/* Structures                                                          */
/* ------------------------------------------------------------------ */

export interface GenerationDef {
  mw: number;
  marginal: number;
  weather: 'solar' | 'wind' | 'hydro' | 'none';
  reliable: boolean;
}

export interface DataCenterDef {
  it: number;
  pue: number;
  eff: number;
  research: number;
}

export interface BatteryDef {
  power: number;
  capacity: number;
  eff: number;
}

export interface StructureDef {
  type: StructureType;
  name: string;
  short: string;
  category: StructureCategory;
  cost: number;
  opex: number;
  tie: number;
  build: Terrain[];
  tech?: string;
  desc: string;
  generation?: GenerationDef;
  dc?: DataCenterDef;
  battery?: BatteryDef;
  labResearch?: number;
  /** Visual footprint in tiles (renderer). */
  scale: number;
  upgradeTo?: StructureType;
  upgradeCost?: number;
}

export const STRUCTURES: Record<StructureType, StructureDef> = {
  solar: {
    type: 'solar',
    name: 'Solar Farm',
    short: 'Solar',
    category: 'generation',
    cost: 34,
    opex: 1.3,
    tie: 32,
    build: ['plains', 'desert', 'urban'],
    desc: 'Cheap, clean and intermittent. Desert tiles yield +50%. Output falls in storms and at low sun.',
    generation: { mw: 12, marginal: 0, weather: 'solar', reliable: false },
    scale: 1.0,
  },
  wind: {
    type: 'wind',
    name: 'Wind Park',
    short: 'Wind',
    category: 'generation',
    cost: 38,
    opex: 1.4,
    tie: 32,
    build: ['mountain', 'coast', 'plains'],
    desc: 'Variable output that complements solar. Mountains and coasts produce +20–35%.',
    generation: { mw: 10, marginal: 0, weather: 'wind', reliable: false },
    scale: 0.95,
  },
  gas: {
    type: 'gas',
    name: 'Gas Turbine',
    short: 'Gas',
    category: 'generation',
    cost: 58,
    opex: 2.2,
    tie: 64,
    build: ['basin', 'plains', 'urban'],
    desc: 'Dispatchable and fast to build. Burns fuel every turn it runs; fuel spikes hurt.',
    generation: { mw: 30, marginal: 0.9, weather: 'none', reliable: true },
    scale: 1.05,
  },
  hydro: {
    type: 'hydro',
    name: 'Hydro Station',
    short: 'Hydro',
    category: 'generation',
    cost: 50,
    opex: 1.5,
    tie: 52,
    build: ['river'],
    desc: 'Stable river generation. Tiny fuel cost, unaffected by weather except drought.',
    generation: { mw: 18, marginal: 0.35, weather: 'hydro', reliable: true },
    scale: 1.1,
  },
  nuclear: {
    type: 'nuclear',
    name: 'Nuclear Reactor',
    short: 'Nuclear',
    category: 'generation',
    cost: 260,
    opex: 9,
    tie: 130,
    build: ['plains', 'urban', 'coast'],
    tech: 'advanced_nuclear',
    desc: 'Enormous, rock-steady baseload. Expensive to build and to license.',
    generation: { mw: 60, marginal: 0.3, weather: 'none', reliable: true },
    scale: 1.24,
  },
  geothermal: {
    type: 'geothermal',
    name: 'Geothermal Plant',
    short: 'Geo',
    category: 'generation',
    cost: 74,
    opex: 3.0,
    tie: 52,
    build: ['geothermal'],
    desc: 'Reliable baseload locked to geothermal fields. Unaffected by weather.',
    generation: { mw: 22, marginal: 0.25, weather: 'none', reliable: true },
    scale: 1.15,
  },
  battery: {
    type: 'battery',
    name: 'Battery Array',
    short: 'Battery',
    category: 'storage',
    cost: 52,
    opex: 1.2,
    tie: 52,
    build: ['plains', 'desert', 'mountain', 'forest', 'river', 'coast', 'urban', 'basin'],
    desc: 'Stores surplus renewable energy (MW/MWh) and discharges during shortfalls and grid emergencies.',
    battery: { power: 18, capacity: 44, eff: 0.9 },
    scale: 0.95,
  },
  line: {
    type: 'line',
    name: 'Power Line',
    short: 'Line',
    category: 'grid',
    cost: 9,
    opex: 0.2,
    tie: 30,
    build: ['plains', 'desert', 'mountain', 'forest', 'river', 'coast', 'urban', 'basin', 'geothermal'],
    desc: 'Carries up to 30 MW between adjacent structures. Links light up when power flows.',
    scale: 0.62,
  },
  substation: {
    type: 'substation',
    name: 'Substation',
    short: 'Sub',
    category: 'grid',
    cost: 30,
    opex: 0.7,
    tie: 90,
    build: ['plains', 'desert', 'mountain', 'forest', 'river', 'coast', 'urban', 'basin', 'geothermal'],
    desc: 'High-capacity hub (90 MW). Unlocks electricity imports (+22 MW) and exports (18 MW).',
    scale: 0.9,
  },
  edge_dc: {
    type: 'edge_dc',
    name: 'Edge Data Center',
    short: 'Edge DC',
    category: 'data',
    cost: 58,
    opex: 6,
    tie: 46,
    build: ['plains', 'desert', 'urban', 'forest', 'coast'],
    desc: 'Small, cheap inference site. 6 MW IT load at 1.55 PUE, 8 CU/MW.',
    dc: { it: 6, pue: 1.55, eff: 8, research: 1 },
    scale: 0.95,
    upgradeTo: 'hyper_dc',
    upgradeCost: 180,
  },
  hyper_dc: {
    type: 'hyper_dc',
    name: 'Hyperscale Campus',
    short: 'Hyperscale',
    category: 'data',
    cost: 225,
    opex: 22,
    tie: 92,
    build: ['plains', 'desert', 'urban', 'coast', 'forest'],
    tech: 'modular_datacenters',
    desc: '20 MW IT load at 1.40 PUE, 10.5 CU/MW. The backbone of a compute empire.',
    dc: { it: 20, pue: 1.4, eff: 10.5, research: 2 },
    scale: 1.2,
    upgradeTo: 'giga_dc',
    upgradeCost: 500,
  },
  giga_dc: {
    type: 'giga_dc',
    name: 'AI Gigafactory',
    short: 'Gigafactory',
    category: 'data',
    cost: 690,
    opex: 50,
    tie: 175,
    build: ['plains', 'desert', 'coast', 'forest'],
    tech: 'ai_factory',
    desc: '55 MW IT load at 1.30 PUE, 12.5 CU/MW. The crown of an AI infrastructure empire.',
    dc: { it: 55, pue: 1.3, eff: 12.5, research: 4 },
    scale: 1.36,
  },
  lab: {
    type: 'lab',
    name: 'Research Lab',
    short: 'Lab',
    category: 'research',
    cost: 40,
    opex: 2.5,
    build: ['plains', 'urban', 'forest'],
    desc: 'Produces 5 RP per turn. Draws 1 MW — needs a grid connection like any load.',
    labResearch: 5,
    scale: 0.85,
    tie: 20,
  },
};

export const BUILD_ORDER: StructureType[] = [
  'solar',
  'wind',
  'gas',
  'hydro',
  'geothermal',
  'nuclear',
  'battery',
  'line',
  'substation',
  'edge_dc',
  'hyper_dc',
  'giga_dc',
  'lab',
];

/* ------------------------------------------------------------------ */
/* Policies                                                            */
/* ------------------------------------------------------------------ */

export interface PolicyDef {
  id: PolicyId;
  name: string;
  blurb: string;
  util: number;
  /** Extra flexibility: portion of load curtailable during grid emergencies. */
  flex: number;
  dr: number;
  stability: number;
}

export const POLICIES: Record<PolicyId, PolicyDef> = {
  max_compute: {
    id: 'max_compute',
    name: 'Maximize Compute',
    blurb: 'Run every rack flat out. Maximum CU, no demand-response income, higher peaks.',
    util: 1,
    flex: 0,
    dr: 0,
    stability: 0,
  },
  max_profit: {
    id: 'max_profit',
    name: 'Maximize Profit',
    blurb: 'Trim utilisation to 90% to avoid marginal energy costs. Slightly lower output.',
    util: 0.9,
    flex: 0.15,
    dr: 0.25,
    stability: 0.02,
  },
  min_energy: {
    id: 'min_energy',
    name: 'Minimize Energy',
    blurb: 'Throttle to 72% IT load. Much lower power draw and emissions.',
    util: 0.72,
    flex: 0.2,
    dr: 0.2,
    stability: 0.03,
  },
  grid_flexible: {
    id: 'grid_flexible',
    name: 'Grid Flexible',
    blurb: 'Normally 88%, but sheds to 40% during grid emergencies for premium DR payments.',
    util: 0.88,
    flex: 0.55,
    dr: 1,
    stability: 0.05,
  },
  reliability_first: {
    id: 'reliability_first',
    name: 'Reliability First',
    blurb: 'Modest 94% utilisation and extra reserves. Best grid stability, no DR income.',
    util: 0.94,
    flex: 0.05,
    dr: 0.1,
    stability: 0.1,
  },
};

/* ------------------------------------------------------------------ */
/* Research                                                            */
/* ------------------------------------------------------------------ */

export type TechBranch = 'compute' | 'energy' | 'optimization' | 'infrastructure';

export interface TechFx {
  solarPct?: number;
  windPct?: number;
  hydroPct?: number;
  nuclearPct?: number;
  geoPct?: number;
  gasPct?: number;
  computePct?: number;
  pueDelta?: number;
  linkPct?: number;
  drPct?: number;
  stabilityAdd?: number;
  batteryCapPct?: number;
  batteryPowerPct?: number;
  batteryEffPct?: number;
  dcCostPct?: number;
  lineCostPct?: number;
  subCostPct?: number;
  batteryCostPct?: number;
  importPct?: number;
  exportPct?: number;
  pricePct?: number;
  researchPct?: number;
  unlock?: StructureType[];
}

export interface TechDef {
  id: string;
  name: string;
  branch: TechBranch;
  cost: number;
  requires: string[];
  desc: string;
  fx: TechFx;
  ultimate?: boolean;
}

export const TECHS: TechDef[] = [
  // Compute
  {
    id: 'efficient_gpus',
    name: 'Efficient GPUs',
    branch: 'compute',
    cost: 34,
    requires: [],
    desc: '+12% compute per MW with power-optimised accelerator profiles.',
    fx: { computePct: 12 },
  },
  {
    id: 'advanced_cooling',
    name: 'Advanced Cooling',
    branch: 'compute',
    cost: 42,
    requires: [],
    desc: '−0.10 PUE across every data center. Less power for the same compute.',
    fx: { pueDelta: -0.1 },
  },
  {
    id: 'liquid_cooling',
    name: 'Liquid Cooling',
    branch: 'compute',
    cost: 78,
    requires: ['advanced_cooling'],
    desc: '−0.15 PUE more. Makes coastal and river campuses dramatically efficient.',
    fx: { pueDelta: -0.15 },
  },
  {
    id: 'ai_accelerators',
    name: 'AI Accelerators',
    branch: 'compute',
    cost: 96,
    requires: ['efficient_gpus'],
    desc: '+18% compute per MW from custom inference silicon.',
    fx: { computePct: 18 },
  },
  {
    id: 'ai_factory',
    name: 'Next-Gen AI Factories',
    branch: 'compute',
    cost: 150,
    requires: ['ai_accelerators', 'liquid_cooling'],
    desc: 'Unlocks the AI Gigafactory and adds +10% compute across the fleet.',
    fx: { computePct: 10, unlock: ['giga_dc'] },
  },
  // Energy
  {
    id: 'solar_cells',
    name: 'Improved Solar Cells',
    branch: 'energy',
    cost: 32,
    requires: [],
    desc: '+25% solar output. Makes desert solar farms genuinely powerful.',
    fx: { solarPct: 25 },
  },
  {
    id: 'wind_turbines',
    name: 'Advanced Wind Turbines',
    branch: 'energy',
    cost: 38,
    requires: [],
    desc: '+30% wind output. Coastal and mountain parks become serious assets.',
    fx: { windPct: 30 },
  },
  {
    id: 'hv_transmission',
    name: 'High-Voltage Transmission',
    branch: 'energy',
    cost: 46,
    requires: [],
    desc: '+50% link capacity and −15% line cost. Relieves bottlenecks.',
    fx: { linkPct: 50, lineCostPct: -15 },
  },
  {
    id: 'modular_substations',
    name: 'Modular Substations',
    branch: 'energy',
    cost: 58,
    requires: ['hv_transmission'],
    desc: '−25% substation cost, +25% import capacity.',
    fx: { subCostPct: -25, importPct: 25 },
  },
  {
    id: 'advanced_nuclear',
    name: 'Advanced Nuclear',
    branch: 'energy',
    cost: 125,
    requires: ['modular_substations'],
    desc: 'Unlocks nuclear reactors. +10% nuclear output.',
    fx: { nuclearPct: 10, unlock: ['nuclear'] },
  },
  {
    id: 'deep_geothermal',
    name: 'Deep Geothermal',
    branch: 'energy',
    cost: 64,
    requires: [],
    desc: '+35% geothermal output. Baseload that ignores the weather.',
    fx: { geoPct: 35 },
  },
  // Optimization
  {
    id: 'gpu_power_limits',
    name: 'Static GPU Power Limits',
    branch: 'optimization',
    cost: 28,
    requires: [],
    desc: '+5% compute per MW and −0.04 PUE. The entry point to AI optimisation.',
    fx: { computePct: 5, pueDelta: -0.04 },
  },
  {
    id: 'dynamic_power',
    name: 'Dynamic GPU Power Management',
    branch: 'optimization',
    cost: 50,
    requires: ['gpu_power_limits'],
    desc: '+20% demand-response income; flexible policies shed load more cleanly.',
    fx: { drPct: 20, stabilityAdd: 0.02 },
  },
  {
    id: 'workload_scheduling',
    name: 'Workload-Aware Scheduling',
    branch: 'optimization',
    cost: 70,
    requires: ['dynamic_power'],
    desc: '+10% compute per MW by batching workloads to match power availability.',
    fx: { computePct: 10, drPct: 10 },
  },
  {
    id: 'adaptive_inference',
    name: 'Adaptive Inference Optimization',
    branch: 'optimization',
    cost: 92,
    requires: ['workload_scheduling'],
    desc: '+12% compute and +25% DR income.',
    fx: { computePct: 12, drPct: 25 },
  },
  {
    id: 'autonomous_fleet',
    name: 'Autonomous Fleet Optimization',
    branch: 'optimization',
    cost: 150,
    requires: ['adaptive_inference', 'demand_response'],
    desc: 'The ultimate AI infrastructure technology. +15% compute, +40% DR income. Required for Technology Leadership.',
    fx: { computePct: 15, drPct: 40, stabilityAdd: 0.04 },
    ultimate: true,
  },
  {
    id: 'demand_response',
    name: 'Demand Response Platforms',
    branch: 'optimization',
    cost: 66,
    requires: [],
    desc: 'Doubles demand-response income and unlocks premium grid-service contracts.',
    fx: { drPct: 100, stabilityAdd: 0.03 },
  },
  // Infrastructure
  {
    id: 'grid_analytics',
    name: 'Grid Analytics',
    branch: 'infrastructure',
    cost: 40,
    requires: [],
    desc: '+0.10 grid stability empire-wide. Fewer congestion penalties.',
    fx: { stabilityAdd: 0.1, researchPct: 5 },
  },
  {
    id: 'interconnection',
    name: 'Grid Interconnection',
    branch: 'infrastructure',
    cost: 76,
    requires: ['hv_transmission'],
    desc: '+30% link capacity and +25% export capacity.',
    fx: { linkPct: 30, exportPct: 25 },
  },
  {
    id: 'smart_dispatch',
    name: 'Smart Grid Dispatch',
    branch: 'infrastructure',
    cost: 82,
    requires: ['grid_analytics'],
    desc: '+10% battery round-trip efficiency and +0.04 stability.',
    fx: { batteryEffPct: 10, stabilityAdd: 0.04 },
  },
  {
    id: 'battery_density',
    name: 'High-Density Batteries',
    branch: 'infrastructure',
    cost: 56,
    requires: [],
    desc: '+40% battery capacity and −10% battery cost.',
    fx: { batteryCapPct: 40, batteryCostPct: -10 },
  },
  {
    id: 'modular_datacenters',
    name: 'Modular Data Centers',
    branch: 'infrastructure',
    cost: 44,
    requires: [],
    desc: 'Unlocks the Hyperscale Campus and cuts DC build cost by 15%.',
    fx: { dcCostPct: -15, unlock: ['hyper_dc'] },
  },
  {
    id: 'hpc_contracts',
    name: 'Enterprise AI Contracts',
    branch: 'infrastructure',
    cost: 62,
    requires: [],
    desc: '+12% compute price from premium enterprise contracts.',
    fx: { pricePct: 12 },
  },
  {
    id: 'storage_vpp',
    name: 'Virtual Power Plant',
    branch: 'infrastructure',
    cost: 108,
    requires: ['demand_response', 'smart_dispatch'],
    desc: '+50% DR income, +25% battery power rating, +0.03 stability.',
    fx: { drPct: 50, batteryPowerPct: 25, stabilityAdd: 0.03 },
  },
];

export const TECH_MAP: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));
export const STARTING_TECHS: string[] = [];

/* ------------------------------------------------------------------ */
/* Economy                                                             */
/* ------------------------------------------------------------------ */

export const ECONOMY = {
  startingCredits: 125,
  startingResearch: 0,
  baseResearch: 2,
  claimBase: 3,
  claimStep: 7,
  claimMax: 18,
  neutralAcquireExtra: 16,
  /** Opex multiplier is applied to every owned structure. */
  opexMultiplier: 1,
  liquidationRate: 0.25,
  minCredits: -60,
  insolventTurnsToFail: 2,
};

export const MARKET = {
  elecBase: 1.15,
  computeBase: 0.42,
  fuelBase: 1.6,
  importFee: 1.3,
  exportFee: 0.78,
  importPerSub: 22,
  exportPerSub: 18,
  drBase: 3.4,
  priceDrift: 0.06,
};

export const WEATHER: Record<
  WeatherKind,
  {
    name: string;
    solar: number;
    wind: number;
    cooling: number;
    hydro: number;
    elecPrice: number;
    computePrice: number;
    fuel: number;
    blurb: string;
  }
> = {
  clear: {
    name: 'Clear Skies',
    solar: 1,
    wind: 1,
    cooling: 1,
    hydro: 1,
    elecPrice: 1,
    computePrice: 1,
    fuel: 1,
    blurb: 'Mild conditions. Forecasts are reliable.',
  },
  heatwave: {
    name: 'Heatwave',
    solar: 1.12,
    wind: 0.82,
    cooling: 1.12,
    hydro: 0.92,
    elecPrice: 1.22,
    computePrice: 1,
    fuel: 1.05,
    blurb: 'Cooling demand soars and the grid tightens.',
  },
  cold_snap: {
    name: 'Cold Snap',
    solar: 0.9,
    wind: 1.1,
    cooling: 0.9,
    hydro: 1,
    elecPrice: 1.12,
    computePrice: 1,
    fuel: 1.12,
    blurb: 'Excellent free cooling, but power is in demand.',
  },
  storm: {
    name: 'Storm Front',
    solar: 0.55,
    wind: 1.35,
    cooling: 1.06,
    hydro: 1.2,
    elecPrice: 1.18,
    computePrice: 1,
    fuel: 1.05,
    blurb: 'Solar collapses, wind surges, transmission gets stressed.',
  },
  wind_drought: {
    name: 'Wind Drought',
    solar: 1.08,
    wind: 0.45,
    cooling: 1,
    hydro: 0.85,
    elecPrice: 1.15,
    computePrice: 1,
    fuel: 1.08,
    blurb: 'Still air. Wind parks underperform for the whole period.',
  },
  dust_storm: {
    name: 'Dust Storm',
    solar: 0.7,
    wind: 0.85,
    cooling: 0.92,
    hydro: 1,
    elecPrice: 1.2,
    computePrice: 0.98,
    fuel: 1.04,
    blurb: 'Abrasive dust dims solar farms and fouls cooling towers.',
  },
};

export const MARKET_EVENTS: Record<
  MarketEventKind,
  {
    name: string;
    computePrice: number;
    elecPrice: number;
    fuel: number;
    blurb: string;
  }
> = {
  none: {
    name: 'No Market Event',
    computePrice: 1,
    elecPrice: 1,
    fuel: 1,
    blurb: 'Markets trade in their normal band.',
  },
  ai_boom: {
    name: 'AI Demand Boom',
    computePrice: 1.65,
    elecPrice: 1.05,
    fuel: 1,
    blurb: 'Enterprise AI demand explodes. Compute prices spike.',
  },
  solar_oversupply: {
    name: 'Solar Oversupply',
    computePrice: 1,
    elecPrice: 0.62,
    fuel: 1,
    blurb: 'Midday renewable surplus crashes wholesale power prices.',
  },
  grid_emergency: {
    name: 'Grid Emergency',
    computePrice: 1.12,
    elecPrice: 1.85,
    fuel: 1.35,
    blurb: 'Reserve shortage. Flexible load and storage earn premium DR payments.',
  },
  fuel_spike: {
    name: 'Fuel Price Spike',
    computePrice: 1,
    elecPrice: 1.3,
    fuel: 1.9,
    blurb: 'Gas is expensive this period. Renewables and storage shine.',
  },
  compute_slump: {
    name: 'Compute Glut',
    computePrice: 0.68,
    elecPrice: 0.95,
    fuel: 1,
    blurb: 'Rival supply floods the market. Compute prices fall.',
  },
};

export const VICTORY = {
  computeShare: 0.6,
  computeShareTurns: 3,
  computeEarliestTurn: 18,
  firmGen: 130,
  gridLinks: 6,
  treasury: 260,
  profit: 45,
  energyTurns: 2,
  efficiency: 14,
  leadershipTurns: 2,
  maxTurns: 40,
  score: {
    perRevenue: 0.04,
    perTech: 8,
    perTile: 2,
    perShare: 150,
    perCredit: 0.03,
  },
};

export const PLAYER_IDENTITIES: Array<{
  company: string;
  ceo: string;
  persona: Persona;
  color: string;
  accent: string;
  dark: string;
  blurb: string;
}> = [
  {
    company: 'Nexus Grid',
    ceo: 'You',
    persona: 'player',
    color: '#4dd6c1',
    accent: '#a6fff2',
    dark: '#0d4a44',
    blurb: 'Balanced incumbent with a strong balance sheet.',
  },
  {
    company: 'Helios Energy',
    ceo: 'Ada Sun',
    persona: 'helios',
    color: '#f5c04a',
    accent: '#ffe6a3',
    dark: '#5a430d',
    blurb: 'Renewable purist. Cheap solar, cheap power, relentless expansion.',
  },
  {
    company: 'Titan Compute',
    ceo: 'Marcus Volt',
    persona: 'titan',
    color: '#ff6b6b',
    accent: '#ffc2c2',
    dark: '#5a1717',
    blurb: 'Compute maximalist. Builds big campuses and floods the market.',
  },
  {
    company: 'Volt Dynamics',
    ceo: 'Iris Ampere',
    persona: 'volt',
    color: '#a78bfa',
    accent: '#ddd0ff',
    dark: '#3a2a58',
    blurb: 'Grid operator. Batteries, demand response and ironclad reliability.',
  },
];

export interface PersonaWeights {
  renewable: number;
  compute: number;
  grid: number;
  storage: number;
  research: number;
  expansion: number;
  aggression: number;
  risk: number;
}

export const PERSONA_WEIGHTS: Record<Persona, PersonaWeights> = {
  player: { renewable: 1, compute: 1, grid: 1, storage: 1, research: 1, expansion: 1, aggression: 1, risk: 1 },
  helios: { renewable: 1.9, compute: 1.05, grid: 1.2, storage: 0.8, research: 1.1, expansion: 1.3, aggression: 0.8, risk: 0.8 },
  titan: { renewable: 0.8, compute: 2.0, grid: 1.1, storage: 0.75, research: 1.0, expansion: 1.15, aggression: 1.3, risk: 1.25 },
  volt: { renewable: 1.0, compute: 1.0, grid: 1.7, storage: 2.4, research: 1.25, expansion: 0.95, aggression: 0.8, risk: 0.6 },
};

export const DIFFICULTY = {
  relaxed: { aiBudget: 0.78, aiAggression: 0.8 },
  standard: { aiBudget: 1, aiAggression: 1 },
  brutal: { aiBudget: 1.22, aiAggression: 1.25 },
};

export const WEATHER_WEIGHTS: Record<WeatherKind, number> = {
  clear: 34,
  heatwave: 14,
  cold_snap: 14,
  storm: 14,
  wind_drought: 12,
  dust_storm: 12,
};

export const MARKET_EVENT_WEIGHTS: Record<MarketEventKind, number> = {
  none: 42,
  ai_boom: 13,
  solar_oversupply: 13,
  grid_emergency: 10,
  fuel_spike: 11,
  compute_slump: 11,
};
