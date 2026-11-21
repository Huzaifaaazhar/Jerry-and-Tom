# Adding a new episode

Episodes are **content packages**. Adding one never requires changes to `src/engine/`: the engine
loads every package it finds, validates it, lists it in the episode library and runs it with the
shared characters, camera, controls, HUD, physics, AI and progression.

## 1. Folder structure

```
src/content/
  characters/          shared character library (Pip, Barnaby, Brick) - reuse, don't copy
  props/               shared furniture / garden / appliance / trap-object library
  items.tsx            shared items (cheese, sandwich, crumb, big cheese, golden thimble) and traps
  environments/        shared environments (classicHouse.ts)
  achievements.ts      lifetime character achievements
  episodes/
    _template/         copy this to start (ignored by the loader because of the "_")
      index.ts         the EpisodeDefinition (default export)
      environment.ts   optional episode-specific environment
    ep01-midnight-snack/
      index.ts
    ep02-sunday-picnic/
      index.ts
      environment.ts   derives the picnic-day yard from the shared house
```

The loader (`src/content/index.ts`) imports `src/content/episodes/*/index.ts`, skipping folders
whose name starts with `_`. That import **is** the registration: there is no list to edit.

## 2. Step by step

1. **Copy the template**: `cp -r src/content/episodes/_template src/content/episodes/ep03-your-title`.
   Set `id` to the folder name and give it the next `number`.
2. **Environment assets**
   - Reuse a shared environment (`environment: 'classic-house'`), or
   - Derive one in `environment.ts` with `deriveEnvironment(base, { id, addProps, removeProps,
     moveProps, addZones, addPatrolPoints, lighting })` and call `registerEnvironment(...)` at the
     top of `index.ts`. The base environment is never modified.
   - A brand-new layout is an `EnvironmentDefinition` (rooms, walls with `openings` for doors,
     arches, windows and mouse holes, props, zones, patrol points, lighting presets). Walls,
     wallpaper, floors, colliders, navigation and the library's map preview are all generated
     from that data.
   - New furniture: add a prop type (see "Asset requirements" below) - either in the shared library
     (`src/content/props/`) if other episodes may reuse it, or inside your episode folder.
3. **Episode configuration** - fill in `index.ts` (format below).
4. **Missions and events** - write `sides[characterId].stages` for each playable character, plus
   global `events`.
5. **Register** - nothing to do; saving the folder registers it.
6. **Test** - `npm test` (validation + reachability), then `npm run dev` and open the
   **Episode library**. Use `unlock: { after: [] }` (or omit `unlock`) while developing so the
   episode is not locked, then set the real unlock rule.

## 3. Configuration format (`EpisodeDefinition`)

| Field | Purpose |
| --- | --- |
| `id`, `number`, `title`, `tagline`, `description` | Identity and library text. |
| `thumbnail` | Procedural title-card art (`motif`, `sky`, `ground`) or `image: '/episodes/ep03.png'`. |
| `difficulty` (1-3), `estimatedMinutes` | Shown on the library card. |
| `unlock.after` | Episode ids that must be completed (as either side) first. |
| `environment`, `lighting` | Environment id and one of its lighting presets. |
| `extraProps` | Additional prop placements for this episode only (obstacles, climbing aids). |
| `hazards` | Persistent environmental traps: `{ kind: 'puddle' \| 'rake', position }`. |
| `cast[]` | `characterId`, `playable`, `spawn`, `respawn`, `npc` (AI options), `variant` (costume). |
| `intro.shots` | Opening cutscene: `{ target \| focus, from?, duration, caption }`. |
| `sides[characterId]` | Per playable character: `brief`, `modeSummary`, `timeLimit`, `charges`, `opponentAi`, `stages`, bonus `objectives`, `lose`. |
| `pickups[]` | Mission items; give them a `group` to keep them hidden until a stage reveals them. |
| `collectibles[]`, `collectibleType` | Hidden collectibles saved per player (default golden thimbles). |
| `events[]` | Scripted triggers (`time`, `event`, `objective`) → actions. |
| `achievements[]`, `challenges[]` | `{ id, title, description, side?, condition }` evaluated after each run. |
| `audio` | `music` theme (tempo, root, scale, motif), `ambience` (`night` / `day`), `sounds` file overrides. |
| `ending.win` / `ending.lose` | Ending card per playable character. |

