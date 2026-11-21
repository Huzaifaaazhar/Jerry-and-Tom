import type { Page } from '@playwright/test';

/** Seed a save where Episode One is complete so later episodes are unlocked. */
export async function unlockAll(page: Page) {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'squeak-pounce-save-v1',
      JSON.stringify({
        version: 1,
        episodes: { 'ep01-midnight-snack': { sides: { pip: { plays: 1, wins: 1, losses: 0, completed: true, bestTime: 400, furthestStage: 5 } }, collectibles: [], achievements: [], challenges: [] } },
        stats: {},
        achievements: [],
        lastPlayed: null,
      }),
    ),
  );
}

export async function startEpisode(page: Page, episodeTitle: string, character: string, opts: { keepSave?: boolean } = {}) {
  if (!opts.keepSave && episodeTitle !== 'Midnight Snack') await unlockAll(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  // Clicking an unlocked episode card opens its character / mode selection.
  await page.getByRole('button', { name: new RegExp(`: ${episodeTitle}`) }).first().click();
  await page.getByRole('radio', { name: new RegExp(character) }).click();
  await page.getByRole('button', { name: new RegExp(`Play as ${character}`) }).click();
  await page.waitForFunction(() => (window as any).__GAME__?.world?.player?.grounded === true, null, { timeout: 90_000 });
  // Skip the intro cutscene if there is one.
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !(window as any).__GAME__.world.cutscene, null, { timeout: 90_000 });
}

export const stageIndex = (page: Page) => page.evaluate(() => (window as any).__GAME__.useGame.getState().hud.stage?.index ?? -1);

export async function waitStage(page: Page, index: number) {
  await page.waitForFunction(
    (i) => {
      const g = (window as any).__GAME__;
      return (g.useGame.getState().hud.stage?.index ?? -1) >= i || g.useGame.getState().screen === 'results';
    },
    index,
    { timeout: 120_000 },
  );
  await page.waitForFunction(() => !(window as any).__GAME__.world.cutscene, null, { timeout: 90_000 });
}

/** Put the player next to the AI mouse and press grab until it counts. */
export async function grabMouse(page: Page) {
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      const pip = g.world.agents.get('pip');
      const p = g.world.player;
      p.body.setTranslation({ x: pip.position.x + 0.5, y: pip.position.y + 0.6, z: pip.position.z }, true);
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    });
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(250);
    if (await page.evaluate(() => (window as any).__GAME__.world.agents.get('pip').status.respawnAt !== null)) return true;
  }
  return false;
}

export const player = (page: Page) =>
  page.evaluate(() => {
    const g = (window as any).__GAME__;
    const p = g.world.player;
    return {
      id: p.id as string,
      x: p.position.x as number,
      y: p.position.y as number,
      z: p.position.z as number,
      grounded: p.grounded as boolean,
      hidden: p.status.hiddenIn as string | null,
      anim: p.anim.state as string,
      time: g.world.time as number,
      prompt: g.useGame.getState().hud.prompt as string | null,
    };
  });

export const teleport = (page: Page, x: number, z: number, y = 0.6) =>
  page.evaluate(
    ([x, y, z]) => {
      const p = (window as any).__GAME__.world.player;
      p.body.setTranslation({ x, y, z }, true);
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    },
    [x, y, z],
  );

/** Wait until simulated (not wall-clock) time advances - software WebGL runs slowly. */
export async function simWait(page: Page, seconds: number) {
  const t0 = (await player(page)).time;
  await page.waitForFunction((t) => (window as any).__GAME__.world.time > t, t0 + seconds, { timeout: 120_000 });
}
