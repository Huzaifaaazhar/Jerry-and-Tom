import { test, expect } from '@playwright/test';
import { player, simWait, startEpisode, teleport, waitStage } from './helpers';

test.describe('episode library, progression and save/load', () => {
  test('a fresh save shows Episode Two locked with a clear reason', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: /Episode 2: Sunday Picnic\. Locked/ })).toBeVisible();
    await page.getByRole('button', { name: /Episode 2: Sunday Picnic/ }).click();
    await expect(page.getByText('Finish Midnight Snack to unlock this episode.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Locked', exact: true })).toBeDisabled();
    await expect(page.getByText('0 of 2 episodes completed')).toBeVisible();
  });

  test('finishing Episode One saves progress, unlocks Episode Two and survives a reload', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await startEpisode(page, 'Midnight Snack', 'Pip', { keepSave: true });
    await page.evaluate(() => ((window as any).__GAME__.world.player.status.invulnerableUntil = 1e9));
    // Pick up a golden thimble on the way.
    await teleport(page, -17.3, -15.0, 0.5);
    await expect.poll(() => page.evaluate(() => (window as any).__GAME__.useItems.getState().pickups.find((p: any) => p.id === 'thimble-blue-corner').collected)).toBe(true);
    // Jump to the final mission and run home.
    await page.evaluate(() => (window as any).__GAME__.runtime.skipToStage(5));
    await page.waitForFunction(() => !(window as any).__GAME__.world.cutscene);
    await teleport(page, -16.4, 10.5, 0.5);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('You win', { timeout: 120_000 });
    await expect(dialog).toContainText('Episode unlocked: Sunday Picnic');
    await expect(dialog).toContainText('Achievement: Midnight muncher');

    await page.reload();
    await expect(page.getByRole('button', { name: /Continue: Midnight Snack as Pip/ })).toBeVisible();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByText('1 of 2 episodes completed')).toBeVisible();
    await expect(page.getByRole('button', { name: /Episode 2: Sunday Picnic\. Unlocked/ })).toBeVisible();
    await page.getByRole('button', { name: /Episode 1: Midnight Snack/ }).hover();
    await expect(page.getByText('Golden thimbles 1/5')).toBeVisible();
    // Scrapbook shows lifetime stats.
    await page.getByRole('button', { name: 'Scrapbook' }).click();
    await expect(page.locator('.scrap-card').first()).toContainText('Episodes won');
  });

  test('continue from a later mission starts at its checkpoint', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem(
        'squeak-pounce-save-v1',
        JSON.stringify({ version: 1, episodes: { 'ep01-midnight-snack': { sides: { barnaby: { plays: 1, wins: 0, losses: 1, completed: false, bestTime: null, furthestStage: 3 } }, collectibles: [], achievements: [], challenges: [] } }, stats: {}, achievements: [], lastPlayed: { episodeId: 'ep01-midnight-snack', characterId: 'barnaby' } }),
      ),
    );
    await page.reload();
    await page.getByRole('button', { name: /Continue: Midnight Snack as Barnaby/ }).click();
    await page.getByLabel('Start from').selectOption({ label: 'Mission 4: Barricade' });
    await page.getByRole('button', { name: /Continue as Barnaby/ }).click();
    await page.waitForFunction(() => (window as any).__GAME__?.world?.player?.grounded === true);
    await page.keyboard.press('Space');
    await waitStage(page, 3);
    const hud = await page.evaluate(() => (window as any).__GAME__.useGame.getState().hud.stage);
    expect(hud.title).toBe('Barricade');
    const p = await player(page);
    expect(Math.hypot(p.x - 0, p.z - 1)).toBeLessThan(2.5);
  });

  test('collected thimbles stay collected in later runs', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem(
        'squeak-pounce-save-v1',
        JSON.stringify({ version: 1, episodes: { 'ep01-midnight-snack': { sides: {}, collectibles: ['thimble-garden', 'thimble-hall-end'], achievements: [], challenges: [] } }, stats: {}, achievements: [], lastPlayed: null }),
      ),
    );
    await startEpisode(page, 'Midnight Snack', 'Barnaby', { keepSave: true });
    const ids: string[] = await page.evaluate(() => (window as any).__GAME__.useItems.getState().pickups.filter((p: any) => p.collectible).map((p: any) => p.id));
    expect(ids.sort()).toEqual(['thimble-blue-corner', 'thimble-kitchen-table', 'thimble-rose-corner']);
  });

  test('renders with batched geometry (draw-call budget) and no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await startEpisode(page, 'Midnight Snack', 'Pip');
    await simWait(page, 1);
    const calls = await page.evaluate(() => (window as any).__GAME__.renderer.info.render.calls);
    expect(calls).toBeLessThan(500);
    expect(errors).toEqual([]);
  });
});

