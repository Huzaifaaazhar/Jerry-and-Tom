import { test, expect, type Page } from '@playwright/test';
import { grabMouse, player, simWait, stageIndex, startEpisode, teleport, waitStage } from './helpers';

const g = (page: Page) => page;
const agent = (page: Page, id: string) =>
  page.evaluate((id) => {
    const a = (window as any).__GAME__.world.agents.get(id);
    return { x: a.position.x, z: a.position.z, ai: a.aiState as string, hidden: a.status.hiddenIn as string | null, stun: a.status.stunKind as string | null, stunned: a.status.stunnedUntil > (window as any).__GAME__.world.time };
  }, id);

test.describe('Episode One - mouse mode', () => {
  test('all six missions can be completed in order', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Pip');
    expect(await stageIndex(page)).toBe(0);
    // This test checks mission flow, not survival: the AI cat is tested separately.
    await page.evaluate(() => ((window as any).__GAME__.world.player.status.invulnerableUntil = 1e9));
    // 1. Jump onto the piano keys for the crumb, then reach the dining room.
    await teleport(page, -6.9, 0.6, 1.5);
    await simWait(page, 0.6);
    await teleport(page, 0, 7, 0.5);
    await waitStage(page, 1);
    // 2. First encounter: break line of sight.
    await teleport(page, 3.6, -12.5, 0.5);
    await waitStage(page, 2);
    // 3. Cheese run through several rooms.
    const wedges: number[][] = await page.evaluate(() => (window as any).__GAME__.useItems.getState().pickups.filter((p: any) => p.type === 'cheese').map((p: any) => p.position));
    for (const [x, , z] of wedges.slice(0, 3)) {
      await teleport(page, x + 0.3, z, 0.5);
      await simWait(page, 0.4);
    }
    await waitStage(page, 3);
    // 4. Environmental obstacle: climb books -> box -> dresser.
    await teleport(page, -7.0, -15.25, 0.9);
    await simWait(page, 0.3);
    await teleport(page, -5.9, -15.3, 1.4);
    await simWait(page, 0.3);
    await teleport(page, -3.8, -15.3, 1.9);
    await waitStage(page, 4);
    // 5. Hide (in the rose bedroom toy box, out of Barnaby's sight) and stay hidden.
    await teleport(page, 3.6, -14.45, 0.5);
    await expect.poll(async () => (await player(page)).prompt).toContain('Hide');
    await page.keyboard.press('KeyE');
    await waitStage(page, 5);
    // 6. Final dash home.
    await page.keyboard.press('KeyE');
    await teleport(page, -16.4, 10.5, 0.5);
    await expect(page.getByRole('dialog')).toContainText('You win', { timeout: 120_000 });
    await expect(page.getByRole('dialog')).toContainText('6 / 6');
  });

  test('the cat AI wakes up to a crash and investigates', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Pip');
    expect((await agent(page, 'barnaby')).ai).toBe('sleep');
    await teleport(page, -12.3, 4.6, 0.5); // next to the side table vase
    await expect.poll(async () => (await player(page)).prompt).toBe('Knock over the vase');
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await agent(page, 'barnaby')).ai, { timeout: 60_000 }).not.toBe('sleep');
  });

  test('the cat AI detects and catches an exposed mouse', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Pip');
    await teleport(page, -9.5, 6.5, 0.5); // in plain view of the living room
    await page.evaluate(() => (window as any).__GAME__.npcCommand('barnaby', { type: 'hunt' }));
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.useGame.getState().hud.lives.current), { timeout: 120_000, intervals: [1000] })
      .toBe(2);
  });

  test('slamming a door in the hunter’s face flattens it', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Pip');
    await page.evaluate(() => {
      const G = (window as any).__GAME__;
      const cat = G.world.agents.get('barnaby');
      const door = G.interactions.doors.get('living-door');
      cat.body.setTranslation({ x: door.center.x, y: 1.2, z: door.center.z + 0.8 }, true);
      cat.position.set(door.center.x, 1.2, door.center.z + 0.8);
      cat.velocity.set(0, 0, -5);
      door.slam('pip');
    });
    const cat = await agent(page, 'barnaby');
    expect(cat.stun).toBe('splat');
    expect(cat.stunned).toBe(true);
  });
});

