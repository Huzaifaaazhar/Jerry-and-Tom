# Testing strategy

| Layer | Tool | What it covers |
| --- | --- | --- |
| Unit | Vitest (`npm test`) | Wall splitting & room faces, nav grid (mouse holes fit mice, not cats), A* + smoothing, mission runtime (objectives, lose conditions, timer, chase events), input mapping, **episode validation** for every registered episode |
| Unit (stages) | Vitest | Stage order, stage-local counting, stage timers and zone-filtered lose rules, metric objectives, reach-while-standing, bonus goals |
| Browser gameplay | Playwright (`npm run e2e`) | Menus → match, keyboard movement + jump, wall collisions, hiding, doors, catching, winning, switching characters, pause/restart |
| Episode One | Playwright (`tests/e2e/episode-one.spec.ts`) | All six missions completable in **both** modes; cat AI wakes to a crash and investigates; cat AI detects and catches an exposed mouse; mouse AI flees/hides; door-slam and mousetrap-backfire gags |

Notes

- E2E uses software WebGL (SwiftShader), so the simulation runs slower than real time. Tests poll
  the simulation clock via `window.__GAME__` (`simWait`) instead of sleeping on wall-clock time.
- `window.__GAME__` exposes the world, interaction registry, item store, game store and camera
  state for tests and debugging.
- Every new episode is validated automatically; add a runtime unit test for any new objective or
  trigger type.

Gaps to close in Part 2: visual regression snapshots of menus/HUD, AI soak tests with fixed seeds in
a headless physics world, touch-control interaction tests on a mobile viewport.
