import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";

// A single placeholder bison. It owns its own position/velocity and current
// display color; Herd is responsible for applying boids forces and moving it
// each frame. It has no graphics object of its own - GameScene batch-draws
// every bison of a given color as one filled path per frame (see
// GameScene.drawBison), which avoids the faint seam artifact that shows up
// at the shared edge of two separately-composited overlapping circles once
// enough of them are packed together.
export class Bison {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  color: number;
  timeBeyondLostRadius = 0;
  // Counts down after falling out of the herd, during which recruit() won't
  // pick this bison back up even if it's within joinRadius. Without it, an
  // obstacle-instant-loss right next to a small/tight herd gets immediately
  // re-recruited, walks straight back into the same obstacle, and repeats
  // every frame - see Herd.strand().
  recruitCooldown = 0;
  // Fixed at spawn: how quickly this individual's velocity can realign to a
  // changing herd heading. Most bison are close to 1; a few are naturally
  // slow and risk falling behind during a sharp, sustained turn.
  readonly agility: number;

  constructor(x: number, y: number, color: number = GAME_CONFIG.bisonColor) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.agility = Phaser.Math.FloatBetween(GAME_CONFIG.minAgility, GAME_CONFIG.maxAgility);
  }
}
