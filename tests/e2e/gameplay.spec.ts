import { test, expect } from '@playwright/test';
import { grabMouse, player, simWait, startEpisode, teleport, waitStage } from './helpers';

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
    await startEpisode(page, 'Midnight Snack', 'Barnaby');
    await page.evaluate(() => (window as any).__GAME__.runtime.skipToStage(2));
    await page.evaluate(() => (window as any).__GAME__.npcCommand('pip', { type: 'mode', mode: 'forage' }));
    await simWait(page, 1);
    expect(await grabMouse(page)).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as any).__GAME__.useGame.getState().hud.stage.index)).toBe(3);
  });

  test('Episode Two can be completed as the cat', async ({ page }) => {
    await startEpisode(page, 'Sunday Picnic', 'Barnaby');
    await teleport(page, 2.5, 25, 1.2);
    await waitStage(page, 1);
    await page.evaluate(() => {
      const G = (window as any).__GAME__;
      const pip = G.world.agents.get('pip');
      G.world.player.body.setTranslation({ x: pip.position.x, y: 1.2, z: pip.position.z - 3 }, true);
      G.world.player.facing = 0;
    });
    await waitStage(page, 2);
    expect(await grabMouse(page)).toBe(true);
    await waitStage(page, 3);
    expect(await grabMouse(page)).toBe(true);
    await expect(page.getByRole('dialog')).toContainText('You win', { timeout: 120_000 });
  });

  test('switching characters swaps the controlled agent', async ({ page }) => {
    await startEpisode(page, 'Sunday Picnic', 'Barnaby');
    expect((await player(page)).id).toBe('barnaby');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Quit to episodes' }).click();
    await page.getByRole('button', { name: /^(Play|Replay) episode$/ }).click();
    await page.getByRole('radio', { name: /Pip/ }).click();
    await page.getByRole('button', { name: /Play as Pip/ }).click();
    await page.waitForFunction(() => (window as any).__GAME__?.world?.player?.id === 'pip' && (window as any).__GAME__.world.player.grounded);
  });
});
