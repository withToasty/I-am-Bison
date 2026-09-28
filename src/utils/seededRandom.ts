// A small, dependency-free seeded PRNG (mulberry32) plus a stable hash from
// integer cell coordinates to a seed. World content (WorldGrid) must be
// reproducible from a coordinate alone so revisiting a place regenerates
// the same layout instead of finding it deleted - that requires seeded
// randomness here instead of Phaser's global, unseeded Math.random-backed
// RNG (Phaser.Math.Between/FloatBetween/...), which is still fine to use
// anywhere reproducibility doesn't matter (feedback effects, dust, etc.).
export function hashCellSeed(cellX: number, cellY: number, runSeed: number): number {
  let h = (cellX * 374761393 + cellY * 668265263 + runSeed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  // Float in [0, 1).
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}
