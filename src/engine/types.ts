/** GRIDPOWER — core simulation types. Single authoritative state, serialisable to JSON. */

export type Terrain =
  | 'ocean'
  | 'plains'
  | 'desert'
  | 'mountain'
  | 'forest'
  | 'river'
  | 'coast'
  | 'geothermal'
  | 'urban'
  | 'basin';

export type StructureType =
  | 'solar'
  | 'wind'
  | 'gas'
  | 'hydro'
  | 'nuclear'
  | 'geothermal'
  | 'battery'
  | 'line'
  | 'substation'
  | 'edge_dc'
  | 'hyper_dc'
  | 'giga_dc'
  | 'lab';

export type StructureCategory = 'generation' | 'grid' | 'data' | 'storage' | 'research';

export type PolicyId =
  | 'max_compute'
  | 'max_profit'
  | 'min_energy'
  | 'grid_flexible'
  | 'reliability_first';

export type Persona = 'helios' | 'titan' | 'volt' | 'player';

export type WeatherKind =
  | 'clear'
  | 'heatwave'
  | 'cold_snap'
  | 'storm'
  | 'wind_drought'
  | 'dust_storm';

export type MarketEventKind =
  | 'none'
  | 'ai_boom'
  | 'solar_oversupply'
  | 'grid_emergency'
  | 'fuel_spike'
  | 'compute_slump';

export type OverlayId = 'none' | 'power' | 'compute' | 'ownership' | 'economy';

export interface Structure {
  id: number;
  type: StructureType;
  /** -1 = neutral (pre-existing infrastructure that can be acquired). */
  owner: number;
  policy: PolicyId;
  /** Battery state of charge in MWh. */
  soc: number;
  builtTurn: number;
}

export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  /** Bitmask of players that have revealed this tile. */
  revealed: number;
  /** -1 = unclaimed. */
  owner: number;
  structure: Structure | null;
  /** Visual variation, deterministic per tile. */
  variant: number;
  /** 0..1 elevation used by renderer and wind/geothermal hints. */
  elevation: number;
}

export interface PlayerStats {
  compute: number;
  revenue: number;
  expenses: number;
  netProfit: number;
  powerGen: number;
  powerUsed: number;
  stability: number;
  share: number;
  lifetimeRevenue: number;
  lifetimeCompute: number;
  efficiency: number;
}

export interface HistoryPoint {
  turn: number;
  credits: number;
  compute: number;
  profit: number;
  share: number;
}

export interface Player {
  id: number;
  company: string;
  ceo: string;
  persona: Persona;
  isAI: boolean;
  eliminated: boolean;
  credits: number;
  researchPoints: number;
  techs: string[];
  defaultPolicy: PolicyId;
  insolventTurns: number;
  stats: PlayerStats;
  history: HistoryPoint[];
  /** Consecutive turns at or above compute-dominance share. */
  dominanceStreak: number;
  /** Consecutive turns meeting the technology-leadership condition. */
  leadershipStreak: number;
  /** Consecutive turns meeting the energy-empire condition. */
  energyStreak: number;
}

export interface Conditions {
  weather: WeatherKind;
  marketEvent: MarketEventKind;
  solar: number;
  wind: number;
  cooling: number;
  hydro: number;
  elecPrice: number;
  computePrice: number;
  fuelPrice: number;
  headline: string;
  description: string;
}

export interface Forecast {
  conditions: Conditions;
  /** Uncertainty band for the two headline prices, shown to the player. */
  elecLow: number;
  elecHigh: number;
  computeLow: number;
  computeHigh: number;
  confidence: number;
}

export type LogKind =
  | 'info'
  | 'good'
  | 'warn'
  | 'bad'
  | 'market'
  | 'weather'
  | 'tech'
  | 'build'
  | 'ai'
  | 'victory';

export interface LogEntry {
  id: number;
  turn: number;
  kind: LogKind;
  text: string;
  player: number | null;
}

export interface PlayerReport {
  playerId: number;
  revenue: number;
  expenses: number;
  netProfit: number;
  powerGen: number;
  powerDemand: number;
  powerDelivered: number;
  curtailed: number;
  imported: number;
  exported: number;
  compute: number;
  research: number;
  stability: number;
  drRevenue: number;
  fuelCost: number;
  opex: number;
  shortfall: number;
  islands: number;
  congestedLinks: number;
  charged: number;
  discharged: number;
  outages: number;
  share: number;
  creditsAfter: number;
}

export interface TurnReport {
  turn: number;
  conditions: Conditions;
  players: PlayerReport[];
  worldNotes: string[];
}

export type WinType = 'compute' | 'energy' | 'technology' | 'score';

export interface GameResult {
  winner: number;
  winType: WinType;
  scores: number[];
  turn: number;
}

export interface GameSettings {
  mapSize: number;
  aiCount: number;
  maxTurns: number;
  seed: number;
  difficulty: 'relaxed' | 'standard' | 'brutal';
}

export interface VictoryState {
  winner: number | null;
  winType: WinType | null;
}

export interface GameState {
  version: number;
  seed: number;
  rngState: number;
  turn: number;
  settings: GameSettings;
  width: number;
  height: number;
  tiles: Tile[];
  players: Player[];
  conditions: Conditions;
  forecast: Forecast;
  /** Market clearing factor for compute, driven by total fleet supply. */
  marketSaturation: number;
  log: LogEntry[];
  nextLogId: number;
  nextStructureId: number;
  report: TurnReport | null;
  phase: 'playing' | 'gameover';
  result: GameResult | null;
  /** Items queued for the next turn report (e.g. rival builds spotted). */
  pendingNotes: string[];
}

/* ------------------------------------------------------------------ */
/* Simulation-side plan structures                                     */
/* ------------------------------------------------------------------ */

export type PowerNodeKind = 'generation' | 'data' | 'storage' | 'research' | 'grid' | 'market';

export interface PowerNode {
  index: number;
  x: number;
  y: number;
  type: StructureType;
  kind: PowerNodeKind;
  /** Installed capacity in MW. */
  cap: number;
  /** Link/tie capacity in MW. */
  tie: number;
  /** Energy injected after weather/tech multipliers (planning values). */
  supply: number;
  /** Requested facility power in MW. */
  demand: number;
  marginal: number;
  /** Actual power flowing out of this node (energy supplied). */
  produced: number;
  /** Actual power delivered to this node (for loads). */
  served: number;
  island: number;
  /** Battery-specific. */
  soc: number;
  socAfter: number;
  marketRole: 'none' | 'import' | 'export';
  pue: number;
  compute: number;
  revenue: number;
}

export interface PowerLink {
  a: number;
  b: number;
  cap: number;
  flow: number;
  congested: boolean;
}

export interface IslandInfo {
  id: number;
  genCap: number;
  demand: number;
  delivered: number;
  shortfall: number;
  surplus: number;
  stability: number;
  congested: number;
  nodes: number;
}

export interface PowerPlan {
  nodes: PowerNode[];
  links: PowerLink[];
  islands: IslandInfo[];
  genCap: number;
  demand: number;
  delivered: number;
  shortfall: number;
  surplus: number;
  curtailed: number;
  imports: number;
  exports: number;
  drRevenue: number;
  stability: number;
  congested: number;
  batteryCharge: number;
  batteryDischarge: number;
  dcEfficiency: number;
  compute: number;
  computeRevenue: number;
  importCost: number;
  exportRevenue: number;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}
