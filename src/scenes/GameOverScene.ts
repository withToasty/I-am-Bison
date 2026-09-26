import Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";

export interface GameOverData {
  distanceMeters: number;
  maxHerd: number;
  destroyed: number;
  discoveries: number;
}

// Results screen shown when the active herd hits zero (spec sections 13,
// 17). Retry is a single tap or key press so a new run starts immediately.
export class GameOverScene extends Phaser.Scene {
  private result!: GameOverData;

  constructor() {
    super("GameOverScene");
  }

  init(data: GameOverData): void {
    this.result = data;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_CONFIG.backgroundColor);

    const centerX = this.scale.width / 2;
    let y = this.scale.height * 0.22;

    this.add
      .text(centerX, y, "STAMPEDE ENDED", {
        fontFamily: "monospace",
        fontSize: "34px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const stats: [string, string][] = [
      ["DISTANCE", `${Math.floor(this.result.distanceMeters).toLocaleString()}m`],
      ["MAX HERD", `${this.result.maxHerd}`],
      ["DISCOVERIES", `${this.result.discoveries}`],
      ["DESTROYED", `${this.result.destroyed}`],
    ];

    y += 90;
    for (const [label, value] of stats) {
      this.add
        .text(centerX, y, label, { fontFamily: "monospace", fontSize: "16px", color: "#bdbdbd" })
        .setOrigin(0.5);
      this.add
        .text(centerX, y + 28, value, { fontFamily: "monospace", fontSize: "30px", color: "#ffffff" })
        .setOrigin(0.5);
      y += 84;
    }

    this.add
      .text(centerX, y + 24, "RETRY", {
        fontFamily: "monospace",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#1a1a1a",
        backgroundColor: "#ffee58",
        padding: { x: 28, y: 10 },
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, y + 70, "tap or press any key", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#8f8f8f",
      })
      .setOrigin(0.5);

    const retry = () => {
      this.scene.start("GameScene");
    };

    // Brief delay before arming retry input: a player often dies mid-steer,
    // still holding the key/touch that was in use - the browser's key
    // auto-repeat could otherwise fire an unwanted instant retry before
    // they've even seen the results.
    this.time.delayedCall(300, () => {
      this.input.keyboard?.once("keydown", retry);
      this.input.once("pointerdown", retry);
    });
  }
}
