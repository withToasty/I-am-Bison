import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";

// A single placeholder bison. It owns its own position/velocity; Herd is
// responsible for applying boids forces and moving it each frame.
export class Bison {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  readonly gfx: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.gfx = scene.add.circle(x, y, GAME_CONFIG.bisonRadius, GAME_CONFIG.bisonColor);
  }

  syncGraphics(): void {
    this.gfx.x = this.x;
    this.gfx.y = this.y;
  }
}
