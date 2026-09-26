import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { WildBison } from "../entities/WildBison";

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
