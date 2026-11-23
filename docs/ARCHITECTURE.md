# ADR-001: Engine / content split for an episodic chase game

**Status:** Accepted
**Date:** 2026-11-21

## Context

The game will grow by adding episodes over a long period. Each episode needs its own setting,
cast, spawn points, missions, scripted chase moments, items, audio and ending - but the character
controller, camera, physics, AI, HUD and menus must stay the same so the game keeps one feel and
one visual identity. Adding an episode must not require touching engine code.

## Decision

Two layers with a one-way dependency: **`src/content` depends on `src/engine`, never the reverse.**

- **Engine** exposes registries (characters, prop types, items, traps, environments, episodes) and
  runs any registered episode through `GameSession`.
- **Content** registers data and small render components into those registries. Episodes are plain
  `EpisodeDefinition` objects discovered with `import.meta.glob`.

### Runtime pipeline (per frame, `GameSession` → `Simulation`)

```
input -> player intent -> AI brains -> abilities -> locomotion -> Rapier step
      -> gameplay rules (catch, traps, pickups, rooms, zones) -> EpisodeRuntime -> HUD (10 Hz)
```

- **Mutable world (`core/world.ts`)** holds per-frame state outside React (positions, intents,
  status effects, noise). React never re-renders at 60 fps.
- **Zustand store (`core/store.ts`)** holds coarse UI state: screen, selections, settings, HUD
  snapshot, toasts, results.
- **Event bus (`core/events.ts`)** carries gameplay facts (`caught`, `slipped`, `pickup`,
  `enterZone`…) to the mission runtime, camera shake, toasts and audio.
- **EpisodeRuntime (`episode/runtime.ts`)** is pure TypeScript: objectives, lose conditions,
  timer, scripted chase events. It is unit-tested without a browser.
- **Player and AI share everything below the intent level**: both write a `ControlIntent`; the
  same locomotion, abilities and interaction rules apply. AI is "just another controller".

### Systems map

| System | Location | Notes |
| --- | --- | --- |
| Character | `engine/characters` | `CharacterDefinition`: body, movement, abilities, perception, look, optional GLB |
| Animation | `engine/characters/animation` | Procedural animator: locomotion, gags, squash & stretch, faces |
| Camera | `engine/camera` | Orbit + zoom, collision, auto-follow, chase FOV, shake, cinematic end shot |
| Physics | `core/physics.ts`, Rapier | Collision layers; characters never collide with each other |
| Interaction | `engine/interaction` | Registry of doors, hide spots, knockables; items & traps |
| AI | `engine/ai` | NavGrid per body size (mouse holes only fit mice), hunter/prey/guardian brains |
| Environment | `engine/environment` | Rooms, walls with openings, wallpaper, props; shared with nav grid |
| Input | `engine/input` | Keyboard, pointer lock, touch, gamepad merged into one state |
| Audio | `engine/audio` | Procedural SFX & music; file overrides per sound id |
| Episode | `engine/episode` | Contract, registry, runtime, validation |

### AI state machines (Part 2)

| Character | States | Notable behaviour |
| --- | --- | --- |
| Hunter (cat) | sleep, patrol, investigate, chase, enraged, intercept, search, flee | Sight cone + line of sight, hearing, "sniff" hints, predicts exits at mouse holes, rummages through hiding places, jumps visible peels, gets furious after a gag, loses track after breaking line of sight |
| Prey (mouse) | forage, flee, hide, taunt, home + scripted stayHidden / runHome / goto | Prefers mouse-only routes, re-routes around the cat, slams doors, topples objects onto the cat, drops peels, taunts a dizzy cat |
| Guardian (dog) | sleep, patrol/roam, alert, warn, chase, satisfied, return, zoomies | Wakes to crashes or a careless cat, growls before charging, intervenes in chases, friendly to the mouse, random naps and zoomies |

Episodes steer AI through `NpcCommand`s; brains stay generic.

### Cartoon gag system

Gags are ordinary rules with stun kinds and animations: `slip` (peels, puddles), `ouch` (a cat in its
own mousetrap), `splat` (door slams, pounce into a wall, big falls), `dizzy` (rakes, falling
objects), `pummel` (the dog). Each emits an event, so missions, toasts, camera shake and AI rage
react without knowing about each other.

### Episode platform (Part 3)

- **Episode packages** - `src/content/episodes/<id>/index.ts`, auto-discovered; may register their
  own environments (via `deriveEnvironment`), props and items. `_template/` documents the format.
- **Library** - cards show art, cast, difficulty, playtime, lock state and completion %; the detail
  panel adds a floor-plan preview generated from the environment data, per-side best times and
  mission progress, achievements, challenges and collectibles.
- **Progress** (`engine/progress/`) - a versioned localStorage save. `evaluateRun` is pure: it turns a
  finished run into completion, best times, furthest mission (for *Continue*), collectibles,
  episode achievements/challenges, lifetime stats, lifetime character achievements and unlocks.
- **Character library** - `withVariant` applies costume extras (hat / accessory) only; everything
  else always comes from the shared definition.
- **Rendering performance** - walls, trims and wallpaper are baked into per-material batches
  (`staticBatch.ts`); static props are merged at runtime by shared material (`MergedStatic`);
  tiny parts skip the shadow pass; the shadow frustum follows the player; adaptive pixel ratio and
  a low-quality mode (no shadows) for weaker devices.

## Options considered

### A: Data-driven episodes on a shared engine (chosen)
| Dimension | Assessment |
| --- | --- |
| Complexity | Medium - needs a well-defined contract |
| Scalability | High - episodes are data; validation catches mistakes |
| Consistency | High - HUD, camera, controls and style are engine-owned |

### B: Each episode as its own scene component
Pros: total freedom per episode. Cons: copy-pasted controllers and HUD drift apart, the visual
identity fragments, and every episode can break the core loop.

### C: External level editor + serialized JSON only
Pros: designer friendly. Cons: big upfront tooling cost; prop behaviour still needs code. The chosen
format is JSON-compatible data, so an editor can be added later without changing the contract.

## Consequences

- New episodes: one file in `src/content/episodes/` (see ADDING_AN_EPISODE.md).
- New furniture, items or traps: register a type once, every environment can place it.
- New recurring characters: add a `CharacterDefinition`; brains are picked by archetype
  (`hunter`, `prey`, `guardian`).
- New mechanic types (e.g. a new objective kind) do need an engine change - extend the
  `ObjectiveDef` union and `EpisodeRuntime`, with a unit test.
- Revisit: a second environment (multi-storey) will need floors/stairs in the environment schema
  and nav grid layers.
