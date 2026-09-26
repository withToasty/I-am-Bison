import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { Bison } from "./Bison";
import { Rock } from "../obstacles/Rock";
import { Fence } from "../obstacles/Fence";
import { River } from "../obstacles/River";

// The player directly controls one bison - the leader, drawn in a distinct
// color - and the rest of the herd is a lightweight Boids-inspired flock
// that clusters around it: cohesion pulls followers toward the leader's
// actual position, separation keeps everyone (including the leader) from
// overlapping, and alignment blends each follower's velocity toward the
// leader's current heading. The leader itself is fully deterministic - no
// boids blending, no agility - so steering input always feels direct.
export class Herd {
  bison: Bison[] = [];
  readonly leader: Bison;
  // Bison that left the active herd stay visible, motionless, where they
  // dropped out (spec: "may simply slow down, remain behind..."). They no
  // longer take part in any herd behavior or get moved.
  readonly strandedBison: Bison[] = [];
  heading = -Math.PI / 2; // the leader's (and so the herd's) forward direction
  centerX: number;
  centerY: number;
  totalLost = 0;

  constructor(scene: Phaser.Scene, count: number, spawnX: number, spawnY: number) {
    this.centerX = spawnX;
    this.centerY = spawnY;

    for (let i = 0; i < count; i++) {
      // The leader moves in a fully deterministic straight line with no
      // cohesion/separation drift of its own, so any random spawn offset it
      // got would stick for the rest of the run - including, by pure luck,
      // lining up with a fixed obstacle's position. Only followers scatter.
      const isLeader = i === 0;
      const angle = isLeader ? 0 : (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const radius = isLeader ? 0 : Phaser.Math.FloatBetween(0, GAME_CONFIG.spawnClusterRadius);
      const x = spawnX + Math.cos(angle) * radius;
      const y = spawnY + Math.sin(angle) * radius;
      const color = i === 0 ? GAME_CONFIG.leaderColor : GAME_CONFIG.bisonColor;
      const bison = new Bison(scene, x, y, color);
      // Start already moving with the herd so nobody has to "catch up" from
      // a standstill - that transient looked identical to a straggler.
      bison.vx = Math.cos(this.heading) * GAME_CONFIG.baseSpeed;
      bison.vy = Math.sin(this.heading) * GAME_CONFIG.baseSpeed;
      this.bison.push(bison);
    }

    this.leader = this.bison[0];
    this.centerX = this.leader.x;
    this.centerY = this.leader.y;
  }

  get size(): number {
    return this.bison.length;
  }

  // Larger herds turn slower (and therefore wider, at the same forward
  // speed) with no separate tiering: a continuous, easy-to-tune curve per
  // spec section 8. This still applies to the leader's own turning - the
  // more of a herd gathered around you, the harder you are to steer.
  get turnRate(): number {
    return GAME_CONFIG.baseTurnRate / (1 + this.bison.length * GAME_CONFIG.herdTurnPenalty);
  }

  update(dt: number, steerDirection: number, rivers: River[] = []): void {
    this.heading += steerDirection * this.turnRate * dt;

    // The leader moves directly off player input - no boids blending, no
    // agility - so control always feels precise and immediate.
    const leader = this.leader;
    const leaderInRiver = rivers.some((r) => r.contains(leader.x, leader.y));
    const leaderSpeedMul = leaderInRiver ? GAME_CONFIG.riverSpeedMultiplier : 1;
    leader.vx = Math.cos(this.heading) * GAME_CONFIG.baseSpeed * leaderSpeedMul;
    leader.vy = Math.sin(this.heading) * GAME_CONFIG.baseSpeed * leaderSpeedMul;
    leader.x += leader.vx * dt;
    leader.y += leader.vy * dt;
    leader.syncGraphics();

    // The herd's "center" is simply the leader's own position now - everyone
    // else clusters around wherever the player actually is, rather than an
    // averaged centroid that could lag or jump as members joined/left.
    this.centerX = leader.x;
    this.centerY = leader.y;

    const headingDirX = Math.cos(this.heading);
    const headingDirY = Math.sin(this.heading);
    const baseAlignmentBlend = Math.min(1, GAME_CONFIG.alignmentForce * dt);
    const stragglers: Bison[] = [];

    for (const b of this.bison) {
      if (b === leader) continue;

      let ax = 0;
      let ay = 0;

      // A river doesn't block anyone - it just slows and loosens whoever is
      // currently standing in it, per-bison, for as long as they're in it.
      const inRiver = rivers.some((r) => r.contains(b.x, b.y));
      const cohesionMul = inRiver ? GAME_CONFIG.riverCohesionMultiplier : 1;
      const speedMul = inRiver ? GAME_CONFIG.riverSpeedMultiplier : 1;
      const targetVx = headingDirX * GAME_CONFIG.baseSpeed * speedMul;
      const targetVy = headingDirY * GAME_CONFIG.baseSpeed * speedMul;

      // Cohesion: spring pull toward the leader.
      const toCenterX = this.centerX - b.x;
      const toCenterY = this.centerY - b.y;
      const distToLeader = Math.hypot(toCenterX, toCenterY);
      ax += toCenterX * GAME_CONFIG.cohesionForce * cohesionMul;
      ay += toCenterY * GAME_CONFIG.cohesionForce * cohesionMul;

      // Separation: push away from bison (including the leader) that are
      // too close, so followers gather around the leader without stacking
      // on top of it.
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

      // Alignment + forward influence, scaled by this bison's own agility
      // and by how far behind the leader (along the current heading axis)
      // it is. Cruising straight needs no correction regardless of either
      // factor (the target barely changes), so this only matters while
      // actively turning - which is exactly when a slow or trailing
      // individual falls behind, letting a turn visibly travel front-to-back
      // through the herd instead of snapping everyone at once.
      const behindLeader = toCenterX * headingDirX + toCenterY * headingDirY;
      const turnLag = 1 / (1 + Math.max(0, behindLeader) / GAME_CONFIG.turnLagDistance);
      const alignmentBlend = Math.min(1, baseAlignmentBlend * b.agility * turnLag);
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

      if (distToLeader > GAME_CONFIG.lostRadius) {
        b.timeBeyondLostRadius += dt;
        if (b.timeBeyondLostRadius >= GAME_CONFIG.lostDelay) {
          stragglers.push(b);
        }
      } else {
        b.timeBeyondLostRadius = 0;
      }
    }

    this.strand(stragglers);

    // Stranded bison aren't part of the loop above (they're motionless and
    // out of the herd), so their recruit cooldown - see strand() - ticks
    // down here instead.
    for (const b of this.strandedBison) {
      if (b.recruitCooldown > 0) b.recruitCooldown = Math.max(0, b.recruitCooldown - dt);
    }
  }

  // Pulls any bison in `pool` within joinRadius of the leader into the
  // active herd, mutating `pool` in place. The same operation serves wild
  // bison waiting to be recruited and previously-stranded bison the herd
  // has circled back around to - both are just "not currently in the herd".
  // Returns how many joined.
  recruit(pool: Bison[]): number {
    if (pool.length === 0) return 0;

    const joined: Bison[] = [];
    for (const candidate of pool) {
      if (candidate.recruitCooldown > 0) continue;
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
      b.recruitCooldown = 0;
      this.bison.push(b);
    }

    return joined.length;
  }

  // Rocks are solid and unbreakable (spec 12.1). The leader is the bison the
  // player actually controls, so any rock it touches ends the run outright -
  // there's no bouncing back from that. Followers are more forgiving: a herd
  // too small to absorb the hit (smallHerdThreshold) loses whoever touched
  // it outright, same as a straggler, but otherwise they're just shoved
  // clear and knocked outward, a recoverable bump.
  // lossPoints carries where each "this cost the herd a bison" event
  // happened (leader crash or a follower's instant loss), for impact
  // feedback - a mere bounce isn't a loss and doesn't get a point.
  handleRockCollisions(rocks: Rock[]): { leaderCrashed: boolean; lossPoints: { x: number; y: number }[] } {
    for (const rock of rocks) {
      const dist = Math.hypot(this.leader.x - rock.x, this.leader.y - rock.y);
      if (dist < rock.radius + GAME_CONFIG.bisonRadius) {
        return { leaderCrashed: true, lossPoints: [{ x: this.leader.x, y: this.leader.y }] };
      }
    }

    const tooSmallToSurvive = this.bison.length <= GAME_CONFIG.smallHerdThreshold;
    const instantLosses: Bison[] = [];
    const lossPoints: { x: number; y: number }[] = [];

    for (const b of this.bison) {
      if (b === this.leader) continue;
      for (const rock of rocks) {
        const dist = Math.hypot(b.x - rock.x, b.y - rock.y);
        const minDist = rock.radius + GAME_CONFIG.bisonRadius;
        if (dist > 0 && dist < minDist) {
          if (tooSmallToSurvive) {
            // Push clear before freezing it in place - otherwise it's
            // stranded still overlapping the rock, and if the herd is small
            // enough to be tight around the leader, it's also immediately
            // back within joinRadius: recruited next frame, still touching
            // the rock, and instantly re-stranded in an endless loop.
            this.clearFromObstacle(b, rock.x, rock.y, minDist);
            instantLosses.push(b);
            lossPoints.push({ x: b.x, y: b.y });
          } else {
            this.bounceOff(b, rock.x, rock.y, minDist);
          }
        }
      }
    }

    this.strand(instantLosses);
    return { leaderCrashed: false, lossPoints };
  }

  // Fences (spec 12.2): it's the leader - out in front - whose touch decides
  // whether one breaks, based on the herd's size at that moment. Large
  // enough, it breaks and everyone keeps moving; otherwise the leader hits a
  // solid wall and the run ends, same as a rock. Followers that reach a
  // still-unbroken fence bounce off it (or, if the herd's tiny, are lost
  // outright) exactly as before - they just don't get a say in breaking it.
  // Returns how many fences broke this call and where (for celebratory
  // impact feedback), whether the leader crashed, and where any follower was
  // instantly lost (for the distinct "this was a mistake" feedback).
  handleFenceCollisions(fences: Fence[]): {
    brokenCount: number;
    leaderCrashed: boolean;
    breakPoints: { x: number; y: number }[];
    lossPoints: { x: number; y: number }[];
  } {
    let brokenCount = 0;
    let leaderCrashed = false;
    const canBreakThrough = this.bison.length >= GAME_CONFIG.fenceBreakHerdSize;
    const tooSmallToSurvive = this.bison.length <= GAME_CONFIG.smallHerdThreshold;
    const instantLosses: Bison[] = [];
    const breakPoints: { x: number; y: number }[] = [];
    const lossPoints: { x: number; y: number }[] = [];

    for (const fence of fences) {
      if (fence.broken) continue;

      const { x: lcx, y: lcy } = fence.closestPoint(this.leader.x, this.leader.y);
      const leaderDist = Math.hypot(this.leader.x - lcx, this.leader.y - lcy);
      if (leaderDist < GAME_CONFIG.bisonRadius) {
        if (canBreakThrough) {
          fence.break();
          brokenCount++;
          breakPoints.push({ x: lcx, y: lcy });
        } else {
          leaderCrashed = true;
          lossPoints.push({ x: this.leader.x, y: this.leader.y });
        }
        continue;
      }

      for (const b of this.bison) {
        if (b === this.leader) continue;
        const { x: cx, y: cy } = fence.closestPoint(b.x, b.y);
        const dist = Math.hypot(b.x - cx, b.y - cy);
        if (dist >= GAME_CONFIG.bisonRadius) continue;

        if (tooSmallToSurvive) {
          // See handleRockCollisions: push clear first so a re-recruit next
          // frame doesn't land right back on top of the same fence.
          this.clearFromObstacle(b, cx, cy, GAME_CONFIG.bisonRadius);
          instantLosses.push(b);
          lossPoints.push({ x: b.x, y: b.y });
        } else {
          this.bounceOff(b, cx, cy, GAME_CONFIG.bisonRadius);
        }
      }
    }

    this.strand(instantLosses);
    return { brokenCount, leaderCrashed, breakPoints, lossPoints };
  }

  // Shared bounce response for solid obstacles (rocks, unbroken fences):
  // shove the bison clear along the normal from `originX,originY`, cancel
  // the velocity that was carrying it inward, and add a modest outward bump
  // rather than stacking on top of its existing speed (which read as being
  // launched rather than bumped). Never called for the leader, which never
  // bounces - any touch it takes ends the run instead.
  private bounceOff(b: Bison, originX: number, originY: number, minDist: number): void {
    const normal = this.clearFromObstacle(b, originX, originY, minDist);
    if (!normal) return;

    const inward = -(b.vx * normal.x + b.vy * normal.y);
    if (inward > 0) {
      b.vx += normal.x * inward;
      b.vy += normal.y * inward;
    }
    b.vx += normal.x * GAME_CONFIG.obstacleKnockback;
    b.vy += normal.y * GAME_CONFIG.obstacleKnockback;

    const speed = Math.hypot(b.vx, b.vy);
    if (speed > GAME_CONFIG.maxIndividualSpeed) {
      const scale = GAME_CONFIG.maxIndividualSpeed / speed;
      b.vx *= scale;
      b.vy *= scale;
    }

    b.syncGraphics();
  }

  // Shoves a bison's position clear along the normal from `originX,originY`
  // to `minDist` away, with no velocity change - used both as the first step
  // of a bounce and, on its own, to make sure an instantly-lost bison isn't
  // frozen still overlapping the obstacle that cost it (see
  // handleRockCollisions/handleFenceCollisions: left overlapping, a
  // re-recruit next frame would immediately re-trigger the same loss).
  // Returns the outward unit normal, or undefined if the bison was exactly
  // on the origin point (no defined direction to push clear along).
  private clearFromObstacle(
    b: Bison,
    originX: number,
    originY: number,
    minDist: number,
  ): { x: number; y: number } | undefined {
    const dx = b.x - originX;
    const dy = b.y - originY;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return undefined;

    const nx = dx / dist;
    const ny = dy / dist;
    b.x += nx * (minDist - dist);
    b.y += ny * (minDist - dist);
    b.syncGraphics();
    return { x: nx, y: ny };
  }

  // Moves the given bison out of the active herd and into strandedBison
  // (spec: "should not instantly disappear" - it stays visible, motionless,
  // and can still be recruited back later, once recruitCooldown expires).
  // Shared by the turn-induced straggler path and the small-herd instant-loss
  // path on obstacle hits. Safe to call with duplicates (e.g. one bison
  // touching two rocks at once). Never called with the leader - it isn't a
  // follower and can't straggle.
  private strand(list: Bison[]): void {
    if (list.length === 0) return;

    const uniqueLost = new Set(list);
    for (const b of uniqueLost) {
      b.vx = 0;
      b.vy = 0;
      b.recruitCooldown = GAME_CONFIG.recruitCooldown;
      b.gfx.setFillStyle(GAME_CONFIG.strandedBisonColor);
      this.strandedBison.push(b);
    }
    this.bison = this.bison.filter((b) => !uniqueLost.has(b));
    this.totalLost += uniqueLost.size;
  }
}
