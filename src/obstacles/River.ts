import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";

// A river doesn't block movement outright (spec section 12.3) - Herd.update()
// slows and loosens the cohesion of anyone currently inside one, so the
// formation visibly spreads while crossing. A skilled player should be able
// to get most of the herd across intact.
export class River {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly gfx: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.gfx = scene.add.rectangle(x, y, width, height, GAME_CONFIG.riverColor, GAME_CONFIG.riverAlpha);
  }

  contains(px: number, py: number): boolean {
    return Math.abs(px - this.x) <= this.width / 2 && Math.abs(py - this.y) <= this.height / 2;
  }

  // Used by EncounterDirector once this river's chunk is behind the player.
  destroy(): void {
    this.gfx.destroy();
  }
}
