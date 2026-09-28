import Phaser from "phaser";

// Minimal in-run HUD (spec section 16): just the two numbers a player needs
// to see at a glance while playing. Everything else tracked for the score
// (max herd, destroyed count) only matters at game over.
export class HUD {
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add
      .text(16, 16, "", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
        lineSpacing: 6,
      })
      .setScrollFactor(0);
  }

  update(herdSize: number, distanceMeters: number): void {
    this.text.setText(`HERD ${herdSize}\n\nDISTANCE ${Math.floor(distanceMeters)}m`);
  }
}
