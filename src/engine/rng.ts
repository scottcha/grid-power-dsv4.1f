/** Deterministic seeded PRNG (mulberry32). State is a single uint32, JSON-safe. */

export class Rng {
  state: number;

  constructor(seed: number) {
    // Mix the seed so that seed 0 / 1 / 2 are far apart in the stream.
    this.state = (seed + 0x6d2b79f5) >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    let total = 0;
    for (const [, w] of entries) total += w;
    let roll = this.next() * total;
    for (const [value, w] of entries) {
      roll -= w;
      if (roll <= 0) return value;
    }
    return entries[entries.length - 1][0];
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  fork(): Rng {
    return new Rng(Math.floor(this.next() * 0xffffffff));
  }
}

export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/** Smooth 2D value noise built from a seeded lattice. */
export class ValueNoise {
  private lattice: number[];
  private size: number;

  constructor(size: number, rng: Rng) {
    this.size = size;
    this.lattice = new Array((size + 1) * (size + 1));
    for (let i = 0; i < this.lattice.length; i++) this.lattice[i] = rng.next();
  }

  private at(ix: number, iy: number): number {
    const x = Math.max(0, Math.min(this.size, ix));
    const y = Math.max(0, Math.min(this.size, iy));
    return this.lattice[y * (this.size + 1) + x];
  }

  sample(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = this.at(x0, y0);
    const b = this.at(x0 + 1, y0);
    const c = this.at(x0, y0 + 1);
    const d = this.at(x0 + 1, y0 + 1);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  }

  fbm(x: number, y: number, octaves = 3): number {
    let value = 0;
    let amp = 0.55;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      value += this.sample(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.55;
      freq *= 2;
    }
    return value / norm;
  }
}
