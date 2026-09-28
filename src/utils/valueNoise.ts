import { hashCellSeed } from "./seededRandom";

// Dependency-free 2D value noise (docs/v0.3-biome-map.md section 3.4): hash
// the four integer corners of whichever grid cell a coordinate falls in,
// then smoothly interpolate between them. No external noise library - this
// keeps the "no new dependencies" property the project has had since M0.
function hashToUnit(x: number, y: number, seed: number): number {
  return hashCellSeed(x, y, seed) / 0xffffffff;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Returns a value in [0, 1). `x`/`y` are in the same units as `scale` - the
// noise repeats its grid every `scale` units, so a larger scale means
// broader, slower-changing features.
export function valueNoise2D(x: number, y: number, seed: number, scale: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const tx = smoothstep(sx - x0);
  const ty = smoothstep(sy - y0);

  const n00 = hashToUnit(x0, y0, seed);
  const n10 = hashToUnit(x0 + 1, y0, seed);
  const n01 = hashToUnit(x0, y0 + 1, seed);
  const n11 = hashToUnit(x0 + 1, y0 + 1, seed);

  return lerp(lerp(n00, n10, tx), lerp(n01, n11, tx), ty);
}

// A few octaves at different scales (spec section 3.4) for a less
// obviously-gridded look than a single valueNoise2D call. Still returns
// [0, 1).
export function fractalNoise2D(x: number, y: number, seed: number, octaves: number, baseScale: number): number {
  let amplitude = 1;
  let scale = baseScale;
  let sum = 0;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(x, y, seed + i * 101, scale) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    scale *= 0.5;
  }
  return sum / max;
}
