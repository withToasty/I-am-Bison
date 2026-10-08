import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { Herd } from "../entities/Herd";
import { Bison } from "../entities/Bison";
import { BODY_TRIANGLES, HORN_TRIANGLES, HOOF_TRIANGLES, HORN_COLOR, SHAPE_SCALE, type ShapeTriangle } from "../entities/BisonShape";
import { WildBison } from "../entities/WildBison";
import { Rock } from "../obstacles/Rock";
import { Fence } from "../obstacles/Fence";
import { River } from "../obstacles/River";
import { SteeringInput } from "../input/SteeringInput";
import { WorldGrid } from "../systems/WorldGrid";
import { LandmarkDirector } from "../systems/LandmarkDirector";
import { BIOMES, biomeWeightsAt } from "../systems/Biomes";
import { isRiverZone } from "../systems/WorldNoise";
import { HUD } from "../ui/HUD";
import { lighten, darken } from "../utils/color";
import type { GameOverData } from "./GameOverScene";

// Herd sizes bound to the 1-5 keys so 10-vs-50 (and beyond) can be felt
// back-to-back without recruitment/loss systems, which arrive in later
// milestones.
const TEST_HERD_SIZES = [5, 10, 20, 50, 100];

interface GameSceneData {
  herdSize?: number;
}

export class GameScene extends Phaser.Scene {
  private herd!: Herd;
  private steering!: SteeringInput;
  private background!: Phaser.GameObjects.TileSprite;
  // Second ground layer, stacked on top of `background` and faded in/out
  // by biome blend weight (see updateGroundBlend) so a boundary crossfades
  // instead of snapping between two flat colors.
  private backgroundBlend!: Phaser.GameObjects.TileSprite;
  private groundBiomeId = "";
  private groundBlendBiomeId = "";
  private cameraTarget!: Phaser.GameObjects.Zone;
  private headingMarker!: Phaser.GameObjects.Graphics;
  private bisonGraphics!: Phaser.GameObjects.Graphics;
  private devText!: Phaser.GameObjects.Text;
  private herdSize = GAME_CONFIG.herdSize;
  private wildBison: WildBison[] = [];
  private rocks: Rock[] = [];
  private fences: Fence[] = [];
  private rivers: River[] = [];
  private totalRecruited = 0;
  private totalDestroyed = 0;
  private hud!: HUD;
  private maxDistanceFromSpawn = 0;
  private maxHerdSize = 0;
  private spawnX = 0;
  private spawnY = 0;
  private worldGrid!: WorldGrid;
  private landmarkDirector!: LandmarkDirector;

  // v0.2 M1 feel pass
  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustAccumulator = 0;
  private lookAheadX = 0;
  private lookAheadY = 0;
  private recruitFeedbackText?: Phaser.GameObjects.Text;
  private recruitFeedbackCount = 0;
  private recruitFeedbackTween?: Phaser.Tweens.Tween;

  constructor() {
    super("GameScene");
  }

  init(data: GameSceneData): void {
    this.herdSize = data.herdSize ?? GAME_CONFIG.herdSize;
  }

