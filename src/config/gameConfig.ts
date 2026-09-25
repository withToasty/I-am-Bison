// Centralized gameplay tuning. Keep every balance-relevant constant here
// rather than scattering magic numbers through the scenes/entities.
export const GAME_CONFIG = {
  // Herd composition
  herdSize: 20,
  bisonRadius: 8,
  spawnClusterRadius: 70,

  // Forward movement / steering (shared by the whole herd)
  baseSpeed: 160, // px/s forward speed each bison is pulled toward
  baseTurnRate: 1.8, // rad/s the herd heading rotates at while steering

  // Boids-inspired per-bison behavior
  cohesionForce: 0.6, // spring constant pulling a bison toward the herd center
  separationForce: 300, // px/s^2 repulsion strength at zero distance
  separationRadius: 24, // preferred spacing before repulsion kicks in
  alignmentForce: 3.0, // per-second blend rate toward the herd's forward velocity
  maxIndividualSpeed: 256, // hard clamp so cohesion/separation can't run away

  // Camera
  cameraLerp: 0.08,

  // Visuals
  backgroundTileSize: 64,
  backgroundColor: 0x2e7d32,
  backgroundLineColor: 0x266b2b,
  bisonColor: 0x6b4423,
  headingMarkerColor: 0xffee58,
  headingMarkerLength: 90,
};
