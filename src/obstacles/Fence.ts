import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { darken } from "../utils/color";

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
  private readonly posts: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = GAME_CONFIG.fenceThickness;

    // Posts sit behind the rail so the rail reads as mounted on top of them.
    this.posts = scene.add.graphics();
    this.drawPosts();

    this.gfx = scene.add
      .rectangle(x, y, width, this.height, GAME_CONFIG.fenceColor)
      .setStrokeStyle(1.5, darken(GAME_CONFIG.fenceColor, 0.3), 0.8);
  }

  private drawPosts(): void {
    const postWidth = GAME_CONFIG.fencePostWidth;
    const postHeight = this.height * 2.4;
    const spacing = GAME_CONFIG.fencePostSpacing;
    const halfW = this.width / 2;
    const postColor = darken(GAME_CONFIG.fenceColor, 0.35);

    this.posts.fillStyle(postColor, 1);
    for (let px = -halfW; px <= halfW; px += spacing) {
      this.posts.fillRect(this.x + px - postWidth / 2, this.y - postHeight / 2, postWidth, postHeight);
    }
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
    this.posts.destroy();
  }

  // Used by EncounterDirector once this fence's chunk is behind the player.
  // A broken fence has already destroyed its own gfx/posts via break() above,
  // so this must not try to destroy them again.
  destroy(): void {
    if (!this.broken) {
      this.gfx.destroy();
      this.posts.destroy();
    }
  }
}
