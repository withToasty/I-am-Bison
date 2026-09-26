import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { Herd } from "../entities/Herd";
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

  constructor() {
    super("GameScene");
  }

  init(data: GameSceneData): void {
    this.herdSize = data.herdSize ?? GAME_CONFIG.herdSize;
  }

  create(): void {
    this.generateGroundTexture();

    this.background = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, "ground")
      .setOrigin(0, 0)
      .setScrollFactor(0);

    // Rivers are drawn on the ground first so bison, rocks, and fences
    // render on top of them.
    this.rivers = spawnRivers(this);

    this.herd = new Herd(this, this.herdSize, 0, 0);
    this.wildBison = spawnWildBison(this);
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

    this.scale.on("resize", this.handleResize, this);
    this.setupHerdSizeTestKeys();
  }

  update(_time: number, delta: number): void {
    // Clamp so a frame hitch (tab throttling, GC pause) can't turn into a
    // single oversized physics step that looks like a stutter/pop.
    const dt = Math.min(delta, GAME_CONFIG.maxDeltaMs) / 1000;

    this.herd.update(dt, this.steering.direction, this.rivers);
    this.herd.handleRockCollisions(this.rocks);
    this.totalDestroyed += this.herd.handleFenceCollisions(this.fences);

    // Score (spec sections 15-16): distance is straight-line displacement
    // from spawn, not total path length - looping in place to rack up an
    // odometer reading shouldn't count as "how far the run traveled". Track
    // the farthest point ever reached so backing up doesn't lower the score.
    const distanceFromSpawn = Math.hypot(this.herd.centerX - this.spawnX, this.herd.centerY - this.spawnY);
    this.maxDistanceFromSpawn = Math.max(this.maxDistanceFromSpawn, distanceFromSpawn);
    this.maxHerdSize = Math.max(this.maxHerdSize, this.herd.size);

    // Game over the instant the active herd hits zero (spec section 13) -
    // checked before recruitment so a wild/stranded bison waiting at the
    // herd's last known center can't "revive" an already-extinct herd.
    if (this.herd.size === 0) {
      this.scene.start("GameOverScene", {
        distanceMeters: this.maxDistanceFromSpawn / GAME_CONFIG.pixelsPerMeter,
        maxHerd: this.maxHerdSize,
        destroyed: this.totalDestroyed,
      } satisfies GameOverData);
      return;
    }

    this.totalRecruited += this.herd.recruit(this.wildBison);
    this.totalRecruited += this.herd.recruit(this.herd.strandedBison);

    this.cameraTarget.setPosition(this.herd.centerX, this.herd.centerY);
    this.background.tilePositionX = this.herd.centerX;
    this.background.tilePositionY = this.herd.centerY;

    this.drawHeadingMarker();
    this.hud.update(this.herd.size, this.maxDistanceFromSpawn / GAME_CONFIG.pixelsPerMeter);
    this.updateDevText();
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

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.background.setSize(gameSize.width, gameSize.height);
    this.devText.setY(gameSize.height - 12);
  }
}
