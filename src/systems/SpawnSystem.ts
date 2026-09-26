import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { WildBison } from "../entities/WildBison";
import { Rock } from "../obstacles/Rock";
import { Fence } from "../obstacles/Fence";

interface WildGroup {
  x: number;
  y: number;
  count: number;
}

// Placeholder placement for v0.1 (spec section 11): a few groups of varying
// size scattered in different directions from the herd's starting point, so
// steering toward one side or the other is a real route choice rather than
// pure randomness. Real procedural placement is a later milestone.
const WILD_GROUPS: WildGroup[] = [
  { x: -220, y: -260, count: 1 },
  { x: 260, y: -220, count: 3 },
  { x: -80, y: -430, count: 5 },
  { x: 320, y: -420, count: 2 },
];

export function spawnWildBison(scene: Phaser.Scene): WildBison[] {
  const wildBison: WildBison[] = [];

  for (const group of WILD_GROUPS) {
    for (let i = 0; i < group.count; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const radius = Phaser.Math.FloatBetween(0, GAME_CONFIG.separationRadius * 1.5);
      const x = group.x + Math.cos(angle) * radius;
      const y = group.y + Math.sin(angle) * radius;
      wildBison.push(new WildBison(scene, x, y));
    }
  }

  return wildBison;
}

// Placeholder placement for v0.1 (spec section 12.1): a handful of rocks
// sitting roughly between spawn and the wild bison groups above, so avoiding
// one is a real choice on the way to a recruit rather than an afterthought.
const ROCK_POSITIONS: { x: number; y: number }[] = [
  { x: 40, y: -60 },
  { x: -110, y: -160 },
  { x: 150, y: -150 },
  { x: -40, y: -300 },
  { x: 260, y: -330 },
];

export function spawnRocks(scene: Phaser.Scene): Rock[] {
  return ROCK_POSITIONS.map(({ x, y }) => new Rock(scene, x, y));
}

// Placeholder placement for v0.1 (spec section 12.2): a couple of fence
// spans further out than the rocks, so the player has already had a chance
// to grow the herd a little before meeting a size-gated obstacle.
const FENCE_SPANS: { x: number; y: number; width: number }[] = [
  { x: -30, y: -560, width: 150 },
  { x: 220, y: -650, width: 170 },
];

export function spawnFences(scene: Phaser.Scene): Fence[] {
  return FENCE_SPANS.map(({ x, y, width }) => new Fence(scene, x, y, width));
}
