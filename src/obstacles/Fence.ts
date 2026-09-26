import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";

// A fence blocks the herd until it's broken (spec section 12.2). This class
// only holds the fence's shape and visual/broken state - Herd decides
// whether a given collision breaks it, since that depends on herd size.
export class Fence {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  broken = false;
  readonly gfx: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = GAME_CONFIG.fenceThickness;
    this.gfx = scene.add.rectangle(x, y, width, this.height, GAME_CONFIG.fenceColor);
  }

  // The point on the fence's rectangle closest to (px, py).
  closestPoint(px: number, py: number): { x: number; y: number } {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    return {
      x: this.x + Phaser.Math.Clamp(px - this.x, -halfW, halfW),
      y: this.y + Phaser.Math.Clamp(py - this.y, -halfH, halfH),
    };
  }

  break(): void {
    this.broken = true;
    this.gfx.destroy();
  }
}
