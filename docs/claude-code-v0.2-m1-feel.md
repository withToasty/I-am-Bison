# Claude Code — v0.2 M1 FEEL Pass

You are working inside the `I-am-Bison` repository.

Before changing code, read:

- `docs/specification.md`
- `docs/v0.2-m1-feel.md`

The current gameplay implementation is already beyond the original M0–M2 scope. Treat the existing playable code as the baseline.

## Task

Implement **v0.2 M1 — FEEL improvements only**.

The purpose is to make the existing herd movement feel more powerful, heavy, readable, and satisfying.

Do not add a new core gameplay mechanic.

---

## Required changes

### 1. Dynamic camera zoom

Make camera zoom respond smoothly to active herd size.

- small herd = closer
- large herd = wider
- continuous/smoothed transition
- values centralized in config
- keep bison readable at 100+

### 2. Forward camera look-ahead

Offset the camera target slightly in the current heading direction.

- show more upcoming route
- smooth the offset
- avoid snapping during hard turns
- preserve responsive steering feel

### 3. Improve turn propagation feel

Keep the existing herd architecture.

Do not rewrite the simulation from scratch.

Make follower response during steering read more clearly as a bend traveling through the herd.

Use the existing alignment/agility/relative-position concepts where possible.

Avoid:

- rubber banding
- oscillation
- tail whipping
- random-feeling loss
- rigid formation

### 4. Ground / dust feedback

Add lightweight dust or equivalent ground movement feedback.

- scale intensity with herd size
- cap for performance
- do not obscure hazards
- primitive/generated visuals are fine
- avoid an expensive particle system per bison

### 5. Recruitment feedback

When wild or stranded bison join:

- show a short `+N`
- add a small pulse/ring or equivalent visual response
- group near-simultaneous joins if practical
- do not pause gameplay

### 6. Fence-break impact feedback

When the herd successfully breaks a fence:

- brief camera shake
- simple debris/impact particles
- optional extremely short hit-stop only if it clearly improves feel

Failed collisions must feel different from successful destruction.

Do not make shake strong enough to hide the player's mistake.

---

## Configuration

Put all new tuning constants in the existing central config.

Do not scatter magic numbers.

Useful categories include:

- camera zoom
- camera zoom smoothing
- look-ahead distance
- look-ahead smoothing
- dust rate / lifetime / spread
- recruitment feedback timing
- impact shake duration / intensity

Names may differ if clearer.

---

## Scope boundary

DO NOT implement:

- MOMENTUM / STAMPEDE meter
- route choice generation
- new biome progression
- cars
- buildings
- progression/unlocks
- new modes
- save system
- backend
- leaderboard
- final sprites
- final music/audio assets

Do not continue into the next milestone.

---

## Preserve existing gameplay

Do not intentionally change the current rules for:

- recruitment
- herd loss
- rock collision
- fence break threshold
- river behavior
- scoring
- game-over logic

Small tuning changes required to improve feel are acceptable, but call them out in the final report.

---

## Validation

Before finishing:

1. run install/build/typecheck as appropriate
2. fix errors caused by your changes
3. verify desktop keyboard input remains functional
4. verify touch/pointer input remains functional
5. test small, medium, and large herd sizes using the existing dev shortcuts if available
6. check that ~100 bison remains playable
7. confirm no M2+ mechanic was added

If browser verification is available, use it.

---

## Final report

When finished, report:

1. files changed
2. each feel improvement implemented
3. new config values and their location
4. whether any existing gameplay values were changed
5. performance considerations
6. known visual/tuning issues
7. confirmation that MOMENTUM, route-choice systems, and later milestones were intentionally not implemented

Then stop.
