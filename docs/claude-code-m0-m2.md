# Claude Code — Initial Implementation Prompt (M0–M2)

Use this prompt for the first implementation pass of **I AM BISON**.

---

You are working inside the `I-am-Bison` repository.

Before changing code, read:

- `docs/specification.md`

The specification is the source of truth for the game concept.

## Your task

Implement **M0, M1, and M2 only**.

Do **not** implement M3 or anything beyond M2 yet.

The reason is that we want to manually evaluate the most important part of the game — herd movement and steering feel — before adding further systems.

---

## M0 — Project setup

Set up a minimal browser game using:

- Vite
- TypeScript
- Phaser 3

Requirements:

- project starts locally with the normal development command
- no runtime console errors
- canvas adapts reasonably to desktop and mobile browser sizes
- keep dependencies minimal
- do not add backend services
- do not add React unless there is a compelling technical reason; plain Phaser + TypeScript is preferred

---

## M1 — Single-bison steering prototype

Create a basic game scene with one placeholder circle representing a bison.

Behavior:

- it moves forward automatically
- player cannot manually accelerate or brake
- desktop:
  - A / Left Arrow = steer left
  - D / Right Arrow = steer right
- mobile:
  - holding the left half of the game area steers left
  - holding the right half steers right
- releasing input continues in the current heading

The input should be continuous rather than a one-time tap rotation.

Do not use final artwork.

---

## M2 — First herd

Expand the prototype to approximately **20 placeholder bison**.

The player should feel like they are steering a herd rather than a single sprite.

Implement a lightweight Boids-inspired solution using some combination of:

- cohesion
- separation
- alignment
- shared forward movement

Important:

- do not simulate every bison as a realistic rigid body
- do not over-engineer collision physics
- the herd should remain visibly alive and imperfect
- individual bison should not overlap excessively
- the group should stretch and settle naturally while turning
- the herd should generally maintain forward motion

The camera should follow the herd as a whole, preferably using the herd center rather than one specific bison.

---

## Tuning

Create a centralized config file for tunable gameplay constants.

At minimum expose useful parameters such as:

- base forward speed
- base turn rate
- cohesion force
- separation force
- alignment force
- preferred spacing
- camera follow behavior if relevant

Use sensible placeholder values.

Do not scatter important balance constants throughout the source code.

---

## Visuals

Use simple primitives.

For example:

- dark/neutral background or simple grass-colored field
- circles or simple shapes for bison
- optional marker/line showing current herd heading during development

Do not spend significant time on art.

The goal is to test movement.

---

## Scope boundary

For this pass, DO NOT implement:

- herd-size turn penalty
- herd loss
- wild bison recruitment
- rocks
- fences
- rivers
- score
- game over
- sound
- final sprites
- dust effects
- menus
- multiplayer
- backend
- procedural level generation

Those belong to later milestones.

---

## Code quality

Keep the code easy to modify.

Prefer straightforward code over elaborate architecture.

It is fine to create small classes/modules such as:

- GameScene
- Bison
- Herd
- gameConfig

but avoid premature abstraction.

Add comments only where behavior or formulas are not self-explanatory.

---

## Validation

Before finishing:

1. install dependencies if necessary
2. run the project build
3. run TypeScript checks if configured
4. fix all errors caused by your changes
5. confirm both keyboard and touch/pointer input paths exist
6. confirm the code stops at M2 scope

If you can run a browser/dev-server verification in the environment, verify that the game loads and the herd is visible.

---

## Final response

When finished, report:

1. files created/changed
2. how to run the game
3. the current movement model
4. the most important tuning values and where they live
5. any limitations or known issues
6. confirmation that M3+ was intentionally not implemented

Do not continue to M3 without explicit approval.
