import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";

// A rock is a static, unbreakable obstacle (spec section 12.1). It has no
// behavior of its own - Herd.handleRockCollisions() is what shoves a
// colliding bison clear of it. The player is responsible for steering the
// herd's general path around it; individual bison don't dodge on their own.
export class Rock {
  readonly x: number;
  readonly y: number;
  readonly radius = GAME_CONFIG.rockRadius;
  readonly gfx: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.gfx = scene.add.circle(x, y, this.radius, GAME_CONFIG.rockColor);
  }
}
