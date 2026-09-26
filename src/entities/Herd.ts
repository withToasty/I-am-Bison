import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { Bison } from "./Bison";

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

  update(dt: number, steerDirection: number): void {
    this.heading += steerDirection * this.turnRate * dt;

    const headingDirX = Math.cos(this.heading);
    const headingDirY = Math.sin(this.heading);
    const targetVx = headingDirX * GAME_CONFIG.baseSpeed;
    const targetVy = headingDirY * GAME_CONFIG.baseSpeed;
    const baseAlignmentBlend = Math.min(1, GAME_CONFIG.alignmentForce * dt);
    const stragglers: Bison[] = [];

    for (const b of this.bison) {
      let ax = 0;
      let ay = 0;

      // Cohesion: spring pull toward the herd center.
      const toCenterX = this.centerX - b.x;
      const toCenterY = this.centerY - b.y;
      const distToCenter = Math.hypot(toCenterX, toCenterY);
      ax += toCenterX * GAME_CONFIG.cohesionForce;
      ay += toCenterY * GAME_CONFIG.cohesionForce;

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
      b.vx = Math.cos(this.heading) * GAME_CONFIG.baseSpeed;
      b.vy = Math.sin(this.heading) * GAME_CONFIG.baseSpeed;
      this.bison.push(b);
    }

    return joined.length;
  }

  private updateCenter(): void {
    if (this.bison.length === 0) return; // keep last known center; nothing left to average

    let sumX = 0;
    let sumY = 0;
    for (const b of this.bison) {
      sumX += b.x;
      sumY += b.y;
    }
    this.centerX = sumX / this.bison.length;
    this.centerY = sumY / this.bison.length;
  }
}
