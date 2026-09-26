import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { Bison } from "./Bison";
import { Rock } from "../obstacles/Rock";
import { Fence } from "../obstacles/Fence";
import { River } from "../obstacles/River";

// Lightweight Boids-inspired herd: cohesion pulls bison toward the herd
// center, separation keeps them from overlapping, and alignment blends each
// bison's velocity toward the herd's shared forward heading (which is what
// the player actually steers). This gives a herd that visibly stretches and
// settles instead of snapping instantly onto a new heading.
export class Herd {
  bison: Bison[] = [];
  // Bison that left the active herd stay visible, motionless, where they
  // dropped out (spec: "may simply slow down, remain behind..."). They no
  // longer take part in any herd behavior or get moved.
  readonly strandedBison: Bison[] = [];
  heading = -Math.PI / 2; // start moving "up" the screen
  centerX: number;
  centerY: number;
  totalLost = 0;

  constructor(scene: Phaser.Scene, count: number, spawnX: number, spawnY: number) {
    this.centerX = spawnX;
    this.centerY = spawnY;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const radius = Phaser.Math.FloatBetween(0, GAME_CONFIG.spawnClusterRadius);
      const x = spawnX + Math.cos(angle) * radius;
      const y = spawnY + Math.sin(angle) * radius;
      const bison = new Bison(scene, x, y);
      // Start already moving with the herd so nobody has to "catch up" from
      // a standstill - that transient looked identical to a straggler.
      bison.vx = Math.cos(this.heading) * GAME_CONFIG.baseSpeed;
      bison.vy = Math.sin(this.heading) * GAME_CONFIG.baseSpeed;
      this.bison.push(bison);
    }

