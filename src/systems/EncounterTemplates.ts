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
    // Phased out once harder/denser late-game templates are eligible (spec
    // section 8, Band 3) so a run doesn't keep drawing its easiest layouts
    // forever - see rock-gate and twin-lure below for the same treatment.
    maxProgress: 1800,
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
    maxProgress: 2200,
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
    // A rock guards the direct line to the reward, so growing the herd
    // there is itself a small dodge, not a freebie approach - difficulty
    // pass: this template previously had zero rocks despite being one of
    // the two highest-band templates.
    rocks: [{ x: 70, y: -110 }],
    fences: [{ x: 0, y: -320, width: 200 }],
    rivers: [],
  },

  // G. Twin Lure - two reward groups on opposite sides instead of one safe
  // lane vs one reward lane. The center rocks are offset enough that going
  // straight isn't free, so the player picks a side rather than getting
  // both. An early-game variety piece, phased out alongside recruit-lure/
  // rock-gate.
  {
    id: "twin-lure",
    minProgress: 150,
    maxProgress: 1400,
    weight: 1,
    length: 320,
    wildGroups: [
      { x: -170, y: -200, count: 3, spread: 40 },
      { x: 170, y: -200, count: 3, spread: 40 },
    ],
    rocks: [
      { x: -40, y: -160 },
      { x: 40, y: -240 },
    ],
    fences: [],
    rivers: [],
  },

  // H. River Crossing - the river covers most of the lane; a narrow dry
  // lane survives on the far left, marked by a rock at its edge so it
  // doesn't read as just open field. No reward either way - this is
  // river-reward's plainer, more frequent sibling, since a river-reward
  // pool of one meant most runs barely saw a river at all.
  {
    id: "river-crossing",
    minProgress: 700,
    weight: 1,
    length: 340,
    wildGroups: [],
    rocks: [{ x: -170, y: -190 }],
    fences: [],
    rivers: [{ x: 40, y: -200, width: 280, height: 100 }],
  },

  // I. Gauntlet - a compact late-game combo: a slalom-style rock pair,
  // then a fence, with the reward placed beyond the fence rather than
  // before it (compound-choice's reward comes first) so pushing through
  // is what pays off, not just approaching.
  {
    id: "gauntlet",
    minProgress: 2800,
    weight: 1.3,
    length: 480,
    wildGroups: [{ x: 190, y: -420, count: 4, spread: 40 }],
    // Difficulty pass: a third rock tightens the final gap right before
    // the fence, so the approach itself demands a correction instead of
    // just the fence-or-detour choice.
    rocks: [
      { x: -60, y: -150 },
      { x: 70, y: -230 },
      { x: -50, y: -280 },
    ],
    fences: [{ x: -20, y: -330, width: 220 }],
    rivers: [],
  },
];
