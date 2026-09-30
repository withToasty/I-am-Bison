// Centralized gameplay tuning. Keep every balance-relevant constant here
// rather than scattering magic numbers through the scenes/entities.
export const GAME_CONFIG = {
  // Herd composition. Start solo and grow through recruitment (spec's
  // "growing herd" fantasy) - use the 1-5 test keys to compare feel at
  // larger sizes without waiting to recruit up to them.
  herdSize: 1,
  bisonRadius: 8,
  spawnClusterRadius: 70,

  // Forward movement / steering (shared by the whole herd)
  baseSpeed: 160, // px/s forward speed each bison is pulled toward
  baseTurnRate: 1.8, // rad/s the herd heading rotates at with a small/empty herd
  // effectiveTurnRate = baseTurnRate / (1 + herdSize * herdTurnPenalty). At
  // 0.03: size 50 -> 40% turn rate, size 100 -> 25% - a large herd should be
  // noticeably harder to steer, not just nominally (spec's own "the bigger
  // it becomes, the harder it becomes to control").
  herdTurnPenalty: 0.03,

  // World speed scaling (difficulty pass): forward speed climbs with
  // distance from spawn, capped at maxSpeedMultiplier, so the world
  // actually gets faster to react to the further the herd travels - not
  // just visually harsher (per-biome ground/templates) but mechanically
  // more demanding. 1 + radius*speedDistanceScale, e.g. radius 3000 (~mid
  // canyon) -> 1.3x, radius 8000+ (deep in "beyond") -> the 1.8x cap.
  speedDistanceScale: 0.0001,
  maxSpeedMultiplier: 1.8,

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
  // Grace period before a just-lost bison is recruit-eligible again. Without
  // it, an obstacle instant-loss right next to a small/tight herd (still
  // within joinRadius) gets picked back up the moment it's lost, walks
  // straight back into the same obstacle, and repeats every frame.
  recruitCooldown: 1.5,

  // Shared bounce response for any solid obstacle (rocks, unbroken fences):
  // a collision shoves the bison clear and adds this modest outward bump
  // after canceling the velocity that was carrying it in - a nudge, not a
  // launch. Hard enough (or already near the edge of the herd) it can still
  // push a bison past lostRadius and cause a real separation.
  obstacleKnockback: 60,

  // A herd at or below this size can't absorb a hit from a rock or an
  // unbroken fence - the collision costs it that bison outright instead of
  // just bouncing it. Without this, a tiny/solo herd is nearly impossible to
  // wipe out (see herdSize: 1 above), since the turn-induced straggler check
  // measures distance from the herd's own centroid, which for 1-2 bison is
  // always close to zero.
  smallHerdThreshold: 5,

  // Rocks (spec section 12.1): unbreakable obstacles.
  rockRadius: 26,
  rockColor: 0x8c8c8c,
  // Difficulty pass: rocks used to be permanently unbreakable, so the
  // leader touching one always ended the run regardless of herd size. Now
  // every solid obstacle breaks given a big enough herd - rocks just need a
  // bigger one than a fence, so they still feel like the harder obstacle
  // early on.
  rockBreakHerdSize: 30,

  // Barriers - fence/log/ice (spec section 12.2, generalized in
  // obstacles/Fence.ts): whether one breaks depends entirely on the herd's
  // size at the moment it's touched, versus that instance's own
  // breakThreshold. A large enough herd breaks through and keeps moving; a
  // smaller one bounces off it exactly like a rock, with the same chance
  // of disruption/separation. logBreakHerdSize/iceBreakHerdSize are each
  // kind's default threshold when a template doesn't override one.
  fenceThickness: 12,
  fenceBreakHerdSize: 20,
  logBreakHerdSize: 12,
  iceBreakHerdSize: 45,
  fenceColor: 0xb08968,

  // Rivers (spec section 12.3): don't block movement outright - anyone
  // currently inside one moves slower and is pulled back to the herd center
  // more weakly, so the formation visibly loosens while crossing rather than
  // holding tight. A skilled player should be able to get most of the herd
  // across intact.
  riverSpeedMultiplier: 0.65,
  riverCohesionMultiplier: 0.4,
  riverColor: 0x2f6690,
  riverAlpha: 0.55,
  riverFlowSpeed: 26, // px/s the ripple texture scrolls, suggesting current

  // Fence posts (visual only): evenly spaced vertical ticks along the rail
  // so a fence reads as a built structure rather than a flat bar.
  fencePostSpacing: 46,
  fencePostWidth: 6,

  // Score (spec sections 15-16): purely a display conversion, doesn't
  // affect gameplay.
  pixelsPerMeter: 20,

  // Camera (v0.2 M1 feel pass, spec section 4). Zoom eases continuously
  // between these two extremes based on active herd size - a bigger herd
  // should visibly make the world feel smaller/more crowded, not just read
  // bigger in the HUD. cameraZoomHerdReference is the herd size at which the
  // curve is roughly halfway to cameraZoomLarge.
  cameraLerp: 0.08,
  cameraZoomSmall: 1.0,
  cameraZoomLarge: 0.72,
  cameraZoomHerdReference: 30,
  cameraZoomLerp: 0.04,
  // The camera target leads the leader by this many px along the current
  // heading, so the player sees more of what's ahead than what's behind.
  // Smoothed on its own (slower than cameraLerp) so a hard turn doesn't snap
  // the look-ahead point to the new heading instantly.
  cameraLookAhead: 90,
  cameraLookAheadLerp: 0.04,

  // Turn propagation feel (v0.2 M1, spec section 5): a follower meaningfully
  // behind the leader along the current heading axis realigns more slowly
  // than one beside/ahead of it, so a turn visibly travels front-to-back
  // through the herd instead of every bison snapping to the new heading at
  // once. This is a smooth rate multiplier, not a spring/constraint, so it
  // can't ring or overshoot on its own. turnLagDistance is the behind-leader
  // distance (px) at which alignment responsiveness is roughly halved.
  turnLagDistance: 130,

  // Ground/dust feedback (v0.2 M1, spec section 6). Emission rate scales
  // from dustMinRate (near-solo herd) up toward dustMaxRate as active herd
  // size approaches dustHerdReference, then levels off - capped regardless
  // of herd size so cost never scales unbounded.
  dustMinRate: 4, // particles/sec
  dustMaxRate: 55, // particles/sec, hard cap
  dustHerdReference: 50,
  dustLifetime: 550, // ms
  dustSpread: 16, // px random offset from the emitting bison

  // Recruitment feedback (v0.2 M1, spec section 7): a "+N" readout and a
  // pulse ring at the join point. Joins within recruitFeedbackDuration of
  // each other accumulate into the same popup instead of stacking new ones.
  recruitFeedbackDuration: 850, // ms
  recruitPulseScale: 4.5, // ring grows to this multiple of bisonRadius

  // Impact feedback (v0.2 M1, spec section 8): breaking through a fence is a
  // deliberate, celebratory hit - a longer, softer shake plus warm debris in
  // the fence's own color. A collision that costs the herd a bison (or ends
  // the run outright) reads as a mistake instead - shorter and sharper, with
  // a cooler-toned burst, so the two are never confused for each other.
  fenceBreakShakeDuration: 220,
  fenceBreakShakeIntensity: 0.01,
  collisionShakeDuration: 130,
  collisionShakeIntensity: 0.018,

  // World grid (v0.3 M-G1, docs/v0.3-biome-map.md): content lives on an
  // infinite grid of square cells. A cell's content is a pure function of
  // its coordinates (WorldGrid picks a template and rotation from a seed
  // derived from cellX/cellY), so revisiting a cell after it's been
  // unloaded reproduces the same layout instead of finding it deleted -
  // this replaces v0.2 M2's one-way spawn-ahead/delete-behind frontier,
  // which only worked because the herd was assumed to never turn back.
  worldCellSize: 600, // px per cell, both axes
  worldLoadRadiusCells: 2, // cells kept loaded in each direction -> a 5x5 window around the player
  // Crossing a cell boundary can make several cells enter/leave the window
  // at once; instantiating (or destroying) all of their Phaser objects
  // synchronously in a single frame is what caused visible movement
  // stutter. Draining a few per frame instead spreads that cost out -
  // unloads are cheaper (pure destroy, no generation/noise sampling) so
  // more of them can happen per frame than loads.
  worldMaxLoadsPerFrame: 2,
  worldMaxUnloadsPerFrame: 4,

  // River noise field (v0.3 M-G3, spec section 3.3): independent of biome
  // rings, so a river can wind across more than one biome band. A cell
  // whose noise value exceeds the threshold is forced to a river template
  // regardless of what its ring would otherwise pick. riverNoiseScale is
  // the noise field's feature size (px) - bigger means broader, more
  // gently winding river bands.
  riverNoiseScale: 900,
  riverNoiseThreshold: 0.62,

  // Ring wobble (v0.3 M-G3, spec section 3.2): every biome ring boundary
  // is scaled by the same per-angle factor, so the boundary reads as an
  // organic coastline instead of a perfect circle without ever crossing or
  // gapping an adjacent ring (they all warp together). ringWobbleAmount is
  // the max +/- fraction a boundary's radius can shift; sampleRadius is
  // how far apart in noise-space the angle samples are taken from (larger
  // = slower-changing wobble as you go around).
  ringWobbleAmount: 0.15,
  ringWobbleSampleRadius: 3,

  // Landmarks (v0.3 M-G4, spec section 4/6): a landmark's own content
  // stays loaded a bit further than its discovery radius (so it's visible
  // and worth walking toward before you're already on top of it) and
  // unloads a bit further still, so being right at the discovery boundary
  // doesn't flicker content in and out.
  landmarkLoadMargin: 300,
  landmarkUnloadMargin: 450,

  // Simulation
  maxDeltaMs: 33, // clamp per-frame dt (~30fps floor) to avoid physics spikes on hitches

  // Visuals
  backgroundTileSize: 64,
  backgroundColor: 0x2e7d32,
  backgroundLineColor: 0x266b2b,
  bisonColor: 0x6b4423,
  leaderColor: 0xe63946, // the bison you control - unmistakable against the herd/wild/stranded palette
  wildBisonColor: 0xd4a017, // not yet in your herd - tinted gold so it reads as "recruit me"
  strandedBisonColor: 0x8a7f6b, // fell out of your herd - dimmed, but still recruitable
  headingMarkerColor: 0xffee58,
  headingMarkerLength: 90,

  // Low-poly bison silhouette (art direction pass - a top-down stand-in for
  // "faceted 3D model" since the camera is locked straight down and there's
  // no real 3D geometry to shade). Each bison gets a fixed ring of flat
  // triangular facets instead of a smooth circle; see entities/Bison.ts.
  lowPolyFacetCount: 6,
  lowPolyRadiusJitter: 0.28, // +/- fraction of bisonRadius per facet vertex
  lowPolyAngleJitter: 0.18, // +/- radians per facet vertex, off the even spacing
  lowPolyLightAngle: (-3 * Math.PI) / 4, // fixed "sun" direction, upper-left
  // Discrete brightness steps a facet can land on (relative to the base
  // color) - flat-shaded like real low-poly faces, not a smooth gradient.
  lowPolyShadeLevels: [-0.22, -0.1, 0, 0.12, 0.24],
};
