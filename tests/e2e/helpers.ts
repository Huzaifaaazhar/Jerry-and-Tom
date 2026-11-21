import type { Page } from '@playwright/test';

export async function startEpisode(page: Page, episodeTitle: string, character: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(episodeTitle) }).first().hover();
  await page.getByRole('button', { name: 'Choose a side' }).click();
  await page.getByRole('radio', { name: new RegExp(character) }).click();
  await page.getByRole('button', { name: new RegExp(`Play as ${character}`) }).click();
  await page.waitForFunction(() => (window as any).__GAME__?.world?.player?.grounded === true, null, { timeout: 90_000 });
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
