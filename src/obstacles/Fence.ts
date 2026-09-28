import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { darken } from "../utils/color";

// Three flavors of the same "linear barrier, breakable by herd size" shape
// (spec section 12.2 generalized) - a fence, a fallen log (forest, flimsier
// than a fence), and an ice wall (snowfield, tougher). Only the color and
// default break threshold differ; the geometry, collision, and break logic
// are all shared, so new "kinds" are a config entry, not a new class.
export type BarrierKind = "fence" | "log" | "ice";

interface BarrierVisual {
  color: number;
  postColor: number;
  defaultBreakThreshold: number;
}

const BARRIER_VISUALS: Record<BarrierKind, BarrierVisual> = {
  fence: {
    color: GAME_CONFIG.fenceColor,
    postColor: darken(GAME_CONFIG.fenceColor, 0.35),
    defaultBreakThreshold: GAME_CONFIG.fenceBreakHerdSize,
  },
  log: { color: 0x6b4423, postColor: 0x3f2712, defaultBreakThreshold: GAME_CONFIG.logBreakHerdSize },
  ice: { color: 0xbfe3f0, postColor: 0x8fc7dd, defaultBreakThreshold: GAME_CONFIG.iceBreakHerdSize },
};

// A barrier blocks the herd until it's broken. This class only holds its
// shape and visual/broken state - Herd decides whether a given collision
// breaks it, since that depends on the herd's size versus breakThreshold.
export class Fence {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly breakThreshold: number;
  broken = false;
  readonly gfx: Phaser.GameObjects.Rectangle;
  private readonly posts: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    kind: BarrierKind = "fence",
    breakThreshold?: number,
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = GAME_CONFIG.fenceThickness;
    const visual = BARRIER_VISUALS[kind];
    this.breakThreshold = breakThreshold ?? visual.defaultBreakThreshold;

    // Posts sit behind the rail so the rail reads as mounted on top of them.
    this.posts = scene.add.graphics();
    this.drawPosts(visual.postColor);

    this.gfx = scene.add
      .rectangle(x, y, width, this.height, visual.color)
      .setStrokeStyle(1.5, darken(visual.color, 0.3), 0.8);
  }

  private drawPosts(postColor: number): void {
    const postWidth = GAME_CONFIG.fencePostWidth;
    const postHeight = this.height * 2.4;
    const spacing = GAME_CONFIG.fencePostSpacing;
    const halfW = this.width / 2;

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
