import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { WildBison } from "../entities/WildBison";
import { Rock } from "../obstacles/Rock";
import { Fence } from "../obstacles/Fence";
import { River } from "../obstacles/River";
import { ENCOUNTER_TEMPLATES, EncounterTemplate } from "./EncounterTemplates";

// A single spawned instance of a template. Owns references to everything it
// created so cleanup can remove exactly those objects later - and nothing
// else - from GameScene's shared active-object arrays.
interface RuntimeEncounter {
  templateId: string;
  backY: number; // furthest-ahead edge of this chunk (anchorY - template.length)
  rocks: Rock[];
  fences: Fence[];
  rivers: River[];
  wildBison: WildBison[];
}

// Turns the old one-time fixed obstacle layout into a continuously
// generated stream of hand-authored encounter chunks (v0.2 M2, spec
// section 11). Tracks forward course progress, keeps a small window of
// chunks spawned ahead of the player, and cleans up chunks once they're far
// enough behind. GameScene owns the actual gameplay arrays (rocks, fences,
// rivers, wildBison) - this class only ever pushes to / splices from them,
// so the existing collision/recruit/draw code needs no changes.
export class EncounterDirector {
  private frontierY: number;
  private active: RuntimeEncounter[] = [];
  private lastSpawnedTemplateId = "";
  private encounterCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rocks: Rock[],
    private readonly fences: Fence[],
    private readonly rivers: River[],
    private readonly wildBison: WildBison[],
  ) {
    this.frontierY = -GAME_CONFIG.encounterInitialSafeDistance;
  }

  get activeCount(): number {
    return this.active.length;
  }

  get lastTemplateId(): string {
    return this.lastSpawnedTemplateId;
  }

  get encounterIndex(): number {
    return this.encounterCount;
  }

  // Called once from GameScene.create(). The first two encounters are
  // forced rather than rolled, so the player's first decisions are always
  // the easiest, most legible ones (spec section 7).
  primeInitialEncounters(): void {
    this.spawnChunk("recruit-lure");
    this.spawnChunk("rock-gate");
    this.fillAhead(0);
  }

  // Called every frame from GameScene.update(). leaderY is the player's
  // current forward position (world Y, negative = further along).
  update(leaderY: number): void {
    this.fillAhead(leaderY);
    this.cleanupBehind(leaderY);
  }

  private fillAhead(leaderY: number): void {
    // Keep the frontier at least encounterSpawnAhead px ahead of the
    // player at all times, spawning as many chunks as needed to catch up.
    while (this.frontierY > leaderY - GAME_CONFIG.encounterSpawnAhead) {
      const progress = Math.max(0, -this.frontierY);
      this.spawnChunk(this.pickTemplate(progress).id);
    }
  }

  // Weighted random pick among templates eligible at this progress,
  // excluding the immediately previous template so it never repeats
  // back-to-back (spec section 9). Falls back to the full template list if
  // nothing is eligible yet (shouldn't normally happen since template A/B
  // both open at progress 0).
  private pickTemplate(progress: number): EncounterTemplate {
    const eligible = ENCOUNTER_TEMPLATES.filter(
      (t) => progress >= t.minProgress && (t.maxProgress === undefined || progress <= t.maxProgress),
    );
    const pool = eligible.length > 0 ? eligible : ENCOUNTER_TEMPLATES;
    const withoutLast = pool.filter((t) => t.id !== this.lastSpawnedTemplateId);
    const finalPool = withoutLast.length > 0 ? withoutLast : pool;

    const totalWeight = finalPool.reduce((sum, t) => sum + t.weight, 0);
    let roll = Phaser.Math.FloatBetween(0, totalWeight);
    for (const t of finalPool) {
      roll -= t.weight;
      if (roll <= 0) return t;
    }
    return finalPool[finalPool.length - 1];
  }

  private spawnChunk(templateId: string): void {
    const template = ENCOUNTER_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const anchorY = this.frontierY;
    const anchorX = Phaser.Math.FloatBetween(
      -GAME_CONFIG.encounterMaxCenterOffset,
      GAME_CONFIG.encounterMaxCenterOffset,
    );

    const runtime: RuntimeEncounter = {
      templateId: template.id,
      backY: anchorY - template.length,
      rocks: [],
      fences: [],
      rivers: [],
      wildBison: [],
    };

    for (const r of template.rocks) {
      const rock = new Rock(this.scene, anchorX + r.x, anchorY + r.y);
      runtime.rocks.push(rock);
      this.rocks.push(rock);
    }

    for (const f of template.fences) {
      const fence = new Fence(this.scene, anchorX + f.x, anchorY + f.y, f.width);
      runtime.fences.push(fence);
      this.fences.push(fence);
    }

    for (const rv of template.rivers) {
      const river = new River(this.scene, anchorX + rv.x, anchorY + rv.y, rv.width, rv.height);
      // Rivers spawned mid-run are added to the display list after
      // bisonGraphics already exists, which would otherwise render them on
      // top of the herd. Force them behind everything but the background,
      // matching the original one-time layout's draw order.
      river.gfx.setDepth(-6);
      runtime.rivers.push(river);
      this.rivers.push(river);
    }

    for (const wg of template.wildGroups) {
      for (let i = 0; i < wg.count; i++) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const radius = Phaser.Math.FloatBetween(0, wg.spread ?? GAME_CONFIG.separationRadius * 1.5);
        const wx = anchorX + wg.x + Math.cos(angle) * radius;
        const wy = anchorY + wg.y + Math.sin(angle) * radius;
        const wb = new WildBison(wx, wy);
        runtime.wildBison.push(wb);
        this.wildBison.push(wb);
      }
    }

    this.active.push(runtime);
    this.lastSpawnedTemplateId = template.id;
    this.encounterCount++;

    this.frontierY = anchorY - Math.max(template.length, GAME_CONFIG.encounterChunkSpacing);
  }

  private cleanupBehind(leaderY: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const enc = this.active[i];
      // Not yet far enough behind the player - leave it alone.
      if (leaderY > enc.backY - GAME_CONFIG.encounterCleanupBehind) continue;

      for (const rock of enc.rocks) {
        const idx = this.rocks.indexOf(rock);
        if (idx !== -1) this.rocks.splice(idx, 1);
        rock.destroy();
      }

      for (const fence of enc.fences) {
        const idx = this.fences.indexOf(fence);
        if (idx !== -1) this.fences.splice(idx, 1);
        fence.destroy();
      }

      for (const river of enc.rivers) {
        const idx = this.rivers.indexOf(river);
        if (idx !== -1) this.rivers.splice(idx, 1);
        river.destroy();
      }

      // A wild bison recruited into the active herd has already been
      // spliced out of this shared array by Herd.recruit() - it's now a
      // Bison the active herd owns, not wild content, so it simply won't be
      // found here and is left completely untouched.
      for (const wb of enc.wildBison) {
        const idx = this.wildBison.indexOf(wb);
        if (idx !== -1) this.wildBison.splice(idx, 1);
      }

      this.active.splice(i, 1);
    }
  }
}
