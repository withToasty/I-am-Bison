// Hand-authored encounter chunks (v0.2 M2, docs/v0.2-m2-encounter-route.md
// section 5-6). Each template is a local arrangement of the existing
// gameplay object types - wild bison, rocks, fences, rivers - authored
// relative to a chunk anchor at local (0, 0). EncounterDirector places the
// anchor in the world and instantiates every local entry at
// anchor + local offset.
//
// Local Y follows the same convention as world Y: more negative = further
// ahead (forward = negative world Y, spec section 4). `length` is how far
// ahead of the anchor (in +px, along -Y) the template's content extends, so
// the director can space chunks without overlap and know when a chunk is
// far enough behind the player to clean up.
//
// These are data, not spawn functions - keep every layout easy to read and
// tune in this one file rather than splitting it into per-template code.

export interface LocalPoint {
  x: number;
  y: number;
}

export interface LocalWildGroup {
  x: number;
  y: number;
  count: number;
  spread?: number; // random radius around (x, y); defaults to a tight cluster
}

export interface LocalFence {
  x: number;
  y: number;
  width: number;
}

export interface LocalRiver {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EncounterTemplate {
  id: string;
  minProgress: number;
  maxProgress?: number;
  weight: number;
  length: number;

  wildGroups: LocalWildGroup[];
  rocks: LocalPoint[];
  fences: LocalFence[];
  rivers: LocalRiver[];
}

export const ENCOUNTER_TEMPLATES: EncounterTemplate[] = [
  // A. Recruit Lure - the straight line through local x=0 is always clear.
  // The reward sits off to one side, with a couple of rocks in the way just
  // enough to make reaching it a deliberate turn rather than a freebie.
  {
    id: "recruit-lure",
    minProgress: 0,
    weight: 1,
    length: 300,
    wildGroups: [{ x: 170, y: -170, count: 4, spread: 45 }],
    rocks: [
      { x: 80, y: -140 },
      { x: 95, y: -230 },
    ],
    fences: [],
    rivers: [],
  },

  // B. Rock Gate - a wide, empty lane on the left; a tighter lane on the
  // right (between the center rock column and the outer rock) holding a
  // small reward. Both lanes are always readable and passable.
  {
    id: "rock-gate",
    minProgress: 0,
    weight: 1,
    length: 320,
    wildGroups: [{ x: 100, y: -195, count: 3, spread: 35 }],
    rocks: [
      { x: -20, y: -150 },
      { x: -20, y: -240 },
      { x: 190, y: -195 },
    ],
    fences: [],
    rivers: [],
  },

  // C. Fence Choice - a fence spans the center; both edges stay open for a
  // detour. A herd already at fenceBreakHerdSize can go straight through.
  // A small wild group sits before the fence so a small herd has a chance
  // to grow before deciding.
  {
    id: "fence-choice",
    minProgress: 400,
    weight: 1,
    length: 340,
    wildGroups: [{ x: 160, y: -160, count: 3, spread: 35 }],
    rocks: [],
    fences: [{ x: -30, y: -220, width: 220 }],
    rivers: [],
  },

  // D. River Reward - a fully dry lane on the left costs nothing and gains
  // nothing. The river on the right loosens the herd while crossing, but a
  // recruitable group waits just beyond it as the payoff for taking the
  // risk.
  {
    id: "river-reward",
    minProgress: 1200,
    weight: 1,
    length: 360,
    wildGroups: [{ x: 150, y: -280, count: 4, spread: 40 }],
    rocks: [],
    fences: [],
    rivers: [{ x: 150, y: -200, width: 180, height: 90 }],
  },

  // E. Slalom - single rocks alternating close to the centerline force
  // repeated left-right correction. Gaps stay wide relative to a bison, so
  // the difficulty comes from herd handling (turn lag, straggling) rather
  // than an impossible gap.
  {
    id: "slalom",
    minProgress: 1200,
    weight: 1,
    length: 460,
    wildGroups: [],
    rocks: [
      { x: -60, y: -130 },
      { x: 70, y: -230 },
      { x: -70, y: -330 },
      { x: 60, y: -410 },
    ],
    fences: [],
    rivers: [],
  },

  // F. Compound Choice - a risky-side recruit group early, then a fence
  // shortly after. Only meaningfully eligible once the run has had time to
  // build up herd size elsewhere, so an earlier route decision can change
  // what's viable here.
  {
    id: "compound-choice",
    minProgress: 2400,
    weight: 1.4,
    length: 460,
    wildGroups: [{ x: 150, y: -160, count: 4, spread: 40 }],
    rocks: [],
    fences: [{ x: 0, y: -320, width: 200 }],
    rivers: [],
  },
];
