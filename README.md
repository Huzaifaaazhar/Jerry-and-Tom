# Squeak & Pounce

A 3D cartoon cat-and-mouse chase game built with React, TypeScript, Vite, React Three Fiber,
Drei, Rapier and Zustand. Play as **Pip** the mouse (raid the house, hide, slip through mouse
holes, lay banana peels) or **Barnaby** the cat (chase, pounce, search hiding places, set
mousetraps) while **Brick** the bulldog runs on his own AI and has no patience for cats.

The project is split into a reusable **engine** and **episode content**, so new episodes are
content packages, not engine rewrites. Two episodes ship today: **Midnight Snack** (six missions
per side) and **Sunday Picnic** (four missions per side, unlocked by finishing Episode One). Progress,
unlocks, best times, achievements, challenges and golden-thimble collectibles are saved on the device.

```
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run e2e        # browser gameplay tests (Playwright, software WebGL)
npm run build      # production build in dist/
```

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move (camera-relative) |
| Mouse (click to capture) / drag | Orbit camera, wheel to zoom |
| Space | Jump |
| Shift | Sprint (stamina) |
| Ctrl or C | Sneak (silent, harder to spot) |
| E | Interact: doors, hide/search, knock things over, grab |
| Q | Drop trap item (mousetrap / banana peel) |
| F | Ability: pounce (cat) / taunt (mouse) |
| Esc or P | Pause |

Touch (virtual stick, swipe-look, action buttons) and gamepads are supported through the same
input system.

## Project layout

```
src/
  engine/            reusable game engine - never episode-specific
    core/            world state, events, store (zustand), physics layers, math
    input/           keyboard / mouse / touch / gamepad -> one InputState
    audio/           procedural SFX + music sequencer, file override hooks
    environment/     modular environment builder, walls/doors/windows, prop registry
    characters/      character registry, procedural rig, animator, GLB loader
    controller/      shared locomotion, abilities and gameplay rules
    ai/              nav grid + A*, perception, hunter / prey / guardian brains
    interaction/     interaction registry, hiding, items and traps
    camera/          third-person chase camera
    episode/         episode contract, registry, mission runtime, validation
    game/            GameSession: boots an episode into a running match
    style/           the shared palette and toon materials
  content/           everything game-specific
    characters/      Pip, Barnaby, Brick
    props/           furniture & garden asset library
    environments/    the classic house + backyard
    episodes/        one folder per episode package (auto-discovered; _template to copy)
  ui/                menus, HUD, pause, results, touch controls
docs/                architecture, asset pipeline, adding episodes, testing
tests/unit, tests/e2e
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ADDING_AN_EPISODE.md](docs/ADDING_AN_EPISODE.md),
[docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md) and [docs/TESTING.md](docs/TESTING.md).

## About the characters

Pip, Barnaby and Brick are original characters written for this project. Their current look comes
from the engine's procedural cartoon rig (real bone hierarchy, full animation set, expressive
faces). That rig is a stand-in for sculpted, artist-made models: the asset pipeline lets a rigged
GLB replace any character without code changes. Only use models you hold the rights to.
