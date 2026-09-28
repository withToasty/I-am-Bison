import { GAME_CONFIG } from "../config/gameConfig";
import { fractalNoise2D } from "../utils/valueNoise";

// Two independent noise channels (v0.3 M-G3, docs/v0.3-biome-map.md
// sections 3.2-3.3), both seeded off the run seed but offset so they don't
// correlate with each other or with per-cell content seeding.
const RIVER_SEED_OFFSET = 0x9e3779b9;
const WOBBLE_SEED_OFFSET = 0x2545f491;

// A river isn't tied to any biome ring - real rivers cut across terrain.
// This is a single independent noise field over the whole world; wherever
// it crosses a threshold, that area is "river zone" regardless of which
// ring it falls in (WorldGrid overrides normal template selection there).
export function isRiverZone(x: number, y: number, runSeed: number): boolean {
  const n = fractalNoise2D(x, y, (runSeed ^ RIVER_SEED_OFFSET) >>> 0, 2, GAME_CONFIG.riverNoiseScale);
  return n > GAME_CONFIG.riverNoiseThreshold;
}

// Perturbs every ring boundary by the same factor at a given compass angle,
// so boundaries wobble into an organic coastline instead of a perfect
// circle, without ever crossing or gapping each other (every biome's
// fadeIn/fadeOut radii get multiplied by the same scale - see Biomes.ts).
// Sampling noise at a point on a small circle in angle-space (rather than
// noise(angle) directly) keeps it seamless across the 0/2*PI wrap.
export function ringWobbleScale(angle: number, runSeed: number): number {
  const nx = Math.cos(angle) * GAME_CONFIG.ringWobbleSampleRadius;
  const ny = Math.sin(angle) * GAME_CONFIG.ringWobbleSampleRadius;
  const n = fractalNoise2D(nx, ny, (runSeed ^ WOBBLE_SEED_OFFSET) >>> 0, 2, GAME_CONFIG.ringWobbleSampleRadius / 2);
  return 1 + GAME_CONFIG.ringWobbleAmount * (n * 2 - 1);
}
