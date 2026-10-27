import type { GameState, Tile, Terrain } from './types';
import { Rng, ValueNoise } from './rng';
import { MAP, TERRAIN_INFO } from './balance';

export interface StartSpot {
  x: number;
  y: number;
}

export interface GeneratedWorld {
  width: number;
  height: number;
  tiles: Tile[];
  starts: StartSpot[];
  rngState: number;
}

const OCTAVES = 3;

export function generateWorld(seed: number, width: number, height: number, players: number): GeneratedWorld {
  const rng = new Rng(seed ^ 0x9e3779b9);
  const elevNoise = new ValueNoise(Math.max(width, height), rng);
  const heatNoise = new ValueNoise(Math.max(width, height), rng);
  const moistNoise = new ValueNoise(Math.max(width, height), rng);
  const variants = new Array<number>(width * height);
  for (let i = 0; i < variants.length; i++) variants[i] = rng.int(1000);

  const elevation: number[] = [];
  const heat: number[] = [];
  const moisture: number[] = [];
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const maxR = Math.hypot(cx, cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x / width) * 4;
      const ny = (y / height) * 4;
      // Soft island falloff keeps a readable coastline instead of noisy map edges.
      const island = 1 - Math.pow(Math.hypot(x - cx, y - cy) / maxR, 2.4) * 0.62;
      const e = elevNoise.fbm(nx, ny, OCTAVES) * 0.86 + island * 0.34 - 0.12;
      elevation.push(Math.min(1, Math.max(0, e)));
      heat.push(heatNoise.fbm(nx + 11.3, ny + 4.7, 2));
      moisture.push(moistNoise.fbm(nx + 27.1, ny + 19.4, 2));
    }
  }

  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      tiles.push({
        x,
        y,
        terrain: 'plains',
        revealed: 0,
        owner: -1,
        structure: null,
        variant: variants[i],
        elevation: elevation[i],
      });
    }
  }
  const at = (x: number, y: number): Tile | null =>
    x >= 0 && y >= 0 && x < width && y < height ? tiles[y * width + x] : null;

  // Ocean: the lowest ~24% of elevations, with a soft border.
  const landThreshold = quantile(elevation, 0.24);
  for (const t of tiles) {
    const i = t.y * width + t.x;
    const border = t.x === 0 || t.y === 0 || t.x === width - 1 || t.y === height - 1;
    if (elevation[i] < landThreshold || (border && elevation[i] < landThreshold + 0.12)) t.terrain = 'ocean';
  }

  // Mountains: highest land elevations.
  const landElevation = tiles.filter((t) => t.terrain !== 'ocean').map((t) => t.elevation);
  const mountainThreshold = quantile(landElevation, 0.84);
  for (const t of tiles) {
    if (t.terrain !== 'ocean' && t.elevation >= mountainThreshold) t.terrain = 'mountain';
  }

  // Deserts by heat, forests by moisture, on remaining flat land.
  const flat = tiles.filter((t) => t.terrain === 'plains');
  const desertThreshold = quantile(
    flat.map((t) => heat[t.y * width + t.x]),
    0.78,
  );
  const forestThreshold = quantile(
    flat.map((t) => moisture[t.y * width + t.x]),
    0.72,
  );
  for (const t of flat) {
    const i = t.y * width + t.x;
    if (heat[i] >= desertThreshold) t.terrain = 'desert';
    else if (moisture[i] >= forestThreshold) t.terrain = 'forest';
  }

  // Rivers: two downhill walks from mountain springs to the sea.
  for (let r = 0; r < 2; r++) {
    const springs = tiles.filter((t) => t.terrain === 'mountain');
    if (springs.length === 0) break;
    let cur = rng.pick(springs);
    const visited = new Set<number>();
    for (let step = 0; step < width + height; step++) {
      if (cur.terrain === 'ocean') break;
      const idx = cur.y * width + cur.x;
      if (visited.has(idx)) break;
      visited.add(idx);
      if (step > 0) cur.terrain = 'river';
      const neighbours = neighboursOf(tiles, width, height, cur.x, cur.y);
      if (neighbours.length === 0) break;
      cur = neighbours
        .map((n) => ({ n, e: n.elevation + rng.next() * 0.05 }))
        .sort((a, b) => a.e - b.e)[0].n;
    }
  }

  // Coasts: land next to ocean.
  for (const t of tiles) {
    if (t.terrain === 'ocean') continue;
    const nearOcean = neighboursOf(tiles, width, height, t.x, t.y).some((n) => n.terrain === 'ocean');
    if (nearOcean && (t.terrain === 'plains' || t.terrain === 'desert' || t.terrain === 'forest')) t.terrain = 'coast';
  }

  stampClusters(tiles, width, height, rng, 'urban', 4, 3, (t) => t.terrain === 'plains' || t.terrain === 'coast' || t.terrain === 'desert');
  stampClusters(tiles, width, height, rng, 'geothermal', players, 2, (t) => t.terrain === 'plains' || t.terrain === 'desert' || t.terrain === 'mountain');
  stampClusters(tiles, width, height, rng, 'basin', players + 1, 3, (t) => t.terrain === 'plains' || t.terrain === 'forest' || t.terrain === 'desert');

  const starts = pickStarts(tiles, width, height, players, rng);
  for (const s of starts) {
    const center = at(s.x, s.y);
    if (!center) continue;
    center.terrain = 'plains';
    center.structure = null;
    center.owner = -1;
    // Guarantee buildable neighbours so no start is boxed in.
    const ring = neighboursOf(tiles, width, height, s.x, s.y);
    const buildable = ring.filter((t) => TERRAIN_INFO[t.terrain].buildable);
    if (buildable.length > 0) {
      buildable[0].terrain = 'plains';
      buildable[0].structure = null;
    }
    if (buildable.length > 1) buildable[1].structure = null;
    for (const t of ring) {
      if (t.terrain === 'ocean' && rng.chance(0.5)) t.terrain = 'coast';
    }
    // Clear claustrophobic peaks around the start so every player has room.
    for (const t of tiles) {
      if (Math.max(Math.abs(t.x - s.x), Math.abs(t.y - s.y)) > 3) continue;
      if (t.terrain === 'mountain') t.terrain = rng.chance(0.5) ? 'forest' : 'plains';
    }
  }

  // Neutral substations: pre-existing infrastructure worth contesting.
  const neutralSpots = tiles
    .filter((t) => TERRAIN_INFO[t.terrain].buildable && !t.structure)
    .filter((t) => starts.every((s) => Math.max(Math.abs(s.x - t.x), Math.abs(s.y - t.y)) >= 3))
    .map((t) => ({
      tile: t,
      score:
        TERRAIN_INFO[t.terrain].claimValue +
        eightNeighbours(tiles, width, height, t.x, t.y).filter((n) => TERRAIN_INFO[n.terrain].claimValue >= 2.5).length,
    }))
    .sort((a, b) => b.score - a.score);
  let placed = 0;
  for (const spot of neutralSpots) {
    if (placed >= MAP.neutralSubstations) break;
    if (spot.tile.structure) continue;
    spot.tile.structure = {
      id: placed + 1,
      type: 'substation',
      owner: -1,
      policy: 'max_compute',
      soc: 0,
      builtTurn: 0,
    };
    placed++;
  }

  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    for (const t of tiles) {
      if (Math.hypot(t.x - s.x, t.y - s.y) <= MAP.revealRadiusStart) t.revealed |= 1 << i;
    }
  }

  return { width, height, tiles, starts, rngState: rng.state };
}

