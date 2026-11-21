# Adding an episode

1. Create `src/content/episodes/epNN-your-title.ts` and `export default` an `EpisodeDefinition`
   (copy `ep02-sunday-picnic.ts` as a starting point). It is discovered automatically.
2. Pick an `environment` (`classic-house`) and a `lighting` preset from that environment
   (`night`, `day`). Add one-off furniture with `extraProps`.
3. Fill in the `cast`. `playable: true` characters get a `sides[characterId]` entry; the other
   playable side becomes AI using `sides[...].opponentAi`. Non-playable cast (e.g. Brick) need `npc`
   options such as `{ mode: 'sleep' | 'patrol', home, leash }`.
4. Write each side's `objectives` and `lose` conditions:
   - `collect` items, `reach` a zone (optionally `after` other objectives), `survive` seconds,
     `count` gameplay events (`catch`, `slipped`, `pummeled`, `knocked`, `hide`, …),
     `avoid` events (bonus goals).
   - `lose`: `count` (e.g. caught 3 times) or `opponentGoal` (AI collected everything and got home).
5. Place `pickups` (item types registered in `src/content/items.tsx`).
6. Script `events`: triggers (`time`, `event`, `objective`) run actions (`toast`, `wake`, `music`,
   `shake`, `door`, `grant`, `sound`). Limit to a side with `sides: ['pip']`.
7. Set `audio.music` (tempo, root note, scale, motif) and optional `audio.sounds` file overrides.
8. Write `ending.win` / `ending.lose` cards for every playable character.
9. Run `npm test` - `tests/unit/episodes.test.ts` validates every episode: references, spawn points
   inside free space, and that every pickup is reachable on the navigation grid for the characters
   who collect it. In `npm run dev`, the same validation prints warnings in the console.

No engine, HUD, camera or controller changes are needed for any of the above.

## Mission sequences (stages)

For a story episode, give each side a `stages` array instead of flat objectives (see
`ep01-midnight-snack.ts`). Each stage has:

- `title`, `brief` - shown on the mission banner and HUD tracker.
- `objectives` - only events that happen *after the stage starts* count toward them. Besides
  `collect` / `reach` / `count` / `avoid`, stages can use live `metric` objectives:
  `unseen` (seconds since an AI hunter last saw the player), `hiddenSeconds` (continuous time
  hidden) and `seesOpponent` (the player has eyes on the opponent).
- `onStart` actions - the episode's director: `npc` commands (`sleep`, `wake`, `alert`, `hunt`,
  `hideIn`, `runTo`, `goto`, `enrage`, `mode`), `teleport`, `cutscene` shots, `noise`,
  `showPickups` (reveal a pickup `group`), `door`, `music`, `toast`, `shake`, `grant`.
- `checkpoint` / `opponentRespawn` - where characters reappear after a catch in this stage.
- `timeLimit` + `timeoutReason`, and stage-only `lose` rules (e.g. the AI reaching a zone).

The side's flat `objectives` become bonus goals. `intro.shots` plays an opening cutscene.
`hazards` places persistent environmental traps (`puddle`, `rake`); `extraProps` can add
breakable obstacles (`barricade`) and climbing aids (`bookStack`).
