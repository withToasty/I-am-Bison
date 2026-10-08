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

  // The HUD is scroll-factor 0 but still goes through the camera's zoom,
  // which scales it toward the screen centre. Undo that so it stays pinned to
  // the top-left at full size: screen = centre + (pos - centre) * zoom.
  layout(zoom: number, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;
    this.text.setScale(1 / zoom).setPosition(cx + (16 - cx) / zoom, cy + (16 - cy) / zoom);
  }

  update(herdSize: number, distanceMeters: number): void {
    this.text.setText(`HERD ${herdSize}\n\nDISTANCE ${Math.floor(distanceMeters)}m`);
  }
}
