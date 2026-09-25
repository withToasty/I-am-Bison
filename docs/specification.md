# I AM BISON — v0.1 Specification

## 1. Project overview

**Repository:** I-am-Bison  
**Working title:** I AM BISON  
**Japanese title candidates:** 「僕はバイソン」 / 「俺はバイソン」

I AM BISON is a top-down 2D action game in which the player controls **a growing herd of American bison rather than one individual bison**.

The core idea is:

> The bigger the herd becomes, the stronger it becomes — but the harder it becomes to control.

The player continuously moves forward, gathers wild bison, avoids or breaks obstacles, and tries to keep the herd together for as long as possible.

The game should feel like controlling **mass, momentum, and a living herd**.

---

## 2. Goal of v0.1

v0.1 is not a polished game. It is a gameplay prototype.

The purpose is to verify:

1. Whether steering a herd feels good.
2. Whether growing the herd feels rewarding.
3. Whether a larger herd becoming harder to turn creates interesting gameplay.
4. Whether sharp turns causing bison to fall behind feels fair rather than arbitrary.
5. Whether nearby wild bison create meaningful route choices.
6. Whether breaking obstacles with a large herd feels satisfying.
7. Whether the player wants to retry after losing the herd.

**Gameplay feel is more important than graphics.**

The prototype should still be enjoyable when every bison is represented by a circle.

---

## 3. Technology

Use:

- TypeScript
- Phaser 3
- Vite
- HTML / CSS
- Git / GitHub

The game should run in a browser.

Primary targets:

- Desktop browser
- Mobile browser

Mobile touch controls are important from the beginning.

---

## 4. Camera and presentation

Use a **top-down 2D view**.

The herd continuously moves in its current forward direction.

The camera follows the herd center.

The player should feel that the world is moving past a large moving mass.

For v0.1:

- Bison can be simple circles or primitive shapes.
- No final artwork is required.
- No realistic animation is required.

---

## 5. Controls

### Mobile

Divide the screen into left and right control zones.

- Hold left half: steer left.
- Hold right half: steer right.
- Release: continue in the current direction.

Holding longer should continue the turn.

### Desktop

Support:

- A or Left Arrow: steer left.
- D or Right Arrow: steer right.

The player does not directly control acceleration or braking in v0.1.

---

## 6. Forward movement

The herd always moves forward automatically.

Initial speed can be constant.

Possible future modifiers such as terrain, downhill movement, stamina, or sprinting are explicitly out of scope for v0.1.

---

## 7. Herd model

The player does not control each bison individually.

The herd has shared state such as:

- center position
- heading
- forward speed
- herd size
- turn responsiveness

Each bison follows simple local movement rules.

Use a lightweight Boids-inspired model:

### Cohesion

Move toward the local or herd center.

### Separation

Avoid overlapping nearby bison.

### Alignment

Tend toward the herd's movement direction.

### Forward influence

Continue moving generally with the herd.

Do **not** implement expensive realistic rigid-body simulation for every bison.

The desired result is visual and tactile plausibility, not physical accuracy.

---

## 8. Core mechanic: herd size vs turning

This is one of the most important systems in the game.

As herd size increases, turning must become slower and wider.

Example target feel:

- 1–10: agile
- 11–30: slightly heavy
- 31–60: clearly heavy
- 61–100: wide turns
- 100+: strong momentum and difficult correction

Prefer a continuous formula over arbitrary tiers.

Example only:

~~~ts
turnRate =
  baseTurnRate /
  (1 + herdSize * herdTurnPenalty);
~~~

All values must be easy to tune.

---

## 9. Delayed turn propagation

Do not make every bison rotate instantly at the same time.

When the player turns:

1. the front of the herd begins changing direction,
2. the middle follows,
3. the rear follows later.

This can be approximated rather than physically simulated.

The important visual behavior is that a large herd bends and stretches while turning.

This delayed response is part of the game's identity.

---

## 10. Herd loss

A bison can become separated from the herd.

Main causes:

- sharp turns
- collisions
- river crossings
- herd splitting

A bison should not instantly disappear just because it exceeds a distance threshold.

Suggested rule:

- if distance from the active herd exceeds a configurable limit,
- and remains beyond that limit for a configurable grace period,
- mark it as lost.

Lost bison are removed from the player's active herd.

Death animation is not required.

They may simply slow down, remain behind, or leave the visible play area.

The player should visually understand:

> I turned too sharply and lost part of the herd.

---

## 11. Wild bison recruitment

