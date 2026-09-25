import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { Bison } from "./Bison";

// Lightweight Boids-inspired herd: cohesion pulls bison toward the herd
// center, separation keeps them from overlapping, and alignment blends each
// bison's velocity toward the herd's shared forward heading (which is what
// the player actually steers). This gives a herd that visibly stretches and
// settles instead of snapping instantly onto a new heading.
export class Herd {
  readonly bison: Bison[] = [];
  heading = -Math.PI / 2; // start moving "up" the screen
  centerX: number;
  centerY: number;

  constructor(scene: Phaser.Scene, count: number, spawnX: number, spawnY: number) {
    this.centerX = spawnX;
    this.centerY = spawnY;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const radius = Phaser.Math.FloatBetween(0, GAME_CONFIG.spawnClusterRadius);
      const x = spawnX + Math.cos(angle) * radius;
      const y = spawnY + Math.sin(angle) * radius;
      this.bison.push(new Bison(scene, x, y));
    }

    this.updateCenter();
  }

  get size(): number {
    return this.bison.length;
  }

  update(dt: number, steerDirection: number): void {
    this.heading += steerDirection * GAME_CONFIG.baseTurnRate * dt;

    const headingDirX = Math.cos(this.heading);
    const headingDirY = Math.sin(this.heading);
    const targetVx = headingDirX * GAME_CONFIG.baseSpeed;
    const targetVy = headingDirY * GAME_CONFIG.baseSpeed;
    const alignmentBlend = Math.min(1, GAME_CONFIG.alignmentForce * dt);

    for (const b of this.bison) {
      let ax = 0;
      let ay = 0;

      // Cohesion: spring pull toward the herd center.
      const toCenterX = this.centerX - b.x;
      const toCenterY = this.centerY - b.y;
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

      // Alignment + forward influence: blend velocity toward the herd's
      // shared forward direction/speed.
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
    }

    this.updateCenter();
  }

  private updateCenter(): void {
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
