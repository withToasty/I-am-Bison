import { LocalFence, LocalPoint, LocalRiver, LocalWildGroup } from "./EncounterTemplates";

// Fixed-coordinate content (v0.3 M-G4, docs/v0.3-biome-map.md section 4) -
// unlike a cell's seeded-random content, a landmark is always at the same
// world position across every run, so the player can deliberately navigate
// back to it rather than stumbling into it once. Reuses the encounter
// template's local-offset shape (LocalWildGroup/LocalPoint/LocalFence/
// LocalRiver) but drops the fields that only make sense for a randomly
// selected, randomly rotated chunk (minProgress/maxProgress/weight/length) -
// a landmark is never picked from a pool and never rotated, so those would
// just be dead values.
export interface LandmarkContent {
  wildGroups: LocalWildGroup[];
  rocks: LocalPoint[];
  fences: LocalFence[];
  rivers: LocalRiver[];
}

export interface Landmark {
  id: string;
  x: number;
  y: number;
  // Both the "you've discovered this" radius (section 9's 発見 counter)
  // and the footprint WorldGrid excludes from normal biome-seeded content
  // (see isWithinAnyLandmark) - the landmark's own content is guaranteed
  // to be exactly what's here, not blended with whatever the biome field
  // would otherwise have generated at this spot.
  radius: number;
  content: LandmarkContent;
}

export const LANDMARKS: Landmark[] = [
  // The ranch (spec section 6): grassland's guaranteed-safe detour. No
  // rocks/fences/rivers at all, several generous wild-bison groups spread
  // around the center so arriving from any direction still finds
  // something to recruit.
  {
    id: "ranch",
    x: 700,
    y: -500,
    radius: 420,
    content: {
      wildGroups: [
        { x: 0, y: 0, count: 5, spread: 160 },
        { x: -140, y: 150, count: 4, spread: 90 },
        { x: 150, y: -130, count: 4, spread: 90 },
      ],
      rocks: [],
      fences: [],
      rivers: [],
    },
  },
];

export function isWithinAnyLandmark(x: number, y: number): boolean {
  return LANDMARKS.some((l) => Math.hypot(x - l.x, y - l.y) < l.radius);
}