Place neutral wild bison in the world.

When the active herd comes within a configurable join radius:

- wild bison become members of the herd,
- they begin following herd behavior,
- herd count increases.

Initial spawn patterns:

- single bison
- groups of 2–3
- small groups of around 5

Placement should encourage route decisions rather than pure randomness.

The player should sometimes choose between:

- a safer route
- a route containing more bison

---

## 12. Obstacles

v0.1 contains only three obstacle types.

### 12.1 Rock

- Cannot be destroyed.
- Must generally be avoided.
- Collisions disrupt individuals and can cause separation.

### 12.2 Fence

Outcome depends on herd size.

Small herd:

- cannot cleanly break through,
- collision disrupts the herd,
- bison may be lost.

Large herd:

- breaks the fence,
- continues moving,
- increments destruction count.

Initial placeholder threshold:

**20 active bison**

This value must be configurable.

### 12.3 River

The river should disrupt herd cohesion rather than instantly kill bison.

While in a river, for example:

- movement speed decreases,
- cohesion weakens,
- spacing increases,
- separation risk increases.

A skilled player should be able to cross with most of the herd intact.

---

## 13. Game over

There is **no fixed time limit** in the default survival mode.

The game ends when:

**active herd count reaches 0**

The target balance is that a normal early player may often survive around **90 seconds**, but 90 seconds is not a forced ending.

Skilled players should be able to continue for several minutes or longer.

Difficulty should emerge from terrain and herd-control demands.

---

## 14. Difficulty progression

Increase difficulty primarily with distance traveled.

Do not simply end the run after a timer.

Possible progression:

### Early area

- open grassland
- many recruitable bison
- very simple steering

### Next area

- rocks
- larger turns required

### Next area

- fences
- introduces herd-size-based destruction

### Next area

- rivers
- introduces spreading and separation

### Later areas

Combine:

- tighter spaces
- multiple obstacles
- risky wild-bison placements
- alternating left/right route demands

The ideal failure is:

> the herd gradually becomes harder to control until the player's own decisions cause it to collapse.

---

## 15. Score data

Track at minimum:

### DISTANCE

How far the run traveled.

### CURRENT HERD

Current active herd size.

### MAX HERD

Maximum herd size reached during the run.

### DESTROYED

Number of breakable objects destroyed.

---

## 16. HUD

Keep HUD minimal.

At minimum show:

- HERD
- DISTANCE

Example:

~~~text
HERD 43

DISTANCE 824m
~~~

---

## 17. Game-over screen

Show at least:

~~~text
STAMPEDE ENDED

DISTANCE
1,284m

MAX HERD
87

DESTROYED
14

RETRY
~~~

Retry must be fast.

The player should be able to immediately start another run.

---

## 18. Minimal feedback and effects

Graphics remain simple, but basic feedback matters.

### Recruitment

Briefly show e.g.:

~~~text
+3
~~~

### Fence destruction

Use a small impact effect and/or mild camera shake.

### Large herd

Optional mild camera shake that scales with herd size.

Do not overbuild visual effects before the core handling feels good.

---

## 19. Audio

Audio is not required for the first mechanical milestone.

However, it is expected to become an important part of the game.

Future direction:

- few bison: isolated hoof impacts
- medium herd: layered hoof rhythm
- huge herd: low-frequency rumble and ground-shaking character

Herd size should eventually influence the soundscape.

---

## 20. Future modes

Do not implement these in v0.1, but keep the architecture flexible enough that they are possible.

### SURVIVAL

Keep the herd alive and travel as far as possible.

### HERD

Maximize herd size.

### RAMPAGE

Destroy objects and maximize destruction score.

### TIME ATTACK

Reach a goal as quickly as possible.

A very large herd may actually be slower to navigate efficiently, creating a size-vs-mobility decision.

### STAGE

Hand-designed stages such as:

- Great Plains
- River
- Forest
- Canyon
- Snowfield

---

## 21. Possible future features

Not part of v0.1:

- predators
- wolves
- stamina
- hunger
- individual stats
- progression
- equipment
- monetization
- login
- online leaderboard
- save system
- story
- weather
- day/night
- bridges
- cliffs
- forests
- snow
- wildfire
- trains
- wagons
- buildings
- multiple herds
- herd-vs-herd interaction
- STAMPEDE power state

---

## 22. Non-goals for v0.1

Do not spend time on:

