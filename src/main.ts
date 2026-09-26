import Phaser from "phaser";
import "./style.css";
import { GameScene } from "./scenes/GameScene";

const parent = document.getElementById("app")!;

const game = new Phaser.Game({
  // Force the Canvas2D renderer rather than AUTO (which prefers WebGL).
  // This prototype only ever draws circles, a line, and a tiled background -
  // nothing that benefits from WebGL - and Canvas2D is far more likely to
  // work unmodified in a locked-down/sandboxed embedding.
  type: Phaser.CANVAS,
  parent: "app",
  backgroundColor: "#1a1a1a",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: parent.clientWidth || window.innerWidth,
    height: parent.clientHeight || window.innerHeight,
  },
  scene: [GameScene],
});

// Some embedded/iframed hosts resize the page's viewport without ever
// firing the window "resize" event that Phaser's RESIZE mode listens for,
// which leaves the canvas stuck at whatever size (even 0x0) it had at boot.
// Watching the actual container box directly is a robust fallback.
new ResizeObserver((entries) => {
  const { width, height } = entries[0].contentRect;
  if (width > 0 && height > 0) {
    game.scale.resize(width, height);
  }
}).observe(parent);
