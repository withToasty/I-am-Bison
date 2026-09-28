import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";

// One triangular facet of a bison's low-poly silhouette (visual only - see
// GameScene.fillBisonBatch): `angle`/`radius` place this facet's outer
// vertex relative to the bison's own x/y, and `shadeLevel` is a fixed index
// into the per-color palette GameScene derives at draw time. Precomputed
// once per bison (not per frame) so the faceted shape doesn't jitter, and
// not tied to any seeded RNG - it's cosmetic identity, not gameplay state,
// so it never needs to reproduce identically across a reload.
export interface BisonFacet {
  angle: number;
  radius: number;
  shadeLevel: number;
}

function buildFacets(): BisonFacet[] {
  const count = GAME_CONFIG.lowPolyFacetCount;
  const facets: BisonFacet[] = [];
  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * Math.PI * 2;
    const angle = baseAngle + Phaser.Math.FloatBetween(-GAME_CONFIG.lowPolyAngleJitter, GAME_CONFIG.lowPolyAngleJitter);
    const radius =
      GAME_CONFIG.bisonRadius *
      (1 + Phaser.Math.FloatBetween(-GAME_CONFIG.lowPolyRadiusJitter, GAME_CONFIG.lowPolyRadiusJitter));
    // Flat-shaded like a low-poly model: how much this facet faces the
    // fixed "light" direction decides which discrete shade it gets, not a
    // smooth gradient.
    const lit = Math.cos(angle - GAME_CONFIG.lowPolyLightAngle);
    const levels = GAME_CONFIG.lowPolyShadeLevels;
    const shadeLevel = Phaser.Math.Clamp(Math.floor(((lit + 1) / 2) * levels.length), 0, levels.length - 1);
    facets.push({ angle, radius, shadeLevel });
  }
  return facets;
}

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
  // This bison's own low-poly silhouette, fixed for its whole lifetime.
  readonly facets: BisonFacet[];

  constructor(x: number, y: number, color: number = GAME_CONFIG.bisonColor) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.agility = Phaser.Math.FloatBetween(GAME_CONFIG.minAgility, GAME_CONFIG.maxAgility);
    this.facets = buildFacets();
  }
}
