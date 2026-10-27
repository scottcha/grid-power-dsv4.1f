import type { ActionResult, GameState, PolicyId, StructureType, Tile } from './types';
import { ECONOMY, MAP, POLICIES, STRUCTURES, TECH_MAP } from './balance';
import { buildCost } from './compute';
import { structureTech, structureUnlocked, techSummary, canResearch } from './tech';
import { tileAt } from './worldgen';
import { addLog } from './log';

export function isRevealed(tile: Tile, playerId: number): boolean {
  return (tile.revealed & (1 << playerId)) !== 0;
}

export function claimCost(state: GameState, playerId: number, tile: Tile): number {
  let owned = 0;
  for (const t of state.tiles) if (t.owner === playerId) owned++;
  const base = Math.min(ECONOMY.claimMax, ECONOMY.claimBase + Math.floor(owned / ECONOMY.claimStep));
  const neutral = tile.structure && tile.structure.owner === -1 ? ECONOMY.neutralAcquireExtra : 0;
  return base + neutral;
}

/** Any land tile not owned and orthogonally or diagonally adjacent to owned land. */
export function claimCandidates(state: GameState, playerId: number): Tile[] {
  const out: Tile[] = [];
  for (const t of state.tiles) {
    if (t.owner === playerId || t.terrain === 'ocean') continue;
    if (!isRevealed(t, playerId)) continue;
    if (t.owner !== -1) continue;
    if (hasOwnedNeighbour(state, t, playerId)) out.push(t);
  }
  return out;
}

function hasOwnedNeighbour(state: GameState, tile: Tile, playerId: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const n = tileAt(state, tile.x + dx, tile.y + dy);
      if (n && n.owner === playerId) return true;
    }
  }
  return false;
}

export function claimTile(state: GameState, playerId: number, x: number, y: number): ActionResult {
  if (state.phase !== 'playing') return { ok: false, error: 'Game is over' };
  const player = state.players[playerId];
  if (!player || player.eliminated) return { ok: false, error: 'No such player' };
  const tile = tileAt(state, x, y);
  if (!tile) return { ok: false, error: 'Invalid tile' };
  if (tile.terrain === 'ocean') return { ok: false, error: 'Cannot claim open water' };
  if (!isRevealed(tile, playerId)) return { ok: false, error: 'Tile not surveyed yet' };
  if (tile.owner === playerId) return { ok: false, error: 'Already yours' };
  if (tile.owner !== -1) return { ok: false, error: 'Held by a rival' };
  if (!hasOwnedNeighbour(state, tile, playerId)) return { ok: false, error: 'Must border your territory' };
  const cost = claimCost(state, playerId, tile);
  if (player.credits < cost) return { ok: false, error: `Need ${cost} credits` };
  player.credits -= cost;
  tile.owner = playerId;
  let acq = '';
  if (tile.structure && tile.structure.owner === -1) {
    tile.structure.owner = playerId;
    acq = ` Acquired the neutral ${STRUCTURES[tile.structure.type].name}.`;
    addLog(state, 'good', `${player.company} acquired a strategic substation at ${x},${y}.`, playerId);
  }
  revealAround(state, tile.x, tile.y, playerId, MAP.revealRadiusClaim);
  if (playerId === 0 || acq) {
    addLog(state, 'info', `${player.company} claimed ${tile.terrain} at ${x},${y} for ${cost} credits.${acq}`, playerId);
  }
  return { ok: true };
}

export function revealAround(state: GameState, x: number, y: number, playerId: number, radius: number): void {
  for (const t of state.tiles) {
    if (Math.hypot(t.x - x, t.y - y) <= radius + 0.1) t.revealed |= 1 << playerId;
  }
}

export function buildCandidates(state: GameState, playerId: number, type: StructureType): Tile[] {
  const out: Tile[] = [];
  const def = STRUCTURES[type];
  for (const t of state.tiles) {
    if (t.owner !== playerId || t.structure) continue;
    if (!def.build.includes(t.terrain)) continue;
    out.push(t);
  }
  return out;
}

