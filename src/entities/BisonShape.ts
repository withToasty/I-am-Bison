// Shared low-poly bison model, seen from straight above and facing +x in its
// own local frame (units of GAME_CONFIG.bisonRadius). GameScene rotates it to
// each bison's heading at draw time. Visual only - collision still uses the
// plain bisonRadius circle.

export type Vec = readonly [number, number];

// Body outline, clockwise from the rump: the heavy shoulder/hump bulges at
// the front-middle, the neck narrows into a small head.
const OUTLINE: Vec[] = [
  [-1.3, 0],
  [-1.0, 0.5],
  [-0.35, 0.88],
  [0.5, 1.15],
  [0.95, 0.75],
  [1.3, 0.55],
  [1.75, 0.4],
  [2.0, 0],
  [1.75, -0.4],
  [1.3, -0.55],
  [0.95, -0.72],
  [0.5, -1.15],
  [-0.35, -0.88],
  [-1.0, -0.5],
];

// Fan centre sits over the hump so the shoulder facets fan out from the peak.
const HUMP: Vec = [0.3, 0];

// Per-facet brightness nudge in shade-level steps: the hump catches light,
// the head sits in a darker tone, the rump falls away.
function trim(a: Vec, b: Vec): number {
  const mx = (a[0] + b[0]) / 2;
  if (mx > 1.1) return -2; // head
  if (mx < -0.7) return -1; // rump
  if (mx > 0.0 && mx < 0.9) return 1; // hump / shoulders
  return 0;
}

export interface ShapeTriangle {
  // Local-frame vertices.
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  // Direction of the facet's centroid from the bison centre, in the local
  // frame; combined with heading to decide how much it faces the light.
  normalAngle: number;
  trim: number;
  // Hooves only: which leg pair this belongs to (0 or 1). The pairs swing
  // half a stride apart while running.
  gait?: 0 | 1;
}

export const BODY_TRIANGLES: ShapeTriangle[] = OUTLINE.map((p, i) => {
  const q = OUTLINE[(i + 1) % OUTLINE.length];
  const mx = (HUMP[0] + p[0] + q[0]) / 3;
  const my = (HUMP[1] + p[1] + q[1]) / 3;
  return {
    ax: HUMP[0],
    ay: HUMP[1],
    bx: p[0],
    by: p[1],
    cx: q[0],
    cy: q[1],
    normalAngle: Math.atan2(my, mx),
    trim: trim(p, q),
  };
});

// Short pale horns curving forward off each side of the head.
export const HORN_TRIANGLES: ShapeTriangle[] = [1, -1].map((s) => ({
  ax: 1.25,
  ay: 0.5 * s,
  bx: 1.2,
  by: 1.35 * s,
  cx: 1.75,
  cy: 0.7 * s,
  normalAngle: 0,
  trim: 0,
}));

// Dark hoof tips poking out past the body edge: front pair under the
// shoulders, rear pair at the haunches (per the reference's dark leg ends).
function hoof(x: number, y: number, gait: 0 | 1): ShapeTriangle {
  const s = Math.sign(y);
  return {
    ax: x - 0.28,
    ay: y - 0.1 * s,
    bx: x + 0.12,
    by: y + 0.38 * s,
    cx: x + 0.3,
    cy: y - 0.05 * s,
    normalAngle: 0,
    trim: 0,
    gait,
  };
}
// Diagonal pairs move together (front-left with rear-right), like a trot.
export const HOOF_TRIANGLES: ShapeTriangle[] = [hoof(0.7, 1.05, 0), hoof(0.7, -1.05, 1), hoof(-0.85, 0.7, 1), hoof(-0.85, -0.7, 0)];

// Whole-model scale (in bisonRadius units' multiplier) so the longer body
// still reads as about one bison-radius wide.
export const SHAPE_SCALE = 0.8;
export const HORN_COLOR = 0xe6dcc0;
