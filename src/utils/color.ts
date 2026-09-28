import Phaser from "phaser";

// Small helpers for deriving a rim/highlight tone from a base fill color at
// draw time, instead of hand-picking a second hex value for every colored
// shape (bison, rocks, fences...).
function toHSV(color: number): Phaser.Types.Display.HSVColorObject {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.RGBToHSV(c.red, c.green, c.blue);
}

export function lighten(color: number, amount: number): number {
  const hsv = toHSV(color);
  const out = Phaser.Display.Color.HSVToRGB(hsv.h, hsv.s, Phaser.Math.Clamp(hsv.v + amount, 0, 1));
  return (out as Phaser.Display.Color).color;
}

export function darken(color: number, amount: number): number {
  const hsv = toHSV(color);
  const out = Phaser.Display.Color.HSVToRGB(hsv.h, hsv.s, Phaser.Math.Clamp(hsv.v - amount, 0, 1));
  return (out as Phaser.Display.Color).color;
}