test.describe('Episode One - cat mode', () => {
  test('all six missions can be completed in order', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Barnaby');
    // 1. Patrol: kitchen then dining room.
    await teleport(page, 12, 4.5, 1.2);
    await simWait(page, 0.4);
    await teleport(page, 0, 5, 1.2);
    await waitStage(page, 1);
    // 2. Spot the thief.
    await page.evaluate(() => {
      const G = (window as any).__GAME__;
      const pip = G.world.agents.get('pip');
      G.world.player.body.setTranslation({ x: pip.position.x - 3, y: 1.2, z: pip.position.z }, true);
      G.world.player.facing = Math.PI / 2;
    });
    await waitStage(page, 2);
    // 3. Chase and catch.
    expect(await grabMouse(page)).toBe(true);
    await waitStage(page, 3);
    // 4. Smash the barricade.
    await teleport(page, -4.3, -4, 1.2);
    await expect.poll(async () => (await player(page)).prompt).toContain('Smash');
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('KeyE');
      await simWait(page, 0.2);
    }
    await waitStage(page, 4);
    // 5. Search the hiding place.
    await expect.poll(async () => (await agent(page, 'pip')).hidden, { timeout: 60_000 }).not.toBeNull();
    const spot: number[] = await page.evaluate(() => {
      const G = (window as any).__GAME__;
      const s = G.interactions.hideSpots.get(G.world.agents.get('pip').status.hiddenIn);
      return [s.exit.x, s.exit.z];
    });
    await teleport(page, spot[0], spot[1], 1.2);
    await expect.poll(async () => (await player(page)).prompt).toContain('Search');
    await page.keyboard.press('KeyE');
    await waitStage(page, 5);
    // 6. Final chase.
    expect(await grabMouse(page)).toBe(true);
    await expect(page.getByRole('dialog')).toContainText('You win', { timeout: 120_000 });
  });

  test('the mouse AI flees and hides when the cat closes in', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Barnaby');
    await page.evaluate(() => (window as any).__GAME__.runtime.skipToStage(2));
    await page.evaluate(() => (window as any).__GAME__.npcCommand('pip', { type: 'mode', mode: 'forage' }));
    await simWait(page, 1.5);
    await page.evaluate(() => {
      const G = (window as any).__GAME__;
      const pip = G.world.agents.get('pip');
      G.world.player.body.setTranslation({ x: pip.position.x + 2.2, y: 1.2, z: pip.position.z }, true);
    });
    await expect.poll(async () => (await agent(page, 'pip')).ai, { timeout: 60_000 }).toMatch(/flee|hide/);
  });

  test('a mousetrap backfires on the cat who set it', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Barnaby');
    const before = await player(page);
    await page.keyboard.press('KeyQ');
    const mousetraps = () => page.evaluate(() => (window as any).__GAME__.useItems.getState().traps.filter((t: any) => t.kind === 'mousetrap'));
    await expect.poll(async () => (await mousetraps()).length).toBe(1);
    await simWait(page, 3);
    const trap: number[] = (await mousetraps())[0].position;
    await teleport(page, trap[0], trap[2], 1.0);
    await expect.poll(async () => (await agent(page, 'barnaby')).stun, { timeout: 30_000 }).toBe('ouch');
    expect(before.id).toBe('barnaby');
  });

  test('pausing and restarting resets the episode', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Barnaby');
    await teleport(page, 12, 4.5, 1.2);
    await simWait(page, 0.5);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Restart episode' }).click();
    await page.waitForFunction(() => (window as any).__GAME__?.world?.player?.grounded === true && (window as any).__GAME__.world.time < 30);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !(window as any).__GAME__.world.cutscene);
    expect(await stageIndex(g(page))).toBe(0);
    const obj = await page.evaluate(() => (window as any).__GAME__.useGame.getState().hud.objectives[0]);
    expect(obj.done).toBe(false);
  });
});