    this.updateCenter();
  }

  get size(): number {
    return this.bison.length;
  }

  // Larger herds turn slower (and therefore wider, at the same forward
  // speed) with no separate tiering: a continuous, easy-to-tune curve per
  // spec section 8.
  get turnRate(): number {
    return GAME_CONFIG.baseTurnRate / (1 + this.bison.length * GAME_CONFIG.herdTurnPenalty);
  }

  update(dt: number, steerDirection: number, rivers: River[] = []): void {
    this.heading += steerDirection * this.turnRate * dt;

    const headingDirX = Math.cos(this.heading);
    const headingDirY = Math.sin(this.heading);
    const baseAlignmentBlend = Math.min(1, GAME_CONFIG.alignmentForce * dt);
    const stragglers: Bison[] = [];

    for (const b of this.bison) {
      let ax = 0;
      let ay = 0;

      // A river doesn't block anyone - it just slows and loosens whoever is
      // currently standing in it, per-bison, for as long as they're in it.
      const inRiver = rivers.some((r) => r.contains(b.x, b.y));
      const cohesionMul = inRiver ? GAME_CONFIG.riverCohesionMultiplier : 1;
      const speedMul = inRiver ? GAME_CONFIG.riverSpeedMultiplier : 1;
      const targetVx = headingDirX * GAME_CONFIG.baseSpeed * speedMul;
      const targetVy = headingDirY * GAME_CONFIG.baseSpeed * speedMul;

      // Cohesion: spring pull toward the herd center.
      const toCenterX = this.centerX - b.x;
      const toCenterY = this.centerY - b.y;
      const distToCenter = Math.hypot(toCenterX, toCenterY);
      ax += toCenterX * GAME_CONFIG.cohesionForce * cohesionMul;
      ay += toCenterY * GAME_CONFIG.cohesionForce * cohesionMul;

      // Separation: push away from bison that are too close.
      for (const other of this.bison) {
        if (other === b) continue;
        const dx = b.x - other.x;
        const dy = b.y - other.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < GAME_CONFIG.separationRadius) {
          const strength = (GAME_CONFIG.separationRadius - dist) / GAME_CONFIG.separationRadius;
          ax += (dx / dist) * strength * GAME_CONFIG.separationForce;
          ay += (dy / dist) * strength * GAME_CONFIG.separationForce;
        }
      }

      b.vx += ax * dt;
      b.vy += ay * dt;

      // Alignment + forward influence, scaled by this bison's own agility.
      // Cruising straight needs no correction regardless of agility (the
      // target barely changes), so this only matters while actively
      // turning - which is exactly when a slow individual falls behind.
      const alignmentBlend = Math.min(1, baseAlignmentBlend * b.agility);
      b.vx += (targetVx - b.vx) * alignmentBlend;
      b.vy += (targetVy - b.vy) * alignmentBlend;

      const speed = Math.hypot(b.vx, b.vy);
      if (speed > GAME_CONFIG.maxIndividualSpeed) {
        const scale = GAME_CONFIG.maxIndividualSpeed / speed;
        b.vx *= scale;
        b.vy *= scale;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.syncGraphics();

      if (b.settleTimer > 0) {
        b.settleTimer = Math.max(0, b.settleTimer - dt);
      }

      if (distToCenter > GAME_CONFIG.lostRadius) {
        b.timeBeyondLostRadius += dt;
        if (b.timeBeyondLostRadius >= GAME_CONFIG.lostDelay) {
          stragglers.push(b);
        }
      } else {
        b.timeBeyondLostRadius = 0;
      }
    }

    if (stragglers.length > 0) {
      for (const lost of stragglers) {
        lost.vx = 0;
        lost.vy = 0;
        lost.gfx.setFillStyle(GAME_CONFIG.strandedBisonColor);
        this.strandedBison.push(lost);
      }
      const lostSet = new Set(stragglers);
      this.bison = this.bison.filter((b) => !lostSet.has(b));
      this.totalLost += stragglers.length;
    }

    this.updateCenter();
  }

  // Pulls any bison in `pool` within joinRadius of the herd center into the
  // active herd, mutating `pool` in place. The same operation serves wild
  // bison waiting to be recruited and previously-stranded bison the herd
  // has circled back around to - both are just "not currently in the herd".
  // Returns how many joined.
  recruit(pool: Bison[]): number {
    if (pool.length === 0) return 0;

    const joined: Bison[] = [];
    for (const candidate of pool) {
      const dist = Math.hypot(candidate.x - this.centerX, candidate.y - this.centerY);
      if (dist <= GAME_CONFIG.joinRadius) {
        joined.push(candidate);
      }
    }
    if (joined.length === 0) return 0;

    const joinedSet = new Set(joined);
    for (let i = pool.length - 1; i >= 0; i--) {
      if (joinedSet.has(pool[i])) pool.splice(i, 1);
    }

    for (const b of joined) {
      b.gfx.setFillStyle(GAME_CONFIG.bisonColor);
      b.timeBeyondLostRadius = 0;
      b.settleTimer = GAME_CONFIG.joinSettleTime;
      this.bison.push(b);
    }

    return joined.length;
  }

  // Rocks are solid and unbreakable (spec 12.1): a colliding bison is shoved
  // clear and knocked outward. That's generally a recoverable bump, but hard
  // enough - or already near the edge of the herd - it can push a bison past
  // lostRadius and into a real separation, same as an aggressive turn.
  handleRockCollisions(rocks: Rock[]): void {
    for (const b of this.bison) {
      for (const rock of rocks) {
        const dist = Math.hypot(b.x - rock.x, b.y - rock.y);
        const minDist = rock.radius + GAME_CONFIG.bisonRadius;
        if (dist > 0 && dist < minDist) {
          this.bounceOff(b, rock.x, rock.y, minDist);
        }
      }
    }
  }

  // Fences (spec 12.2): whether one breaks depends entirely on the herd's
  // size the moment anyone touches it. Large enough, it breaks and everyone
  // just keeps moving; too small, it's a solid wall - same bounce as a rock,
  // with the same chance of disrupting/separating whoever hit it. Returns
  // how many fences broke this call.
  handleFenceCollisions(fences: Fence[]): number {
    let brokenCount = 0;

    for (const fence of fences) {
      if (fence.broken) continue;

      const canBreakThrough = this.bison.length >= GAME_CONFIG.fenceBreakHerdSize;

      for (const b of this.bison) {
        const { x: cx, y: cy } = fence.closestPoint(b.x, b.y);
        const dist = Math.hypot(b.x - cx, b.y - cy);
        if (dist >= GAME_CONFIG.bisonRadius) continue;

        if (canBreakThrough) {
          fence.break();
          brokenCount++;
          break; // no point checking the rest against a now-broken fence
        }

        this.bounceOff(b, cx, cy, GAME_CONFIG.bisonRadius);
      }
    }

    return brokenCount;
  }

  // Shared bounce response for solid obstacles (rocks, unbroken fences):
  // shove the bison clear along the normal from `originX,originY`, cancel
  // the velocity that was carrying it inward, and add a modest outward bump
  // rather than stacking on top of its existing speed (which read as being
  // launched rather than bumped).
  private bounceOff(b: Bison, originX: number, originY: number, minDist: number): void {
    const dx = b.x - originX;
    const dy = b.y - originY;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;
    b.x += nx * (minDist - dist);
    b.y += ny * (minDist - dist);

    const inward = -(b.vx * nx + b.vy * ny);
    if (inward > 0) {
      b.vx += nx * inward;
      b.vy += ny * inward;
    }
    b.vx += nx * GAME_CONFIG.obstacleKnockback;
    b.vy += ny * GAME_CONFIG.obstacleKnockback;

    const speed = Math.hypot(b.vx, b.vy);
    if (speed > GAME_CONFIG.maxIndividualSpeed) {
      const scale = GAME_CONFIG.maxIndividualSpeed / speed;
      b.vx *= scale;
      b.vy *= scale;
    }

    b.syncGraphics();
  }

  private updateCenter(): void {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const b of this.bison) {
      if (b.settleTimer > 0) continue; // still settling in - don't let it skew the centroid yet
      sumX += b.x;
      sumY += b.y;
      count++;
    }

    if (count === 0) return; // keep last known center; nothing settled to average

    this.centerX = sumX / count;
    this.centerY = sumY / count;
  }
}
