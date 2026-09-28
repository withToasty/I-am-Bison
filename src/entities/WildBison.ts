import { GAME_CONFIG } from "../config/gameConfig";
import { Bison } from "./Bison";

// A bison that isn't part of the player's herd yet. Mechanically identical
// to Bison - it just sits still, tinted differently, until the herd comes
// within joinRadius and Herd.recruit() folds it in.
export class WildBison extends Bison {
  constructor(x: number, y: number) {
    super(x, y, GAME_CONFIG.wildBisonColor);
  }
}
