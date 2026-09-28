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
  // A tile sprite rather than a flat rectangle so the "river-flow" texture's
  // ripple bands can scroll (see update()) to suggest current.
  readonly gfx: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.gfx = scene.add.tileSprite(x, y, width, height, "river-flow").setAlpha(GAME_CONFIG.riverAlpha);
  }

  // Called every frame while this river is active (GameScene.update).
  update(dt: number): void {
    this.gfx.tilePositionY += GAME_CONFIG.riverFlowSpeed * dt;
  }

  contains(px: number, py: number): boolean {
    return Math.abs(px - this.x) <= this.width / 2 && Math.abs(py - this.y) <= this.height / 2;
  }

  // Used by EncounterDirector once this river's chunk is behind the player.
  destroy(): void {
    this.gfx.destroy();
  }
}