- realistic bison art
- 3D
- advanced physics
- complex AI
- account systems
- backend services
- multiplayer
- polished menus
- procedural world sophistication
- final audio
- final animation
- monetization

The prototype exists to answer one question:

> Is controlling a growing, heavy bison herd fun?

---

## 23. Configuration

Gameplay tuning values must be centralized rather than scattered across the codebase.

Example:

~~~ts
export const GAME_CONFIG = {
  baseSpeed: 200,
  baseTurnRate: 1.0,

  cohesionForce: 0.5,
  separationForce: 0.8,
  alignmentForce: 0.4,

  herdTurnPenalty: 0.01,

  joinRadius: 100,
  lostRadius: 250,
  lostDelay: 1.0,

  fenceBreakHerdSize: 20,

  riverSpeedMultiplier: 0.65,
};
~~~

These are placeholders, not final values.

---

## 24. Suggested source structure

~~~text
src/
├─ main.ts
├─ scenes/
│  ├─ GameScene.ts
│  └─ GameOverScene.ts
├─ entities/
│  ├─ Bison.ts
│  ├─ WildBison.ts
│  └─ Herd.ts
├─ obstacles/
│  ├─ Rock.ts
│  ├─ Fence.ts
│  └─ River.ts
├─ systems/
│  ├─ HerdMovementSystem.ts
│  ├─ HerdJoinSystem.ts
│  ├─ HerdLossSystem.ts
│  └─ SpawnSystem.ts
├─ config/
│  └─ gameConfig.ts
└─ ui/
   └─ HUD.ts
~~~

Do not force this structure if a simpler design is more appropriate during the first milestones.

Avoid premature abstraction.

---

# 25. Implementation milestones

## M0 — Project setup

- Vite
- TypeScript
- Phaser 3
- browser boot
- basic responsive canvas

### Done when

The game opens locally without runtime errors.

---

## M1 — Single moving prototype

Implement one placeholder bison/circle.

- automatic forward movement
- left steering
- right steering
- desktop keyboard input
- mobile left/right hold areas

### Done when

The single object can be continuously steered on desktop and mobile.

---

## M2 — First herd

Replace the single-object feel with roughly 20 placeholder bison.

Implement simple:

- cohesion
- separation
- alignment
- shared forward direction

### Done when

20 objects move as a recognizable herd and remain steerable.

**STOP after M2 for the first implementation pass.**

Do not implement M3 or later until the herd feel is manually reviewed.

---

## M3 — Herd-size steering penalty

Larger herd = slower/wider steering.

### Done when

10 bison and 50 bison feel clearly different.

---

## M4 — Separation and loss

Sharp steering can cause outside/rear bison to fall behind and eventually leave the active herd.

### Done when

A player can intentionally reproduce herd loss by steering too aggressively.

---

## M5 — Wild recruitment

Wild bison join when approached.

---

## M6 — Rocks

Introduce avoidance and collision disruption.

---

## M7 — Fences

Implement size-dependent breakability.

---

## M8 — Rivers

Implement spreading and increased separation risk.

---

## M9 — Score

Track:

- current herd
- max herd
- distance
- destroyed objects

---

## M10 — Game over and retry

Game over at 0 active bison.

Show results and allow immediate retry.

---

# 26. v0.1 acceptance criteria

The prototype eventually qualifies as v0.1 when all are true:

- runs in a browser
- supports desktop steering
- supports mobile steering
- herd moves automatically
- group movement visually reads as a herd
- large herds turn worse than small herds
- aggressive turns can cause herd loss
- wild bison can join
- rocks exist
- fences can be broken by sufficiently large herds
- rivers disrupt the herd
- 0 bison triggers game over
- distance is tracked
- maximum herd is tracked
- destruction count is tracked
- retry is immediate

---

# 27. Gameplay evaluation questions

After the first playable build, manually evaluate:

1. Does controlling 20+ bison feel like controlling a herd?
2. Does gaining bison feel rewarding?
3. Does a large herd feel satisfyingly heavy?
4. When bison are lost during a sharp turn, does the player understand why?
5. When wild bison are visible, does the player want to steer toward them?
6. After game over, does the player want to retry?

These questions matter more than code elegance or visual polish during v0.1.

---

# 28. Development principle

Do not try to recreate real American bison behavior in full.

The central experience is:

> steering a huge, heavy living mass and trying not to lose control of it.

First make circles fun.

Only then add:

- real bison sprites
- animation
- dust
- hoof sounds
- low-frequency rumble
- environmental art
- stronger destruction
- camera effects
