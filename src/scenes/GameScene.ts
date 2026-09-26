import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { Herd } from "../entities/Herd";
import { Bison } from "../entities/Bison";
import { WildBison } from "../entities/WildBison";
import { Rock } from "../obstacles/Rock";
import { Fence } from "../obstacles/Fence";
import { River } from "../obstacles/River";
import { SteeringInput } from "../input/SteeringInput";
import { spawnFences, spawnRivers, spawnRocks, spawnWildBison } from "../systems/SpawnSystem";
import { HUD } from "../ui/HUD";
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
    this.generateGroundTexture();
    this.generateDustTexture();
    this.generateDebrisTexture();

    this.background = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, "ground")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-10);

    // Rivers are drawn on the ground first so bison, rocks, and fences
    // render on top of them.
    this.rivers = spawnRivers(this);

    // Every bison (leader, followers, wild, stranded) is drawn here as one
    // batched fill per color, not as individual Arc GameObjects - see
    // drawBison(). Positioned between rivers and rocks in the display list
    // so the layering matches the old per-bison-object order (rocks/fences
    // still render on top).
    this.bisonGraphics = this.add.graphics();

    this.herd = new Herd(this.herdSize, 0, 0);
    this.wildBison = spawnWildBison();
    this.rocks = spawnRocks(this);
    this.fences = spawnFences(this);
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

    this.herd.update(dt, this.steering.direction, this.rivers);
    const rockResult = this.herd.handleRockCollisions(this.rocks);
    const fenceResult = this.herd.handleFenceCollisions(this.fences);
    this.totalDestroyed += fenceResult.brokenCount;

    // Impact feedback (v0.2 M1 feel pass, spec section 8): a successful break
    // reads as a deliberate, powerful hit; anything that actually cost the
    // herd a bison (a small-herd instant loss, or the leader's own crash)
    // reads as a sharper mistake instead. Only one plays per frame - if both
    // somehow land the same frame, the positive one wins so it never gets
    // stepped on by a shake reset.
    if (fenceResult.breakPoints.length > 0) {
      this.triggerFenceBreakFeedback(fenceResult.breakPoints[0]);
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
      } satisfies GameOverData);
      return;
    }

    const recruitedThisFrame = this.herd.recruit(this.wildBison) + this.herd.recruit(this.herd.strandedBison);
    this.totalRecruited += recruitedThisFrame;
    if (recruitedThisFrame > 0) this.showRecruitFeedback(recruitedThisFrame);

    this.updateCameraZoom();
    this.updateCameraTarget();
    this.updateDust(dt);

    this.drawBison();
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

  // Fence-break impact (v0.2 M1, spec section 8.1): a longer, softer shake
  // plus a warm debris burst tinted in the fence's own color - reads as
  // triumphant, not punishing.
  private triggerFenceBreakFeedback(point: { x: number; y: number }): void {
    this.cameras.main.shake(GAME_CONFIG.fenceBreakShakeDuration, GAME_CONFIG.fenceBreakShakeIntensity);
    this.burstDebris(point.x, point.y, GAME_CONFIG.fenceColor, 14, 90, 220);
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
    this.devText.setText(
      `HERD ${this.herd.size}  MAX HERD ${this.maxHerdSize}  TURN RATE ${turnPercent}%  LOST ${this.herd.totalLost}  RECRUITED ${this.totalRecruited}  WILD LEFT ${this.wildBison.length}  DESTROYED ${this.totalDestroyed}\n1-5: test herd sizes (${TEST_HERD_SIZES.join("/")})`,
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
  private drawBison(): void {
    const g = this.bisonGraphics;
    g.clear();
    this.fillBisonBatch(g, this.wildBison);
    this.fillBisonBatch(g, this.herd.strandedBison);
    this.fillBisonBatch(g, this.herd.bison);
  }

  private fillBisonBatch(g: Phaser.GameObjects.Graphics, list: Bison[]): void {
    if (list.length === 0) return;

    const byColor = new Map<number, Bison[]>();
    for (const b of list) {
      const group = byColor.get(b.color);
      if (group) group.push(b);
      else byColor.set(b.color, [b]);
    }

    for (const [color, group] of byColor) {
      g.fillStyle(color, 1);
      g.beginPath();
      for (const b of group) {
        // moveTo repositions the path's current point without drawing a
        // line, so each arc() below starts its own independent subpath
        // instead of being connected to the previous circle.
        g.moveTo(b.x + GAME_CONFIG.bisonRadius, b.y);
        g.arc(b.x, b.y, GAME_CONFIG.bisonRadius, 0, Math.PI * 2);
      }
      g.fillPath();
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

  private generateGroundTexture(): void {
    if (this.textures.exists("ground")) return;

    const size = GAME_CONFIG.backgroundTileSize;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(GAME_CONFIG.backgroundColor);
    g.fillRect(0, 0, size, size);
    g.lineStyle(1, GAME_CONFIG.backgroundLineColor, 1);
    g.strokeRect(0, 0, size, size);
    g.generateTexture("ground", size, size);
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
    this.devText.setY(gameSize.height - 12);
  }
}
