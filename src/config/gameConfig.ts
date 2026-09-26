// Centralized gameplay tuning. Keep every balance-relevant constant here
// rather than scattering magic numbers through the scenes/entities.
export const GAME_CONFIG = {
  // Herd composition
  herdSize: 20,
  bisonRadius: 8,
  spawnClusterRadius: 70,

  // Forward movement / steering (shared by the whole herd)
  baseSpeed: 160, // px/s forward speed each bison is pulled toward
  baseTurnRate: 1.8, // rad/s the herd heading rotates at with a small/empty herd
  herdTurnPenalty: 0.02, // effectiveTurnRate = baseTurnRate / (1 + herdSize * herdTurnPenalty)

  // Boids-inspired per-bison behavior
  cohesionForce: 0.6, // spring constant pulling a bison toward the herd center
  separationForce: 300, // px/s^2 repulsion strength at zero distance
  separationRadius: 24, // preferred spacing before repulsion kicks in
  alignmentForce: 3.0, // per-second blend rate toward the herd's forward velocity, at full responsiveness
  maxIndividualSpeed: 256, // hard clamp so cohesion/separation can't run away

  // Separation and loss (spec sections 9-10). Each bison is born with a
  // fixed agility multiplier on its own alignment responsiveness, so a
  // naturally slower individual can't keep its velocity matched to the
  // herd's heading while that heading is changing quickly. That mismatch
  // only appears *while actively turning* - cruising straight needs no
  // correction regardless of agility, so a resting/straight-line herd never
  // drifts apart on its own. If a bison ends up beyond lostRadius from the
  // herd center for lostDelay seconds, it leaves the active herd for good.
  minAgility: 0.15,
  maxAgility: 1.2,
  lostRadius: 190,
  lostDelay: 1.0,

  // Wild recruitment (spec section 11) and rejoining strays. Both are the
  // same operation - a bison outside the active herd joins once the herd
  // center comes within joinRadius of it.
  joinRadius: 100,
  joinSettleTime: 1.0, // seconds a newly joined bison is excluded from the herd centroid

  // Rocks (spec section 12.1): unbreakable obstacles. A colliding bison is
  // shoved clear and knocked outward - generally a recoverable bump, but
  // hard enough (or already near the edge of the herd) it can push a bison
  // past lostRadius and cause a real separation, same as a sharp turn.
  rockRadius: 26,
  rockKnockback: 220, // px/s velocity impulse applied along the away-from-rock normal
  rockColor: 0x8c8c8c,

  // Camera
  cameraLerp: 0.08,

  // Simulation
  maxDeltaMs: 33, // clamp per-frame dt (~30fps floor) to avoid physics spikes on hitches

  // Visuals
  backgroundTileSize: 64,
  backgroundColor: 0x2e7d32,
  backgroundLineColor: 0x266b2b,
  bisonColor: 0x6b4423,
  wildBisonColor: 0xd4a017, // not yet in your herd - tinted gold so it reads as "recruit me"
  strandedBisonColor: 0x8a7f6b, // fell out of your herd - dimmed, but still recruitable
  headingMarkerColor: 0xffee58,
  headingMarkerLength: 90,
};
