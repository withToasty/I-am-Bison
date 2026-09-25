import Phaser from "phaser";
import "./style.css";
import { GameScene } from "./scenes/GameScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#1a1a1a",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [GameScene],
});
