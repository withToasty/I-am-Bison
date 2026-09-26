import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { WildBison } from "../entities/WildBison";
import { Rock } from "../obstacles/Rock";
import { Fence } from "../obstacles/Fence";
import { River } from "../obstacles/River";
import { EncounterTemplate } from "./EncounterTemplates";
import { biomeWeightsAt, getBiome } from "./Biomes";
import { hashCellSeed, SeededRandom } from "../utils/seededRandom";

// One cell's currently-instantiated content, plus enough bookkeeping to
// compute the world diff (section 7, docs/v0.3-biome-map.md) when it
// unloads: which fence array index each Fence came from, and which wild
// bison "member key" each WildBison came from.
interface CellRuntime {
  templateId: string;
  rocks: Rock[];
  fences: { templateIndex: number; fence: Fence }[];
  rivers: River[];
  wildMembers: { key: string; bison: WildBison }[];
}

// Replaces v0.2 M2's EncounterDirector (docs/v0.3-biome-map.md M-G1). That
// class spaced hand-authored chunks along a single forward-only frontier
// and deleted them forever once behind the player - correct only because
// the herd was assumed to never turn back. Heading actually has no limit
// (a sustained turn is a full U-turn today), so this generates content
// from an infinite 2D grid of cells instead: any cell's content is a pure
// function of its coordinates plus a small run-scoped diff of what's
// already been recruited or broken there, so revisiting a cell reproduces
// it instead of finding it deleted. See the spec for the full model.
// M-G2 adds biome rings (Biomes.ts): a cell's template pool is now drawn
// from whichever biome(s) blend at its distance from spawn, instead of one
// flat pool everywhere.
export class WorldGrid {
  private loaded = new Map<string, CellRuntime>();
  // The world diff (spec section 7): recruited wild bison and broken
  // fences must never regenerate, no matter how many times their cell is
  // reloaded. Everything else (rocks, rivers, template choice, rotation,
  // not-yet-recruited wild bison) is fully reproducible from the seed
  // alone and needs no memory at all.
  private recruitedMembers = new Set<string>();
  private brokenFences = new Set<string>();
  private readonly runSeed: number;
  private lastPlayerCellX: number | null = null;
  private lastPlayerCellY: number | null = null;
  private lastTemplateId = "";
  private lastBiomeId = "";
  private lastCellX = 0;
  private lastCellY = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rocks: Rock[],
    private readonly fences: Fence[],
    private readonly rivers: River[],
    private readonly wildBison: WildBison[],
  ) {
    this.runSeed = Math.floor(Math.random() * 0xffffffff);
  }

  get loadedCount(): number {
    return this.loaded.size;
  }

  get lastTemplate(): string {
    return this.lastTemplateId;
  }

  get lastBiome(): string {
    return this.lastBiomeId;
  }

  get lastCell(): { x: number; y: number } {
    return { x: this.lastCellX, y: this.lastCellY };
  }

  // Called every frame from GameScene.update() with the leader's current
  // world position. Cheap to call when the player hasn't crossed a cell
  // boundary - the whole body short-circuits until they have.
  update(playerX: number, playerY: number): void {
    const cellSize = GAME_CONFIG.worldCellSize;
    const playerCellX = Math.floor(playerX / cellSize);
    const playerCellY = Math.floor(playerY / cellSize);

    if (playerCellX === this.lastPlayerCellX && playerCellY === this.lastPlayerCellY) return;
    this.lastPlayerCellX = playerCellX;
    this.lastPlayerCellY = playerCellY;

    const r = GAME_CONFIG.worldLoadRadiusCells;
    const wanted = new Set<string>();
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = playerCellX + dx;
        const cy = playerCellY + dy;
        const key = this.cellKey(cx, cy);
        wanted.add(key);
        if (!this.loaded.has(key)) this.loadCell(cx, cy);
      }
    }

    for (const [key, cell] of this.loaded) {
      if (!wanted.has(key)) this.unloadCell(key, cell);
    }
  }

  private cellKey(cellX: number, cellY: number): string {
    return `${cellX},${cellY}`;
  }

  // The four cells straddling the spawn corner (world (0,0)) never spawn
  // hazards, so the herd can never start on top of one - the equivalent of
  // v0.2's encounterInitialSafeDistance, just as a small area instead of a
  // runway in one direction.
  private isSafeCell(cellX: number, cellY: number): boolean {
    return cellX >= -1 && cellX <= 0 && cellY >= -1 && cellY <= 0;
  }

  private loadCell(cellX: number, cellY: number): void {
    const key = this.cellKey(cellX, cellY);
    const runtime: CellRuntime = { templateId: "", rocks: [], fences: [], rivers: [], wildMembers: [] };

    if (this.isSafeCell(cellX, cellY)) {
      this.loaded.set(key, runtime);
      return;
    }

    const cellSize = GAME_CONFIG.worldCellSize;
    const centerX = (cellX + 0.5) * cellSize;
    const centerY = (cellY + 0.5) * cellSize;

    const rng = new SeededRandom(hashCellSeed(cellX, cellY, this.runSeed));
    const radius = Math.hypot(centerX, centerY);
    const template = this.pickTemplate(rng, radius);
    const rotation = rng.range(0, Math.PI * 2);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    // Templates are authored assuming "reward is further from the start
    // lane," which no longer has one fixed compass direction now that the
    // herd can approach a cell from anywhere - rotating each instance
    // keeps that framing valid regardless of approach direction.
    const rotate = (lx: number, ly: number): { x: number; y: number } => ({
      x: centerX + lx * cos - ly * sin,
      y: centerY + lx * sin + ly * cos,
    });

    runtime.templateId = template.id;

    for (const r of template.rocks) {
      const p = rotate(r.x, r.y);
      const rock = new Rock(this.scene, p.x, p.y);
      runtime.rocks.push(rock);
      this.rocks.push(rock);
    }

    for (let fi = 0; fi < template.fences.length; fi++) {
      const fenceKey = `${key}:fence${fi}`;
      if (this.brokenFences.has(fenceKey)) continue; // stays broken forever

      const f = template.fences[fi];
      const p = rotate(f.x, f.y);
      const fence = new Fence(this.scene, p.x, p.y, f.width);
      runtime.fences.push({ templateIndex: fi, fence });
      this.fences.push(fence);
    }

    for (const rv of template.rivers) {
      const p = rotate(rv.x, rv.y);
      const river = new River(this.scene, p.x, p.y, rv.width, rv.height);
      // Matches v0.2 M2: force rivers behind everything but the
      // background so they never render on top of the herd.
      river.gfx.setDepth(-6);
      runtime.rivers.push(river);
      this.rivers.push(river);
    }

    for (let gi = 0; gi < template.wildGroups.length; gi++) {
      const wg = template.wildGroups[gi];
      for (let mi = 0; mi < wg.count; mi++) {
        const memberKey = `${key}:wg${gi}:${mi}`;
        if (this.recruitedMembers.has(memberKey)) continue; // already collected, gone for good

        const angle = rng.range(0, Math.PI * 2);
        const radius = rng.range(0, wg.spread ?? GAME_CONFIG.separationRadius * 1.5);
        const p = rotate(wg.x + Math.cos(angle) * radius, wg.y + Math.sin(angle) * radius);
        const wb = new WildBison(p.x, p.y);
        runtime.wildMembers.push({ key: memberKey, bison: wb });
        this.wildBison.push(wb);
      }
    }

    this.loaded.set(key, runtime);
    this.lastCellX = cellX;
    this.lastCellY = cellY;
    this.lastTemplateId = template.id;
    this.lastBiomeId = [...biomeWeightsAt(radius).entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  private unloadCell(key: string, cell: CellRuntime): void {
    for (const rock of cell.rocks) {
      const idx = this.rocks.indexOf(rock);
      if (idx !== -1) this.rocks.splice(idx, 1);
      rock.destroy();
    }

    for (const { templateIndex, fence } of cell.fences) {
      const idx = this.fences.indexOf(fence);
      if (idx !== -1) this.fences.splice(idx, 1);
      if (fence.broken) this.brokenFences.add(`${key}:fence${templateIndex}`);
      fence.destroy();
    }

    for (const river of cell.rivers) {
      const idx = this.rivers.indexOf(river);
      if (idx !== -1) this.rivers.splice(idx, 1);
      river.destroy();
    }

    for (const { key: memberKey, bison } of cell.wildMembers) {
      const idx = this.wildBison.indexOf(bison);
      if (idx === -1) {
        // No longer in the shared array - Herd.recruit() already spliced
        // it into the active herd. Never respawn it.
        this.recruitedMembers.add(memberKey);
      } else {
        // Still wild and simply off-screen now - remove it from the
        // shared array too (it has no Phaser display object of its own;
        // GameScene draws directly from this array) so reloading the cell
        // later can recreate it fresh instead of the array growing
        // forever as new, never-visited-again cells get generated.
        this.wildBison.splice(idx, 1);
      }
    }

    this.loaded.delete(key);
  }

  // Combines every biome present at this radius into one weighted pool - a
  // template's effective weight is its own authored weight times its
  // biome's local blend weight, so a cell in a 70/30 grassland/forest
  // blend draws from grassland templates 70% as often as it would deeper
  // in pure grassland, not a hard cutoff at the ring boundary.
  private pickTemplate(rng: SeededRandom, radius: number): EncounterTemplate {
    const biomeWeights = biomeWeightsAt(radius);
    const pool: { template: EncounterTemplate; weight: number }[] = [];
    for (const [biomeId, biomeWeight] of biomeWeights) {
      for (const template of getBiome(biomeId).templates) {
        pool.push({ template, weight: template.weight * biomeWeight });
      }
    }

    const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
    let roll = rng.range(0, totalWeight);
    for (const p of pool) {
      roll -= p.weight;
      if (roll <= 0) return p.template;
    }
    return pool[pool.length - 1].template;
  }
}
