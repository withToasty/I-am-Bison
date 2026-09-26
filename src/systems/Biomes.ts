import { ENCOUNTER_TEMPLATES, EncounterTemplate } from "./EncounterTemplates";
import { ringWobbleScale } from "./WorldNoise";

// Ring-based biome field (v0.3 M-G2, docs/v0.3-biome-map.md section 3.1).
// Each biome owns a radius-from-spawn band; adjacent bands overlap so a
// coordinate's biome weight fades in/out smoothly instead of snapping.
// Bands are tuned so only immediate neighbors ever overlap - never three
// biomes at once - which keeps both the template pool and the ground
// crossfade (GameScene.updateGroundBlend) a simple two-layer blend.
//
// fadeInStart === fadeInEnd (grassland) means "already fully present from
// spawn, no ramp-in needed". fadeOutStart === fadeOutEnd (beyond) means
// "never fades out" - the self-looping terminal biome (spec section 10).
export interface GroundTheme {
  backgroundColor: number;
  backgroundLineColor: number;
}

export interface Biome {
  id: string;
  fadeInStart: number;
  fadeInEnd: number;
  fadeOutStart: number;
  fadeOutEnd: number;
  templates: EncounterTemplate[];
  groundTheme: GroundTheme;
}

function byId(id: string): EncounterTemplate {
  const t = ENCOUNTER_TEMPLATES.find((template) => template.id === id);
  if (!t) throw new Error(`Unknown encounter template id: ${id}`);
  return t;
}

export const BIOMES: Biome[] = [
  {
    id: "grassland",
    fadeInStart: 0,
    fadeInEnd: 0,
    fadeOutStart: 1200,
    fadeOutEnd: 1800,
    templates: [byId("recruit-lure"), byId("rock-gate"), byId("twin-lure")],
    groundTheme: { backgroundColor: 0x2e7d32, backgroundLineColor: 0x266b2b },
  },
  {
    id: "forest",
    fadeInStart: 1200,
    fadeInEnd: 1800,
    fadeOutStart: 2200,
    fadeOutEnd: 3000,
    templates: [byId("fence-choice"), byId("slalom")],
    groundTheme: { backgroundColor: 0x1b5e20, backgroundLineColor: 0x123f16 },
  },
  {
    id: "canyon",
    fadeInStart: 2200,
    fadeInEnd: 3000,
    fadeOutStart: 3800,
    fadeOutEnd: 4500,
    templates: [byId("river-crossing"), byId("gauntlet")],
    groundTheme: { backgroundColor: 0x8d5524, backgroundLineColor: 0x6e4119 },
  },
  {
    id: "snowfield",
    fadeInStart: 3800,
    fadeInEnd: 4500,
    fadeOutStart: 6000,
    fadeOutEnd: 7000,
    templates: [byId("river-reward"), byId("compound-choice")],
    groundTheme: { backgroundColor: 0xdfe9f2, backgroundLineColor: 0xc3d2e0 },
  },
  {
    id: "beyond",
    fadeInStart: 6000,
    fadeInEnd: 7000,
    fadeOutStart: Infinity,
    fadeOutEnd: Infinity,
    // A remix of every biome's templates rather than new authored content
    // (spec section 10) - "no authored end" without infinite authoring.
    templates: [...ENCOUNTER_TEMPLATES],
    groundTheme: { backgroundColor: 0x3a3450, backgroundLineColor: 0x2a2540 },
  },
];

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// `wobble` scales every one of this biome's threshold radii by the same
// factor (v0.3 M-G3, spec section 3.2), so the boundary bulges in/out with
// compass angle instead of being a perfect circle. Scaling both endpoints
// of a fade band by the same positive factor can't reorder them or flip
// the band's direction, and grassland's degenerate 0/0 fade-in and
// beyond's degenerate Infinity/Infinity fade-out both survive the
// multiply unchanged (0*n=0, Infinity*n=Infinity for any finite n>0).
function weightAt(radius: number, b: Biome, wobble: number): number {
  const fadeInStart = b.fadeInStart * wobble;
  const fadeInEnd = b.fadeInEnd * wobble;
  const fadeOutStart = b.fadeOutStart * wobble;
  const fadeOutEnd = b.fadeOutEnd * wobble;

  if (fadeInEnd > fadeInStart && radius < fadeInEnd) {
    if (radius <= fadeInStart) return 0;
    return smoothstep((radius - fadeInStart) / (fadeInEnd - fadeInStart));
  }
  if (fadeOutEnd > fadeOutStart && radius > fadeOutStart) {
    if (radius >= fadeOutEnd) return 0;
    return 1 - smoothstep((radius - fadeOutStart) / (fadeOutEnd - fadeOutStart));
  }
  return 1;
}

// Normalized so the returned weights always sum to 1 (barring the
// zero-biome fallback below, which shouldn't occur given full ring
// coverage from radius 0 to infinity). Takes world coordinates rather than
// a bare radius so the ring-wobble angle (and the noise it samples) can be
// derived from the same point.
export function biomeWeightsAt(x: number, y: number, runSeed: number): Map<string, number> {
  const radius = Math.hypot(x, y);
  const angle = Math.atan2(y, x);
  const wobble = ringWobbleScale(angle, runSeed);

  const raw = new Map<string, number>();
  let total = 0;
  for (const b of BIOMES) {
    const w = weightAt(radius, b, wobble);
    if (w > 0) {
      raw.set(b.id, w);
      total += w;
    }
  }

  if (total <= 0) {
    return new Map([[BIOMES[BIOMES.length - 1].id, 1]]);
  }

  for (const [id, w] of raw) raw.set(id, w / total);
  return raw;
}

export function getBiome(id: string): Biome {
  const b = BIOMES.find((biome) => biome.id === id);
  if (!b) throw new Error(`Unknown biome id: ${id}`);
  return b;
}
