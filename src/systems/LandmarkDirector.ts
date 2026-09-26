import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { WildBison } from "../entities/WildBison";
import { Rock } from "../obstacles/Rock";
import { Fence } from "../obstacles/Fence";
import { River } from "../obstacles/River";
import { Landmark, LANDMARKS } from "./Landmarks";

// One landmark's currently-instantiated content, mirroring WorldGrid's
// CellRuntime - see that class for why the diff (recruited members,
// broken fences) is tracked by key rather than by object identity alone.
interface LandmarkRuntime {
  rocks: { index: number; rock: Rock }[];
  fences: { index: number; fence: Fence }[];
  rivers: River[];
  wildMembers: { key: string; bison: WildBison }[];
}

// Manages fixed-coordinate content (v0.3 M-G4, docs/v0.3-biome-map.md
// section 4/6) alongside WorldGrid's seeded-random cells. A landmark is
// never picked from a pool and never rotated - it's simply always there,
// so the player can deliberately navigate back to it - and WorldGrid
// excludes any cell inside a landmark's radius from its own generation
// (Landmarks.isWithinAnyLandmark) so the two systems never overlap.
//
// Deliberately a thin, separate class rather than folded into WorldGrid or
// generalized behind a shared "spawn content and track its diff" helper:
// there's exactly one landmark today, and the load/unload/diff pattern is
// simple enough that the small duplication with WorldGrid.loadCell/
// unloadCell is easier to read than an abstraction built for a second
// caller that doesn't exist yet.
export class LandmarkDirector {
  private loadedIds = new Set<string>();
  private runtimes = new Map<string, LandmarkRuntime>();
  private recruitedMembers = new Set<string>();
  private brokenFences = new Set<string>();
  private brokenRocks = new Set<string>();
  private discovered = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rocks: Rock[],
    private readonly fences: Fence[],
    private readonly rivers: River[],
    private readonly wildBison: WildBison[],
  ) {}

  get discoveryCount(): number {
    return this.discovered.size;
  }

  // Cheap enough (a handful of landmarks at most) to check every frame,
  // unlike WorldGrid's cell window which gates on crossing a cell
  // boundary.
  update(playerX: number, playerY: number): void {
    for (const landmark of LANDMARKS) {
      const dist = Math.hypot(playerX - landmark.x, playerY - landmark.y);

      if (dist < landmark.radius) this.discovered.add(landmark.id);

      const isLoaded = this.loadedIds.has(landmark.id);
      if (dist < landmark.radius + GAME_CONFIG.landmarkLoadMargin && !isLoaded) {
        this.load(landmark);
      } else if (dist > landmark.radius + GAME_CONFIG.landmarkUnloadMargin && isLoaded) {
        this.unload(landmark);
      }
    }
  }

  private load(landmark: Landmark): void {
    const runtime: LandmarkRuntime = { rocks: [], fences: [], rivers: [], wildMembers: [] };
    const { content } = landmark;

    for (let ri = 0; ri < content.rocks.length; ri++) {
      const rockKey = `${landmark.id}:rock${ri}`;
      if (this.brokenRocks.has(rockKey)) continue; // stays broken forever

      const r = content.rocks[ri];
      const rock = new Rock(this.scene, landmark.x + r.x, landmark.y + r.y, r.breakThreshold);
      runtime.rocks.push({ index: ri, rock });
      this.rocks.push(rock);
    }

    for (let fi = 0; fi < content.fences.length; fi++) {
      const fenceKey = `${landmark.id}:fence${fi}`;
      if (this.brokenFences.has(fenceKey)) continue; // stays broken forever

      const f = content.fences[fi];
      const fence = new Fence(this.scene, landmark.x + f.x, landmark.y + f.y, f.width, f.kind, f.breakThreshold);
      runtime.fences.push({ index: fi, fence });
      this.fences.push(fence);
    }

    for (const rv of content.rivers) {
      const river = new River(this.scene, landmark.x + rv.x, landmark.y + rv.y, rv.width, rv.height);
      river.gfx.setDepth(-6);
      runtime.rivers.push(river);
      this.rivers.push(river);
    }

    for (let gi = 0; gi < content.wildGroups.length; gi++) {
      const wg = content.wildGroups[gi];
      for (let mi = 0; mi < wg.count; mi++) {
        const memberKey = `${landmark.id}:wg${gi}:${mi}`;
        if (this.recruitedMembers.has(memberKey)) continue; // already collected, gone for good

        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const radius = Phaser.Math.FloatBetween(0, wg.spread ?? GAME_CONFIG.separationRadius * 1.5);
        const wx = landmark.x + wg.x + Math.cos(angle) * radius;
        const wy = landmark.y + wg.y + Math.sin(angle) * radius;
        const wb = new WildBison(wx, wy);
        runtime.wildMembers.push({ key: memberKey, bison: wb });
        this.wildBison.push(wb);
      }
    }

    this.runtimes.set(landmark.id, runtime);
    this.loadedIds.add(landmark.id);
  }

  private unload(landmark: Landmark): void {
    const runtime = this.runtimes.get(landmark.id);
    if (!runtime) return;

    for (const { index, rock } of runtime.rocks) {
      const idx = this.rocks.indexOf(rock);
      if (idx !== -1) this.rocks.splice(idx, 1);
      if (rock.broken) this.brokenRocks.add(`${landmark.id}:rock${index}`);
      rock.destroy();
    }

    for (const { index, fence } of runtime.fences) {
      const idx = this.fences.indexOf(fence);
      if (idx !== -1) this.fences.splice(idx, 1);
      if (fence.broken) this.brokenFences.add(`${landmark.id}:fence${index}`);
      fence.destroy();
    }

    for (const river of runtime.rivers) {
      const idx = this.rivers.indexOf(river);
      if (idx !== -1) this.rivers.splice(idx, 1);
      river.destroy();
    }

    for (const { key, bison } of runtime.wildMembers) {
      const idx = this.wildBison.indexOf(bison);
      if (idx === -1) this.recruitedMembers.add(key);
      else this.wildBison.splice(idx, 1);
    }

    this.runtimes.delete(landmark.id);
    this.loadedIds.delete(landmark.id);
  }
}