  create(): void {
    this.generateGroundTextures();
    this.generateDustTexture();
    this.generateDebrisTexture();
    this.generateRiverTexture();

    // Spawn is at the center of the grassland ring, so both layers start
    // on that texture; updateGroundBlend() takes over from the first frame.
    this.background = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, "ground-grassland")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-10);
    this.groundBiomeId = "grassland";

    this.backgroundBlend = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, "ground-grassland")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-9)
      .setAlpha(0);

    // Rivers, rocks, fences, and wild bison are no longer a one-time fixed
    // layout - WorldGrid below spawns them continuously by cell. Start
    // every array empty; rivers are still positioned early in the display
    // list (via an explicit depth in WorldGrid) so bison, rocks, and
    // fences render on top of them regardless of spawn order.
    this.rivers = [];
    this.rocks = [];
    this.fences = [];
    this.wildBison = [];

    // Every bison (leader, followers, wild, stranded) is drawn here as one
    // batched fill per color, not as individual Arc GameObjects - see
    // drawBison(). Created once, up front, so anything spawned later is
    // guaranteed to render on top of it (matching the old per-bison-object
    // layering, where rocks/fences render above bison).
    this.bisonGraphics = this.add.graphics();

    this.herd = new Herd(this.herdSize, 0, 0);
    this.worldGrid = new WorldGrid(this, this.rocks, this.fences, this.rivers, this.wildBison);
    this.landmarkDirector = new LandmarkDirector(this, this.rocks, this.fences, this.rivers, this.wildBison);
    this.worldGrid.update(this.herd.leader.x, this.herd.leader.y); // load the cells around spawn
    this.landmarkDirector.update(this.herd.leader.x, this.herd.leader.y);
    this.totalRecruited = 0;
    this.totalDestroyed = 0;
    this.maxDistanceFromSpawn = 0;
    this.maxHerdSize = this.herd.size;
    this.spawnX = this.herd.centerX;
    this.spawnY = this.herd.centerY;
    this.steering = new SteeringInput(this);

    this.headingMarker = this.add.graphics();

    // Dust sits above the ground but below every "real" object (bison,
    // rocks, fences), so it reads as ground feedback without ever covering
    // up something the player needs to see. Manual emission only
    // (frequency: -1) - updateDust() paces it to the active herd size.
    this.dustEmitter = this.add.particles(0, 0, "dust", {
      lifespan: GAME_CONFIG.dustLifetime,
      speed: { min: 4, max: 18 },
      scale: { start: 0.9, end: 0.2 },
      alpha: { start: 0.32, end: 0 },
      frequency: -1,
    });
    this.dustEmitter.setDepth(-5);
    this.dustAccumulator = 0;
    this.lookAheadX = 0;
    this.lookAheadY = 0;
    this.recruitFeedbackText = undefined;
    this.recruitFeedbackCount = 0;

    this.hud = new HUD(this);

    // Dev-only readout for testing systems that don't have a "real" HUD yet
    // (turn rate, recruitment, losses...). Anchored to the bottom so it
    // never competes with the actual HUD above.
    this.devText = this.add
      .text(12, this.scale.height - 12, "", { fontFamily: "monospace", fontSize: "14px", color: "#eaf3ea" })
      .setOrigin(0, 1)
      .setScrollFactor(0);

    this.cameraTarget = this.add.zone(this.herd.centerX, this.herd.centerY, 1, 1);
    // roundPixels must stay off: it snaps camera scroll to whole pixels every
    // frame, which visibly judders against the sub-pixel-precise background
    // tile scroll below, especially while the camera is panning along a curve.
    this.cameras.main.startFollow(this.cameraTarget, false, GAME_CONFIG.cameraLerp, GAME_CONFIG.cameraLerp);
    this.cameras.main.setZoom(GAME_CONFIG.cameraZoomSmall);

    this.scale.on("resize", this.handleResize, this);
    this.setupHerdSizeTestKeys();
  }

  update(_time: number, delta: number): void {
    // Clamp so a frame hitch (tab throttling, GC pause) can't turn into a
    // single oversized physics step that looks like a stutter/pop.
    const dt = Math.min(delta, GAME_CONFIG.maxDeltaMs) / 1000;

    const radius = Math.hypot(this.herd.leader.x, this.herd.leader.y);
    const speedMultiplier = Math.min(
      GAME_CONFIG.maxSpeedMultiplier,
      1 + radius * GAME_CONFIG.speedDistanceScale,
    );
    this.herd.update(dt, this.steering.direction, this.rivers, speedMultiplier);
    const rockResult = this.herd.handleRockCollisions(this.rocks);
    const fenceResult = this.herd.handleFenceCollisions(this.fences);
    this.totalDestroyed += fenceResult.brokenCount + rockResult.brokenCount;

    // Impact feedback (v0.2 M1 feel pass, spec section 8): a successful break
    // reads as a deliberate, powerful hit; anything that actually cost the
    // herd a bison (a small-herd instant loss, or the leader's own crash)
    // reads as a sharper mistake instead. Only one plays per frame - if both
    // somehow land the same frame, the positive one wins so it never gets
    // stepped on by a shake reset.
    if (fenceResult.breakPoints.length > 0) {
      this.triggerFenceBreakFeedback(fenceResult.breakPoints[0], GAME_CONFIG.fenceColor);
    } else if (rockResult.breakPoints.length > 0) {
      this.triggerFenceBreakFeedback(rockResult.breakPoints[0], GAME_CONFIG.rockColor);
    } else {
      const lossPoint = fenceResult.lossPoints[0] ?? rockResult.lossPoints[0];
      if (lossPoint) this.triggerCollisionFeedback(lossPoint);
    }

    // Score (spec sections 15-16): distance is straight-line displacement
    // from spawn, not total path length - looping in place to rack up an
    // odometer reading shouldn't count as "how far the run traveled". Track
    // the farthest point ever reached so backing up doesn't lower the score.
    const distanceFromSpawn = Math.hypot(this.herd.centerX - this.spawnX, this.herd.centerY - this.spawnY);
    this.maxDistanceFromSpawn = Math.max(this.maxDistanceFromSpawn, distanceFromSpawn);
    this.maxHerdSize = Math.max(this.maxHerdSize, this.herd.size);

    // Game over the instant the leader - the bison you actually control -
    // hits an obstacle it can't break through, or (as a fallback) the active
    // herd hits zero. Checked before recruitment so a wild/stranded bison
    // waiting nearby can't "revive" an already-ended run.
    if (rockResult.leaderCrashed || fenceResult.leaderCrashed || this.herd.size === 0) {
      this.scene.start("GameOverScene", {
        distanceMeters: this.maxDistanceFromSpawn / GAME_CONFIG.pixelsPerMeter,
        maxHerd: this.maxHerdSize,
        destroyed: this.totalDestroyed,
        discoveries: this.landmarkDirector.discoveryCount,
      } satisfies GameOverData);
      return;
    }

    const recruitedThisFrame = this.herd.recruit(this.wildBison) + this.herd.recruit(this.herd.strandedBison);
    this.totalRecruited += recruitedThisFrame;
    if (recruitedThisFrame > 0) this.showRecruitFeedback(recruitedThisFrame);

    this.worldGrid.update(this.herd.leader.x, this.herd.leader.y);
    this.landmarkDirector.update(this.herd.leader.x, this.herd.leader.y);

    this.updateCameraZoom();
    this.updateCameraTarget();
    this.updateGroundBlend();
    this.updateDust(dt);
    for (const river of this.rivers) river.update(dt);

    this.drawBison(delta);
    this.drawHeadingMarker();
    this.hud.update(this.herd.size, this.maxDistanceFromSpawn / GAME_CONFIG.pixelsPerMeter);
    this.updateDevText();
  }

  // Camera zoom (v0.2 M1, spec section 4.1): a continuous, bounded curve -
  // n / (n + reference) asymptotically approaches 1 as the herd grows, so
  // zoom eases toward cameraZoomLarge but can never overshoot past it no
  // matter how big the herd gets. Smoothed on its own lerp rather than
  // snapping so growth/loss never causes a visible zoom pop.
  private updateCameraZoom(): void {
    const t = this.herd.size / (this.herd.size + GAME_CONFIG.cameraZoomHerdReference);
    const targetZoom = Phaser.Math.Linear(GAME_CONFIG.cameraZoomSmall, GAME_CONFIG.cameraZoomLarge, t);
    const cam = this.cameras.main;
    cam.zoom = Phaser.Math.Linear(cam.zoom, targetZoom, GAME_CONFIG.cameraZoomLerp);
  }

  // Forward look-ahead (v0.2 M1, spec section 4.2): the camera leads the
  // leader along the current heading so the player sees more of what's
  // ahead than behind. The offset itself is smoothed independently of the
  // camera's own follow-lerp so a hard turn eases the look-ahead point
  // around rather than snapping it to the new heading instantly. The
  // background tile position is driven by this same focus point (not the
  // raw herd position) so the ground scroll stays in lockstep with what the
  // camera is actually centered on.
  private updateCameraTarget(): void {
    const targetLookAheadX = Math.cos(this.herd.heading) * GAME_CONFIG.cameraLookAhead;
    const targetLookAheadY = Math.sin(this.herd.heading) * GAME_CONFIG.cameraLookAhead;
    this.lookAheadX = Phaser.Math.Linear(this.lookAheadX, targetLookAheadX, GAME_CONFIG.cameraLookAheadLerp);
    this.lookAheadY = Phaser.Math.Linear(this.lookAheadY, targetLookAheadY, GAME_CONFIG.cameraLookAheadLerp);

    const focusX = this.herd.centerX + this.lookAheadX;
    const focusY = this.herd.centerY + this.lookAheadY;
    this.cameraTarget.setPosition(focusX, focusY);
    this.background.tilePositionX = focusX;
    this.background.tilePositionY = focusY;
    this.backgroundBlend.tilePositionX = focusX;
    this.backgroundBlend.tilePositionY = focusY;
  }

  // Biome ground crossfade (v0.3 M-G2, spec section 3.1/9): bands are tuned
  // so at most two biomes ever have nonzero weight at once (see Biomes.ts),
  // so a simple two-layer composite is the exact right blend - draw the
  // dominant biome's texture fully opaque as the base, then the secondary
  // biome's texture on top at alpha = its own blend weight. Since the two
  // weights sum to 1, that Porter-Duff "over" composite produces exactly
  // dominant*(1-wSecondary) + secondary*wSecondary, i.e. a true linear
  // blend - not an approximation.
  private updateGroundBlend(): void {
    const sorted = [...biomeWeightsAt(this.herd.leader.x, this.herd.leader.y, this.worldGrid.seed).entries()].sort(
      (a, b) => b[1] - a[1],
    );
    const [primaryId] = sorted[0];
    const secondary = sorted[1];

    if (primaryId !== this.groundBiomeId) {
      this.background.setTexture(`ground-${primaryId}`);
      this.groundBiomeId = primaryId;
    }

    if (secondary && secondary[1] > 0.001) {
      if (secondary[0] !== this.groundBlendBiomeId) {
        this.backgroundBlend.setTexture(`ground-${secondary[0]}`);
        this.groundBlendBiomeId = secondary[0];
      }
      this.backgroundBlend.setAlpha(secondary[1]);
    } else {
      this.backgroundBlend.setAlpha(0);
    }
  }

  // Ground/dust feedback (v0.2 M1, spec section 6): rate scales smoothly
  // with active herd size (same bounded n/(n+reference) shape as camera
  // zoom) and is paced with a fractional accumulator so it stays correct
  // regardless of frame rate, rather than emitting a fixed count per frame.
  private updateDust(dt: number): void {
    const t = this.herd.size / (this.herd.size + GAME_CONFIG.dustHerdReference);
    const rate = Phaser.Math.Linear(GAME_CONFIG.dustMinRate, GAME_CONFIG.dustMaxRate, t);
    this.dustAccumulator += rate * dt;

    while (this.dustAccumulator >= 1) {
      this.dustAccumulator -= 1;
      const source = this.herd.bison[Phaser.Math.Between(0, this.herd.bison.length - 1)];
      const ox = Phaser.Math.FloatBetween(-GAME_CONFIG.dustSpread, GAME_CONFIG.dustSpread);
      const oy = Phaser.Math.FloatBetween(-GAME_CONFIG.dustSpread, GAME_CONFIG.dustSpread);
      this.dustEmitter.emitParticleAt(source.x + ox, source.y + oy, 1);
    }
  }

  // Recruitment feedback (v0.2 M1, spec section 7): joins within
  // recruitFeedbackDuration of each other accumulate into the same "+N"
  // popup (restarting its timer) instead of stacking overlapping messages -
  // only the first join in a burst spawns a new text/ring.
  private showRecruitFeedback(count: number): void {
    this.recruitFeedbackCount += count;
    const x = this.herd.leader.x;
    const y = this.herd.leader.y - 36;

    if (this.recruitFeedbackText?.active) {
      this.recruitFeedbackText.setText(`+${this.recruitFeedbackCount}`);
      this.recruitFeedbackText.setPosition(x, y);
      this.recruitFeedbackTween?.restart();
      return;
    }

    this.recruitFeedbackText = this.add
      .text(x, y, `+${this.recruitFeedbackCount}`, {
        fontFamily: "monospace",
        fontSize: "26px",
        fontStyle: "bold",
        color: "#ffee58",
        stroke: "#1a1a1a",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const ring = this.add.circle(x, y + 36, GAME_CONFIG.bisonRadius, 0xffee58, 0).setStrokeStyle(3, 0xffee58, 0.9);
    this.tweens.add({
      targets: ring,
      radius: GAME_CONFIG.bisonRadius * GAME_CONFIG.recruitPulseScale,
      alpha: 0,
      duration: GAME_CONFIG.recruitFeedbackDuration,
      ease: "Cubic.Out",
      onComplete: () => ring.destroy(),
    });

    this.recruitFeedbackTween = this.tweens.add({
      targets: this.recruitFeedbackText,
      y: y - 26,
      alpha: 0,
      duration: GAME_CONFIG.recruitFeedbackDuration,
      ease: "Cubic.Out",
      onComplete: () => {
        this.recruitFeedbackText?.destroy();
        this.recruitFeedbackText = undefined;
        this.recruitFeedbackCount = 0;
      },
    });
  }

  // Break impact (v0.2 M1, spec section 8.1; generalized to rocks in the
  // difficulty pass): a longer, softer shake plus a warm debris burst
  // tinted in whichever obstacle just broke's own color - reads as
  // triumphant, not punishing.
  private triggerFenceBreakFeedback(point: { x: number; y: number }, tint: number): void {
    this.cameras.main.shake(GAME_CONFIG.fenceBreakShakeDuration, GAME_CONFIG.fenceBreakShakeIntensity);
    this.burstDebris(point.x, point.y, tint, 14, 90, 220);
  }

  // Non-breakable / loss impact (v0.2 M1, spec section 8.2): shorter and
  // sharper than a fence break, with a cooler-toned burst, so a mistake
  // never reads as a win. Kept brief enough that it doesn't mask why the
  // collision happened.
  private triggerCollisionFeedback(point: { x: number; y: number }): void {
    this.cameras.main.shake(GAME_CONFIG.collisionShakeDuration, GAME_CONFIG.collisionShakeIntensity);
    this.burstDebris(point.x, point.y, GAME_CONFIG.strandedBisonColor, 8, 140, 160);
  }

  // One-shot particle burst. Each call gets its own emitter (these events
  // are rare - fence breaks and losses, not every-frame) and is torn down
  // shortly after its particles finish, rather than kept as a persistent
  // system that would sit idle the rest of the run.
  private burstDebris(x: number, y: number, tint: number, count: number, maxSpeed: number, lifespan: number): void {
    const emitter = this.add.particles(x, y, "debris", {
      lifespan,
      speed: { min: maxSpeed * 0.3, max: maxSpeed },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { start: 0, end: 360 },
      tint,
    });
    emitter.explode(count);
    this.time.delayedCall(lifespan + 50, () => emitter.destroy());
  }

  private updateDevText(): void {
    const turnPercent = Math.round((this.herd.turnRate / GAME_CONFIG.baseTurnRate) * 100);
    const cell = this.worldGrid.lastCell;
    const leader = this.herd.leader;
    const radius = Math.round(Math.hypot(leader.x, leader.y));
    const biomeMix = [...biomeWeightsAt(leader.x, leader.y, this.worldGrid.seed).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, w]) => `${id} ${Math.round(w * 100)}%`)
      .join(" / ");
    const river = isRiverZone(leader.x, leader.y, this.worldGrid.seed) ? " RIVER-ZONE" : "";
    const speedPercent = Math.round(
      Math.min(GAME_CONFIG.maxSpeedMultiplier, 1 + radius * GAME_CONFIG.speedDistanceScale) * 100,
    );
    this.devText.setText(
      `HERD ${this.herd.size}  MAX HERD ${this.maxHerdSize}  TURN RATE ${turnPercent}%  SPEED ${speedPercent}%  LOST ${this.herd.totalLost}  RECRUITED ${this.totalRecruited}  WILD LEFT ${this.wildBison.length}  DESTROYED ${this.totalDestroyed}  DISCOVERIES ${this.landmarkDirector.discoveryCount}\n` +
        `CELLS LOADED ${this.worldGrid.loadedCount}  LAST CELL (${cell.x},${cell.y})  LAST TEMPLATE ${this.worldGrid.lastTemplate}\n` +
        `RADIUS ${radius}  BIOME ${biomeMix}${river}\n` +
        `1-5: test herd sizes (${TEST_HERD_SIZES.join("/")})`,
    );
  }

  private setupHerdSizeTestKeys(): void {
    const keyCodes = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
    ];

    keyCodes.forEach((code, i) => {
      this.input.keyboard?.addKey(code).on("down", () => {
        this.scene.restart({ herdSize: TEST_HERD_SIZES[i] } satisfies GameSceneData);
      });
    });
  }

  // Every bison (leader, followers, wild, stranded) is drawn here instead of
  // each owning its own Arc GameObject. Batching same-colored circles into
  // one filled path per group means overlapping bison are rasterized as a
  // single shape - drawing them as separate objects left a faint seam at
  // every shared edge (each circle's anti-aliased boundary compositing
  // against the one drawn before it) that became a visible dark ring once
  // enough bison packed together.
  private drawBison(delta: number): void {
    const g = this.bisonGraphics;
    g.clear();
    this.drawBisonShadows(g, [this.wildBison, this.herd.strandedBison, this.herd.bison]);
    this.fillBisonBatch(g, this.wildBison, delta);
    this.fillBisonBatch(g, this.herd.strandedBison, delta);
    this.fillBisonBatch(g, this.herd.bison, delta);
  }

  // Facet colors per base bison color, computed once and reused every
  // frame - there are only ever 4 base colors (leader/herd/wild/stranded),
  // never one per bison, so this never grows unbounded.
  private facetPaletteCache = new Map<number, number[]>();

  private getFacetPalette(color: number): number[] {
    let palette = this.facetPaletteCache.get(color);
    if (!palette) {
      palette = GAME_CONFIG.lowPolyShadeLevels.map((level) =>
        level < 0 ? darken(color, -level) : level > 0 ? lighten(color, level) : color,
      );
      this.facetPaletteCache.set(color, palette);
    }
    return palette;
  }

  // Soft ground shadows, one path for every bison so overlapping shadows
  // don't darken each other. Drawn under all bodies and offset away from the
  // light, which grounds the model and makes it read bigger.
  private drawBisonShadows(g: Phaser.GameObjects.Graphics, lists: Bison[][]): void {
    const away = GAME_CONFIG.lowPolyLightAngle + Math.PI;
    const ox = Math.cos(away) * GAME_CONFIG.bisonShadowOffset * GAME_CONFIG.bisonRadius;
    const oy = Math.sin(away) * GAME_CONFIG.bisonShadowOffset * GAME_CONFIG.bisonRadius;
    const rx = GAME_CONFIG.bisonRadius * SHAPE_SCALE * 1.7;
    const ry = GAME_CONFIG.bisonRadius * SHAPE_SCALE * 1.05;
    const steps = 10;
    g.beginPath();
    for (const list of lists) {
      for (const b of list) {
        const cos = Math.cos(b.heading);
        const sin = Math.sin(b.heading);
        for (let i = 0; i < steps; i++) {
          const t = (i / steps) * Math.PI * 2;
          const lx = Math.cos(t) * rx - rx * 0.12;
          const ly = Math.sin(t) * ry;
          const x = b.x + ox + lx * cos - ly * sin;
          const y = b.y + oy + lx * sin + ly * cos;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.closePath();
      }
    }
    g.fillStyle(0x000000, GAME_CONFIG.bisonShadowAlpha);
    g.fillPath();
  }

  // Low-poly bison model (entities/BisonShape.ts), rotated to each bison's
  // heading. Batched by (color, shade level) rather than by bison, so the
  // number of fill passes depends on colors x shade levels, not herd size.
  private fillBisonBatch(g: Phaser.GameObjects.Graphics, list: Bison[], delta: number): void {
    if (list.length === 0) return;

    const byColor = new Map<number, Bison[]>();
    for (const b of list) {
      const group = byColor.get(b.color);
      if (group) group.push(b);
      else byColor.set(b.color, [b]);
    }

    const scale = GAME_CONFIG.bisonRadius * SHAPE_SCALE;
    const levels = GAME_CONFIG.lowPolyShadeLevels;
    const maxLevel = levels.length - 1;
    const minSpeed2 = GAME_CONFIG.bisonFacingMinSpeed * GAME_CONFIG.bisonFacingMinSpeed;

    for (const [color, group] of byColor) {
      const palette = this.getFacetPalette(color);
      const buckets: number[][] = palette.map(() => []);
      const horns: number[] = [];
      const hooves: number[] = [];

      for (const b of group) {
        // Ease the facing toward the velocity direction (drawing-only state).
        if (b.vx * b.vx + b.vy * b.vy > minSpeed2) {
          const diff = Phaser.Math.Angle.Wrap(Math.atan2(b.vy, b.vx) - b.heading);
          b.heading += diff * GAME_CONFIG.bisonTurnEase;
        }
        // Run cycle: phase advances with distance covered, so a faster
        // bison strides faster and a stopped one stands still.
        const speed = Math.hypot(b.vx, b.vy);
        b.gaitPhase += speed * (delta / 1000) * GAME_CONFIG.gaitStridesPerPx * Math.PI * 2;
        const moving = Math.min(1, speed / GAME_CONFIG.bisonFacingMinSpeed);
        const bob = 1 + Math.sin(b.gaitPhase * 2) * GAME_CONFIG.gaitBodyBob * moving;
        const sway = Math.sin(b.gaitPhase) * GAME_CONFIG.gaitSway * moving;
        const cos = Math.cos(b.heading);
        const sin = Math.sin(b.heading);
        // dx/dy: local-frame offset (bisonRadius units); k: local scale.
        const push = (out: number[], t: ShapeTriangle, k: number, dx: number, dy: number) => {
          const px = (x: number) => (x * k + dx) * scale;
          const py = (y: number) => (y * k + dy) * scale;
          out.push(
            b.x + px(t.ax) * cos - py(t.ay) * sin,
            b.y + px(t.ax) * sin + py(t.ay) * cos,
            b.x + px(t.bx) * cos - py(t.by) * sin,
            b.y + px(t.bx) * sin + py(t.by) * cos,
            b.x + px(t.cx) * cos - py(t.cy) * sin,
            b.y + px(t.cx) * sin + py(t.cy) * cos,
          );
        };
        for (const t of BODY_TRIANGLES) {
          const lit = Math.cos(t.normalAngle + b.heading - GAME_CONFIG.lowPolyLightAngle);
          const base = Math.floor(((lit + 1) / 2) * levels.length);
          push(buckets[Phaser.Math.Clamp(base + t.trim, 0, maxLevel)], t, bob, 0, sway);
        }
        for (const t of HOOF_TRIANGLES) {
          const swing = Math.sin(b.gaitPhase + (t.gait ? Math.PI : 0)) * GAME_CONFIG.gaitHoofSwing * moving;
          push(hooves, t, 1, swing, sway);
        }
        for (const t of HORN_TRIANGLES) push(horns, t, bob, 0, sway);
      }

      const fill = (verts: number[], fillColor: number) => {
        if (verts.length === 0) return;
        g.beginPath();
        for (let i = 0; i < verts.length; i += 6) {
          g.moveTo(verts[i], verts[i + 1]);
          g.lineTo(verts[i + 2], verts[i + 3]);
          g.lineTo(verts[i + 4], verts[i + 5]);
          g.closePath();
        }
        g.fillStyle(fillColor, 1);
        g.fillPath();
      };

      // Hooves go under the body so only the tips show.
      fill(hooves, darken(color, 0.26));
      for (let level = 0; level < palette.length; level++) fill(buckets[level], palette[level]);
      fill(horns, HORN_COLOR);
    }
  }

  private drawHeadingMarker(): void {
    const marker = this.headingMarker;
    marker.clear();
    marker.lineStyle(3, GAME_CONFIG.headingMarkerColor, 0.8);

    const endX = this.herd.centerX + Math.cos(this.herd.heading) * GAME_CONFIG.headingMarkerLength;
    const endY = this.herd.centerY + Math.sin(this.herd.heading) * GAME_CONFIG.headingMarkerLength;
    marker.lineBetween(this.herd.centerX, this.herd.centerY, endX, endY);
  }

  // One "ground-<biomeId>" texture per biome (v0.3 M-G2), so the two
  // ground layers can crossfade between them - see updateGroundBlend().
  private generateGroundTextures(): void {
    for (const biome of BIOMES) {
      const key = `ground-${biome.id}`;
      if (this.textures.exists(key)) continue;

      const { backgroundColor, backgroundLineColor } = biome.groundTheme;
      const size = GAME_CONFIG.backgroundTileSize;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(backgroundColor);
      g.fillRect(0, 0, size, size);

      // A couple of soft, randomly placed patches per tile break up the
      // flat fill so the ground reads as textured rather than a solid
      // color. Kept subtle (low alpha, no hard edges beyond the blob
      // itself) since the tile repeats and an obvious motif would read as
      // an artifact.
      const patchColors = [lighten(backgroundColor, 0.05), darken(backgroundColor, 0.05)];
      for (let i = 0; i < 3; i++) {
        const color = patchColors[i % patchColors.length];
        g.fillStyle(color, 0.35);
        g.fillEllipse(
          Phaser.Math.Between(0, size),
          Phaser.Math.Between(0, size),
          Phaser.Math.Between(size * 0.3, size * 0.55),
          Phaser.Math.Between(size * 0.2, size * 0.4),
        );
      }

      // The grid line is kept mainly for scale/motion cues while moving,
      // so it stays thin and low-contrast rather than reading as literal
      // terrain.
      g.lineStyle(1, backgroundLineColor, 0.35);
      g.strokeRect(0, 0, size, size);
      g.generateTexture(key, size, size);
      g.destroy();
    }
  }

  // Ripple bands baked into a small tile; River scrolls its tilePosition to
  // suggest current without any per-frame redraw.
  private generateRiverTexture(): void {
    if (this.textures.exists("river-flow")) return;

    const size = 48;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(GAME_CONFIG.riverColor, 1);
    g.fillRect(0, 0, size, size);

    g.fillStyle(lighten(GAME_CONFIG.riverColor, 0.12), 0.5);
    g.fillRect(0, 6, size, 5);
    g.fillRect(0, 27, size, 4);

    g.fillStyle(darken(GAME_CONFIG.riverColor, 0.12), 0.4);
    g.fillRect(0, 16, size, 4);
    g.fillRect(0, 38, size, 5);

    g.generateTexture("river-flow", size, size);
    g.destroy();
  }

  private generateDustTexture(): void {
    if (this.textures.exists("dust")) return;

    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xd8cba0, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture("dust", 12, 12);
    g.destroy();
  }

  // A plain square; particle tint/color is set per-burst so the same
  // texture serves both fence-break debris and collision-impact debris.
  private generateDebrisTexture(): void {
    if (this.textures.exists("debris")) return;

    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 6, 6);
    g.generateTexture("debris", 6, 6);
    g.destroy();
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.background.setSize(gameSize.width, gameSize.height);
    this.backgroundBlend.setSize(gameSize.width, gameSize.height);
    this.devText.setY(gameSize.height - 12);
  }
}