export function canBuild(
  state: GameState,
  playerId: number,
  type: StructureType,
  x: number,
  y: number,
): { ok: boolean; error?: string; cost?: number } {
  if (state.phase !== 'playing') return { ok: false, error: 'Game is over' };
  const player = state.players[playerId];
  if (!player || player.eliminated) return { ok: false, error: 'No such player' };
  const tile = tileAt(state, x, y);
  if (!tile) return { ok: false, error: 'Invalid tile' };
  const def = STRUCTURES[type];
  if (tile.owner !== playerId) return { ok: false, error: 'Claim this tile first' };
  if (tile.structure) return { ok: false, error: 'Tile is occupied' };
  if (!def.build.includes(tile.terrain)) return { ok: false, error: `Cannot build on ${tile.terrain}` };
  if (!structureUnlocked(player, type)) {
    const req = structureTech(type);
    return { ok: false, error: `Requires ${TECH_MAP[req ?? '']?.name ?? 'technology'}` };
  }
  const cost = buildCost(type, techSummary(player.techs));
  if (player.credits < cost) return { ok: false, error: `Need ${cost} credits` };
  return { ok: true, cost };
}

export function buildStructure(
  state: GameState,
  playerId: number,
  type: StructureType,
  x: number,
  y: number,
): ActionResult {
  const check = canBuild(state, playerId, type, x, y);
  if (!check.ok) return { ok: false, error: check.error };
  const player = state.players[playerId];
  const tile = tileAt(state, x, y) as Tile;
  const def = STRUCTURES[type];
  player.credits -= check.cost ?? def.cost;
  tile.structure = {
    id: state.nextStructureId++,
    type,
    owner: playerId,
    policy: player.defaultPolicy,
    soc: 0,
    builtTurn: state.turn,
  };
  const notable =
    type === 'nuclear' || type === 'giga_dc' || type === 'hyper_dc' || type === 'substation';
  if (playerId === 0 || (notable && isRevealed(tile, 0))) {
    addLog(
      state,
      'build',
      `${player.company} built a ${def.name} at ${x},${y} for ${check.cost ?? def.cost} credits.`,
      playerId,
    );
  }
  return { ok: true };
}

export function canUpgrade(
  state: GameState,
  playerId: number,
  x: number,
  y: number,
): { ok: boolean; error?: string; cost?: number; to?: StructureType } {
  if (state.phase !== 'playing') return { ok: false, error: 'Game is over' };
  const player = state.players[playerId];
  const tile = tileAt(state, x, y);
  if (!tile || !tile.structure || tile.structure.owner !== playerId) return { ok: false, error: 'Not your facility' };
  const def = STRUCTURES[tile.structure.type];
  if (!def.upgradeTo) return { ok: false, error: 'Nothing to upgrade' };
  if (!structureUnlocked(player, def.upgradeTo)) {
    const req = structureTech(def.upgradeTo);
    return { ok: false, error: `Requires ${TECH_MAP[req ?? '']?.name ?? 'technology'}` };
  }
  const mods = techSummary(player.techs);
  const cost = Math.round((def.upgradeCost ?? STRUCTURES[def.upgradeTo].cost * 0.78) * (1 + mods.dcCostPct / 100));
  if (player.credits < cost) return { ok: false, error: `Need ${cost} credits` };
  return { ok: true, cost, to: def.upgradeTo };
}

export function upgradeFacility(state: GameState, playerId: number, x: number, y: number): ActionResult {
  const check = canUpgrade(state, playerId, x, y);
  if (!check.ok || !check.to) return { ok: false, error: check.error };
  const player = state.players[playerId];
  const tile = tileAt(state, x, y) as Tile;
  if (!tile.structure) return { ok: false, error: 'Not your facility' };
  player.credits -= check.cost ?? 0;
  const from = STRUCTURES[tile.structure.type].name;
  tile.structure.type = check.to;
  addLog(
    state,
    'good',
    `${player.company} upgraded ${from} → ${STRUCTURES[check.to].name} at ${x},${y} for ${check.cost} credits.`,
    playerId,
  );
  return { ok: true };
}

