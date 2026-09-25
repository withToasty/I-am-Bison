import Phaser from "phaser";

// Continuous left/right steering input, combining desktop keyboard with
// mobile/touch hold zones (left half of the screen = steer left, right half
// = steer right). Releasing input simply stops contributing a direction;
// the herd itself keeps moving in whatever heading it last had.
export class SteeringInput {
  private readonly scene: Phaser.Scene;
  private leftKey: Phaser.Input.Keyboard.Key | undefined;
  private rightKey: Phaser.Input.Keyboard.Key | undefined;
  private aKey: Phaser.Input.Keyboard.Key | undefined;
  private dKey: Phaser.Input.Keyboard.Key | undefined;

  private readonly pointerZones = new Map<number, "left" | "right">();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.leftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
      this.rightKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
      this.aKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.dKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    }

    scene.input.addPointer(2); // allow a couple of simultaneous touches
    scene.input.on("pointerdown", this.handlePointerDown, this);
    scene.input.on("pointermove", this.handlePointerMove, this);
    scene.input.on("pointerup", this.handlePointerUp, this);
    scene.input.on("pointerupoutside", this.handlePointerUp, this);
  }

  get direction(): number {
    let dir = 0;
    const leftHeld = this.leftKey?.isDown || this.aKey?.isDown || this.hasPointerZone("left");
    const rightHeld = this.rightKey?.isDown || this.dKey?.isDown || this.hasPointerZone("right");

    if (leftHeld) dir -= 1;
    if (rightHeld) dir += 1;
    return Phaser.Math.Clamp(dir, -1, 1);
  }

  destroy(): void {
    this.scene.input.off("pointerdown", this.handlePointerDown, this);
    this.scene.input.off("pointermove", this.handlePointerMove, this);
    this.scene.input.off("pointerup", this.handlePointerUp, this);
    this.scene.input.off("pointerupoutside", this.handlePointerUp, this);
  }

  private hasPointerZone(zone: "left" | "right"): boolean {
    for (const value of this.pointerZones.values()) {
      if (value === zone) return true;
    }
    return false;
  }

  private zoneForPointer(pointer: Phaser.Input.Pointer): "left" | "right" {
    const halfWidth = this.scene.scale.width / 2;
    return pointer.x < halfWidth ? "left" : "right";
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.pointerZones.set(pointer.id, this.zoneForPointer(pointer));
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) return;
    if (this.pointerZones.has(pointer.id)) {
      this.pointerZones.set(pointer.id, this.zoneForPointer(pointer));
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    this.pointerZones.delete(pointer.id);
  }
}
