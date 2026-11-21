import { test, expect } from '@playwright/test';
import { player, simWait, startEpisode, teleport } from './helpers';

test.describe('core gameplay', () => {
  test('menus lead into a running match without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await startEpisode(page, 'Midnight Snack', 'Pip');
    await expect(page.getByRole('timer')).toBeVisible();
    await expect(page.getByText('Grab the crumb on the piano keys')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('player walks, sprints and jumps with keyboard input', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Pip');
    const a = await player(page);
    await page.keyboard.down('KeyW');
    await simWait(page, 0.8);
    await page.keyboard.up('KeyW');
    const b = await player(page);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(1);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => (window as any).__GAME__.world.player.grounded === false);
    await page.waitForFunction(() => (window as any).__GAME__.world.player.grounded === true);
  });

  test('walls and furniture block movement (physics collisions)', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Barnaby');
    // Kitchen east wall is at x = 18 behind the counters: run into it.
    await teleport(page, 15.4, 3.2, 1.2);
    await page.evaluate(() => ((window as any).__GAME__.cameraState.yaw = -Math.PI / 2));
    await page.keyboard.down('KeyW');
    await simWait(page, 1.5);
    await page.keyboard.up('KeyW');
    const p = await player(page);
    expect(p.x).toBeLessThan(16.6);
  });

  test('mouse hides in furniture and comes back out', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Pip');
    await teleport(page, -12.25, 2.75, 0.4); // in front of the sofa
    await expect.poll(async () => (await player(page)).prompt).toContain('Hide');
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await player(page)).hidden).not.toBeNull();
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await player(page)).hidden).toBeNull();
  });

  test('cat opens a closed door with E', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Barnaby');
    await teleport(page, 12, -0.6, 1.2);
    await expect.poll(async () => (await player(page)).prompt).toBe('Open door');
    await page.keyboard.press('KeyE');
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.interactions.doors.get('kitchen-hall-door').open))
      .toBe(true);
  });

  test('cat catches the mouse and the mission counter updates', async ({ page }) => {
    await startEpisode(page, 'Sunday Picnic', 'Barnaby');
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      const pip = g.world.agents.get('pip');
      const p = g.world.player;
      p.body.setTranslation({ x: pip.position.x + 0.55, y: pip.position.y + 0.7, z: pip.position.z }, true);
    });
    await page.keyboard.press('KeyE');
    await expect.poll(() => page.evaluate(() => (window as any).__GAME__.useGame.getState().hud.objectives[0].progress)).toBe(1);
  });

  test('a flat (non-staged) episode can still be won: Sunday Picnic', async ({ page }) => {
    await startEpisode(page, 'Sunday Picnic', 'Pip');
    const items: number[][] = await page.evaluate(() => (window as any).__GAME__.useItems.getState().pickups.map((p: any) => p.position));
    for (const [x, y, z] of items.slice(0, 3)) {
      await teleport(page, x + 0.3, z, Math.max(0.4, y + 0.3));
      await simWait(page, 0.25);
    }
    await teleport(page, -13, 29, 0.4);
    await expect(page.getByRole('dialog')).toContainText('You win', { timeout: 120_000 });
    await expect(page.getByRole('button', { name: 'Switch sides' })).toBeVisible();
  });

  test('switching characters swaps the controlled agent', async ({ page }) => {
    await startEpisode(page, 'Sunday Picnic', 'Barnaby');
    expect((await player(page)).id).toBe('barnaby');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Quit to episodes' }).click();
    await page.getByRole('button', { name: 'Choose a side' }).click();
    await page.getByRole('radio', { name: /Pip/ }).click();
    await page.getByRole('button', { name: /Play as Pip/ }).click();
    await page.waitForFunction(() => (window as any).__GAME__?.world?.player?.id === 'pip' && (window as any).__GAME__.world.player.grounded);
  });
});