export function demolishFacility(state: GameState, playerId: number, x: number, y: number): ActionResult {
  const tile = tileAt(state, x, y);
  if (!tile || !tile.structure || tile.structure.owner !== playerId) return { ok: false, error: 'Not your facility' };
  const player = state.players[playerId];
  const def = STRUCTURES[tile.structure.type];
  const refund = Math.round(def.cost * ECONOMY.liquidationRate);
  player.credits += refund;
  tile.structure = null;
  addLog(state, 'info', `${player.company} demolished a ${def.name} for ${refund} credits salvage.`, playerId);
  return { ok: true };
}

export function researchTech(state: GameState, playerId: number, techId: string): ActionResult {
  if (state.phase !== 'playing') return { ok: false, error: 'Game is over' };
  const player = state.players[playerId];
  const tech = TECH_MAP[techId];
  if (!tech) return { ok: false, error: 'Unknown technology' };
  if (!canResearch(player, techId)) return { ok: false, error: 'Prerequisites missing or already researched' };
  if (player.researchPoints < tech.cost) return { ok: false, error: `Need ${tech.cost} RP` };
  player.researchPoints -= tech.cost;
  player.techs.push(techId);
  addLog(state, 'tech', `${player.company} researched ${tech.name}.`, playerId);
  return { ok: true };
}

export function setDataCenterPolicy(
  state: GameState,
  playerId: number,
  x: number,
  y: number,
  policy: PolicyId,
): ActionResult {
  if (state.phase !== 'playing') return { ok: false, error: 'Game is over' };
  const tile = tileAt(state, x, y);
  if (!tile || !tile.structure || tile.structure.owner !== playerId) return { ok: false, error: 'Not your facility' };
  if (!STRUCTURES[tile.structure.type].dc) return { ok: false, error: 'Not a data center' };
  if (!POLICIES[policy]) return { ok: false, error: 'Unknown policy' };
  tile.structure.policy = policy;
  return { ok: true };
}

export function setDefaultPolicy(state: GameState, playerId: number, policy: PolicyId): ActionResult {
  if (state.phase !== 'playing') return { ok: false, error: 'Game is over' };
  const player = state.players[playerId];
  if (!POLICIES[policy]) return { ok: false, error: 'Unknown policy' };
  player.defaultPolicy = policy;
  for (const tile of state.tiles) {
    if (tile.structure && tile.structure.owner === playerId && STRUCTURES[tile.structure.type].dc) {
      tile.structure.policy = policy;
    }
  }
  addLog(state, 'info', `${player.company} set fleet policy: ${POLICIES[policy].name}.`, playerId);
  return { ok: true };
}

export function surveyArea(state: GameState, playerId: number, x: number, y: number): ActionResult {
  const player = state.players[playerId];
  if (state.phase !== 'playing') return { ok: false, error: 'Game is over' };
  if (player.credits < MAP.surveyCost) return { ok: false, error: `Need ${MAP.surveyCost} credits` };
  const tile = tileAt(state, x, y);
  if (!tile) return { ok: false, error: 'Invalid tile' };
  let nearest = Infinity;
  for (const t of state.tiles) {
    if (t.owner !== playerId) continue;
    nearest = Math.min(nearest, Math.max(Math.abs(t.x - x), Math.abs(t.y - y)));
  }
  if (nearest > 6) return { ok: false, error: 'Too far from your territory' };
  player.credits -= MAP.surveyCost;
  revealAround(state, x, y, playerId, MAP.surveyRadius);
  addLog(state, 'info', `${player.company} ran a grid survey around ${x},${y}.`, playerId);
  return { ok: true };
}
