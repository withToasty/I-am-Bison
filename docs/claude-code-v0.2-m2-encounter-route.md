# Claude Code Task — I AM BISON v0.2 M2 Encounter / Route System

Implement the next milestone described in:

- `docs/specification.md`
- `docs/v0.2-m1-feel.md`
- `docs/v0.2-m2-encounter-route.md`

Read the current implementation first. Do not assume the original v0.1 milestone state; the branch already contains the full prototype plus the v0.2 M1 feel pass.

## Goal

Convert the current finite fixed-coordinate world into a continuously generated sequence of **hand-authored encounter chunks**.

The player should repeatedly choose between:

- safe route
- risky recruitment route
- direct fence route vs detour
- dry route vs river/reward route
- gentle steering vs aggressive slalom

Do not add a new core mechanic.

## Current branch behavior to preserve

The current implementation already includes:

- Phaser + Vite + TypeScript
- desktop and mobile steering
- herd-size turn penalty
- boids-like herd movement
- delayed turn propagation
- straggler loss / stranded bison / re-recruitment
- wild-bison recruitment
- rocks
- breakable fences
- rivers
- score / game over / retry
- dynamic camera zoom
- forward camera look-ahead
- dust
- recruitment +N feedback
- distinct break-success vs collision-failure impact feedback
- batched bison rendering for larger herds

Do not regress these systems.

## Important product decisions for this milestone

1. Course forward direction remains **negative world Y**.
2. Route choice happens mainly through left/right movement around world X = 0.
3. Do not rotate encounter chunks.
4. Keep the current displayed DISTANCE logic unchanged unless a tiny compatibility change is required.
5. Use separate internal forward course progress:
   `Math.max(0, spawnY - leaderY)`
6. Preserve current leader-crash behavior:
   - leader + rock = game over
   - leader + unbreakable fence = game over
7. Do not implement STAMPEDE / MOMENTUM.

## Required implementation

### 1. Add encounter template data

Create a simple data-driven template definition, preferably in:

`src/systems/EncounterTemplates.ts`

or a similarly clear location.

Each template should define local positions relative to a chunk anchor for existing object types:

- wild-bison groups
- rocks
- fences
- rivers

Keep the data easy to tune.

Implement approximately 6 templates with these distinct intentions:

- Recruit Lure
- Rock Gate
- Fence Choice
- River Reward
- Slalom
- Compound Choice

Do not make them cosmetic variations of the same layout.

### 2. Add EncounterDirector

Create:

`src/systems/EncounterDirector.ts`

or equivalent.

It should:

- receive / access the scene and current gameplay arrays
- track next encounter position
- track course progress
- maintain a small set of active runtime encounter chunks
- spawn enough chunks ahead of the player
- choose templates by progress band
- prevent immediate exact template repeats
- optionally use weighted selection
- apply a small bounded X offset per chunk
- clean up chunks far behind the player

Keep the system understandable. Do not build a generic procedural-generation engine.

### 3. Replace finite fixed spawning

The current `SpawnSystem.ts` has fixed arrays for:

- WILD_GROUPS
- ROCK_POSITIONS
- FENCE_SPANS
- RIVER_SPANS

Refactor so these fixed finite arrays are no longer the core run structure.

GameScene should initialize the EncounterDirector and update it during play.

The game must continue generating content after the player passes the location of the old river.

### 4. Runtime object ownership / cleanup

A spawned encounter must know which objects it created.

When sufficiently behind the player:

- remove encounter rocks from GameScene's active rock list
- remove encounter fences from the active fence list
- remove encounter rivers from the active river list
- remove unrecruited wild bison belonging to that encounter
- destroy remaining graphics safely

Critical:

**Never delete a bison that was recruited into the active herd.**

Wild-bison cleanup must only remove objects still present in the wild pool.

Broken fences may already have destroyed their graphics. Cleanup must not crash in that case.

If useful, add `destroy()` methods to Rock / Fence / River.

### 5. Encounter progression

Use forward Y progress for encounter difficulty.

Simple bands are enough.

Example shape:

- introduction
- basic choices
- combined systems
- sustained run

The first two encounters should be predictable for readability:

1. Recruit Lure
2. Rock Gate

After that, choose from eligible templates.

Avoid exact immediate repeats.

### 6. Config

Put important tuning values in `GAME_CONFIG`.

Add values such as:

- encounterChunkSpacing
- encounterSpawnAhead
- encounterCleanupBehind
- encounterInitialSafeDistance
- encounterMaxCenterOffset

Names can differ.

Do not scatter tuning numbers through the scene/director.

### 7. Fairness

Every encounter must have at least one plausible route for a small herd.

Do not create:

- mandatory 20+ bison fence walls
- impossible rock walls
- new hazards spawning directly on the herd
- wild bison embedded inside obstacles
- gaps designed only for the leader radius while the herd physically cannot fit

The risky route may be difficult, but the safe route must be readable.

### 8. Debug / manual testing support

Preserve the current herd-size test keys.

It is acceptable to extend the dev text with:

- course progress
- active encounter count
- latest template id

Do not build a polished debug menu.

## Suggested architecture

A simple structure is enough:

```text
src/
  systems/
    EncounterDirector.ts
    EncounterTemplates.ts
    SpawnSystem.ts   // helpers only if still useful
```

A runtime encounter can own arrays of references to its spawned objects.

Do not over-engineer.

## Acceptance tests

Before stopping, verify:

1. A run continues generating content well beyond the original fixed world.
2. Recruit Lure visibly presents safe vs reward routes.
3. Rock Gate visibly presents at least two readable lines.
4. Fence Choice can be navigated by a small herd without requiring fence destruction.
5. A 20+ herd can use fence destruction as a viable shortcut.
6. River Reward contains a safer dry route and a riskier rewarded river route.
7. Slalom is playable with 50–100 bison and difficult because of herd handling, not impossible geometry.
8. Exact template repetition does not occur back-to-back.
9. Old obstacles / wild bison are removed behind the player.
10. Recruited bison survive cleanup of the encounter they originally came from.
11. Long play does not cause arrays / graphics to grow without bound.
12. Existing game-over, retry, score, camera, dust, impact, recruitment and herd behavior still function.
13. `npm run build` and `npm run typecheck` pass.

## Non-goals

Do not implement:

- STAMPEDE / MOMENTUM
- new obstacle types
- predators
- enemies
- cars / wagons / buildings
- progression
- upgrades
- new modes
- final art
- final audio
- backend
- leaderboard
- save system

## Stop condition

Once the Encounter / Route System is implemented, tested, and the project builds successfully:

**STOP.**

Do not move on to the next mechanic.

In your completion message, summarize:

- files added / changed
- the 6 encounter templates
- how progression / selection works
- how cleanup works
- any compatibility fixes you had to make
- manual tests performed
- build / typecheck result
