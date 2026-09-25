import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import { Herd } from "../entities/Herd";
import { SteeringInput } from "../input/SteeringInput";

export class GameScene extends Phaser.Scene {
  private herd!: Herd;
  private steering!: SteeringInput;
  private background!: Phaser.GameObjects.TileSprite;
  private cameraTarget!: Phaser.GameObjects.Zone;
  private headingMarker!: Phaser.GameObjects.Graphics;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.generateGroundTexture();

    this.background = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, "ground")
      .setOrigin(0, 0)
      .setScrollFactor(0);

    this.herd = new Herd(this, GAME_CONFIG.herdSize, 0, 0);
    this.steering = new SteeringInput(this);

    this.headingMarker = this.add.graphics();

    this.cameraTarget = this.add.zone(this.herd.centerX, this.herd.centerY, 1, 1);
    this.cameras.main.startFollow(this.cameraTarget, true, GAME_CONFIG.cameraLerp, GAME_CONFIG.cameraLerp);

    this.scale.on("resize", this.handleResize, this);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    this.herd.update(dt, this.steering.direction);

    this.cameraTarget.setPosition(this.herd.centerX, this.herd.centerY);
    this.background.tilePositionX = this.herd.centerX;
    this.background.tilePositionY = this.herd.centerY;

    this.drawHeadingMarker();
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
  }
}
