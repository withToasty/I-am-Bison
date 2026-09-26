import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { lighten, darken } from "../utils/color";

// A rock is a static, unbreakable obstacle (spec section 12.1). It has no
// behavior of its own - Herd.handleRockCollisions() is what shoves a
// colliding bison clear of it. The player is responsible for steering the
// herd's general path around it; individual bison don't dodge on their own.
export class Rock {
  readonly x: number;
  readonly y: number;
  readonly radius = GAME_CONFIG.rockRadius;
  readonly gfx: Phaser.GameObjects.Arc;
  private readonly highlight: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;
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

  // Used by EncounterDirector once this rock's chunk is behind the player.
  destroy(): void {
    this.gfx.destroy();
    this.highlight.destroy();
  }
}