export function tileAt(state: Pick<GameState, 'tiles' | 'width' | 'height'>, x: number, y: number): Tile | null {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
  return state.tiles[y * state.width + x];
}

export function neighboursOf(tiles: Tile[], width: number, height: number, x: number, y: number): Tile[] {
  const out: Tile[] = [];
  for (const [nx, ny] of [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ] as Array<[number, number]>) {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    out.push(tiles[ny * width + nx]);
  }
  return out;
}

export function eightNeighbours(tiles: Tile[], width: number, height: number, x: number, y: number): Tile[] {
  const out: Tile[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      out.push(tiles[ny * width + nx]);
    }
  }
  return out;
}

function stampClusters(
  tiles: Tile[],
  width: number,
  height: number,
  rng: Rng,
  terrain: Terrain,
  count: number,
  maxSize: number,
  allowed: (t: Tile) => boolean,
): void {
  const candidates = tiles.filter(allowed);
  if (candidates.length === 0) return;
  for (let c = 0; c < count; c++) {
    let seedTile = rng.pick(candidates);
    for (let attempt = 0; attempt < 8 && seedTile.terrain === terrain; attempt++) seedTile = rng.pick(candidates);
    const size = 1 + rng.int(maxSize);
    const frontier: Tile[] = [seedTile];
    const used = new Set<number>();
    let placed = 0;
    let guard = size * 8;
    while (placed < size && frontier.length > 0 && guard-- > 0) {
      const t = frontier.splice(rng.int(frontier.length), 1)[0];
      if (used.has(t.y * width + t.x)) continue;
      used.add(t.y * width + t.x);
      t.terrain = terrain;
      placed++;
      for (const n of neighboursOf(tiles, width, height, t.x, t.y)) {
        if (allowed(n) && n.terrain === 'plains') frontier.push(n);
      }
    }
  }
}

function pickStarts(tiles: Tile[], width: number, height: number, players: number, rng: Rng): StartSpot[] {
  const candidates = tiles
    .filter(
      (t) =>
        TERRAIN_INFO[t.terrain].buildable &&
        t.x > 0 &&
        t.y > 0 &&
        t.x < width - 1 &&
        t.y < height - 1,
    )
    .map((t) => {
      const ring = neighboursOf(tiles, width, height, t.x, t.y);
      const buildable = ring.filter((n) => TERRAIN_INFO[n.terrain].buildable).length;
      const valuable = ring.filter((n) => TERRAIN_INFO[n.terrain].claimValue >= 2.5).length;
      const ocean = ring.filter((n) => n.terrain === 'ocean').length;
      return { t, score: buildable * 1.5 + valuable * 1.5 - ocean * 0.5 + rng.next() * 2 };
    })
    .sort((a, b) => b.score - a.score);

  const chosen: StartSpot[] = [];
  let minDist = Math.max(4, Math.floor(width * 0.42));
  while (chosen.length < players && minDist > 1) {
    for (const c of candidates) {
      if (chosen.length >= players) break;
      if (chosen.some((s) => s.x === c.t.x && s.y === c.t.y)) continue;
      if (chosen.every((s) => Math.max(Math.abs(s.x - c.t.x), Math.abs(s.y - c.t.y)) >= minDist)) {
        chosen.push({ x: c.t.x, y: c.t.y });
      }
    }
    minDist--;
  }
  for (const t of tiles) {
    if (chosen.length >= players) break;
    if (TERRAIN_INFO[t.terrain].buildable && !chosen.some((s) => s.x === t.x && s.y === t.y)) chosen.push({ x: t.x, y: t.y });
  }
  return chosen;
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[idx];
}