### Stages (missions)

```ts
{
  id: 'barricade',
  title: 'Barricade',                       // mission banner + HUD
  brief: 'Smash through it (E, three times).',
  checkpoint: { position: [0, 0, 1] },      // player respawn / "continue from here" point
  opponentRespawn: { position: [-12, 0, -9] },
  timeLimit: 75, timeoutReason: '…',        // optional stage timer
  onStart: [ /* actions when the stage begins */ ],
  onResume: [ /* extra actions when a run *starts* here via Continue */ ],
  lose: [ /* stage-only lose rules */ ],
  objectives: [ { id: 'smash', label: 'Smash the barricade', type: 'count', event: 'broken', who: 'player', count: 1 } ],
}
```

Objective types: `collect`, `reach` (zone, optional `after`), `survive`, `count` (gameplay event),
`avoid` (bonus), `metric` (`unseen`, `hiddenSeconds`, `seesOpponent`). Counted events include
`catch`, `caught`, `pickup`, `hide`, `found`, `slipped`, `splat`, `bonked`, `pummeled`, `trapped`,
`broken`, `slam`, `nearMiss`, `taunt`, `knocked`, `enterZone`, `enterRoom`. `who` is `player`,
`opponent`, `any` or `npc:<characterId>`.

Actions: `toast`, `cutscene`, `npc` (`sleep`, `wake`, `alert`, `hunt`, `hideIn`, `runTo`, `goto`,
`enrage`, `mode`), `teleport`, `noise`, `showPickups`, `door`, `music`, `shake`, `grant`, `sound`.

Lose rules: `count` (optionally filtered by `zoneId`) and `opponentGoal`.

### AI configuration

`opponentAi` (per side) and `cast[].npc` accept `NpcOptions`: `mode` (`sleep`, `patrol`, `roam`,
`hunt`, `forage`, `stayHidden`, `runHome`, `idle`), `home`, `leash`, `skill` (0-1), `collects`,
`homeZone`, `grace`. Brains are chosen by character archetype (hunter / prey / guardian).

## 4. Asset requirements

**Characters** - always reuse `src/content/characters/`. Episodes may only add a costume through
`cast[].variant` (`hat`: nightcap / sunHat / chefHat / partyHat, or a different `accessory`); the
validator rejects anything else, so proportions, colours, rig, faces and movement stay identical in
every episode. Artist GLBs replace characters globally via `public/models/manifest.json` (see
ASSET_PIPELINE.md).

**Props** - register with `registerProp({ id, label, Render, colliders, hideSpot?, knockable?,
breakable?, pushable? })`:

- Model in local space: origin at floor level, front facing +Z, metres-ish units (a door is 2.8 tall).
- Build `Render` from the shared parts (`Box`, `Cyl`, `Ball`, `Cone`, `Torus`, `Legs`) and the shared
  toon materials so the look and batching stay consistent; or load a GLB with `useGLTF`.
- `colliders` are boxes in local space; they drive physics **and** AI navigation.
- Affordances: `hideSpot` (offset, exit, archetypes, `searchable`), `knockable` (falls, crashes,
  bonks), `breakable` (hits, debris), `pushable` (mass).

**Items / traps** - `registerItem` / `registerTrap` in `items.tsx` or in your episode folder.

**Audio** - procedural by default; map any sound id to a file with `audio.sounds`.

## 5. Testing process

1. `npm test` - `tests/unit/episodes.test.ts` runs `validateEpisode` on every episode: unknown
   characters / props / items / zones, missing sides, stage wiring, duplicate ids, library metadata,
   unlock references, achievement sides, costume rules, spawn points inside obstacles, and that every
   pickup and collectible is **reachable** on the navigation grid.
2. `npm run dev` - console warnings starting with `[episode]` repeat the validation live.
3. Play both sides from the library. In the browser console, `__GAME__.runtime.skipToStage(n)` jumps to
   a mission and `__GAME__.npcCommand('barnaby', { type: 'hunt' })` drives the AI.
4. Add a Playwright spec in `tests/e2e/` modelled on `episode-one.spec.ts` (complete every mission in
   both modes). Run with `npm run e2e`.
