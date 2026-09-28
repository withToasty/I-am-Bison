import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { lighten, darken } from "../utils/color";

// A rock blocks the herd until it's broken - like a fence, breaking one
// depends entirely on the herd's size at the moment the leader touches it
// (Herd.handleRockCollisions), not on any behavior of the rock itself. A
// herd too small to break through bounces followers off it (or, if tiny,
// loses whoever touched it outright) exactly like an unbroken fence.
export class Rock {
  readonly x: number;
  readonly y: number;
  readonly radius = GAME_CONFIG.rockRadius;
  readonly breakThreshold: number;
  broken = false;
  readonly gfx: Phaser.GameObjects.Arc;
  private readonly highlight: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number, breakThreshold: number = GAME_CONFIG.rockBreakHerdSize) {
    this.x = x;
    this.y = y;
    this.breakThreshold = breakThreshold;
    this.gfx = scene.add
      .circle(x, y, this.radius, GAME_CONFIG.rockColor)
      .setStrokeStyle(2, darken(GAME_CONFIG.rockColor, 0.3), 0.9);
    // A small lighter dome offset toward the "light source" so a flat disc
    // reads as a rounded boulder, matching the bison's shading treatment.
    this.highlight = scene.add.circle(
      x - this.radius * 0.3,
      y - this.radius * 0.35,
      this.radius * 0.45,
      lighten(GAME_CONFIG.rockColor, 0.25),
      0.55,
    );
  }

  break(): void {
    this.broken = true;
    this.gfx.destroy();
    this.highlight.destroy();
  }

  // Used once this rock's cell/landmark is behind the player. A broken rock
  // has already destroyed its own graphics via break() above, so this must
  // not try to destroy them again (mirrors Fence.destroy()).
  destroy(): void {
    if (!this.broken) {
      this.gfx.destroy();
      this.highlight.destroy();
    }
  }
}
