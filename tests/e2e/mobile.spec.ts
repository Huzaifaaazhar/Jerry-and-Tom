import { test, expect, devices } from '@playwright/test';
import { player, simWait, startEpisode } from './helpers';

const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 13'];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

test.describe('mobile touch controls', () => {
  test('virtual stick moves the player and the jump button jumps', async ({ page }) => {
    await startEpisode(page, 'Midnight Snack', 'Pip');
    await expect(page.locator('.touch-arc')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sneak' })).toBeVisible();
    const a = await player(page);
    const box = (await page.locator('.touch-left').boundingBox())!;
    const sx = box.x + box.width / 2;
    const sy = box.y + box.height / 2;
    const stick = page.locator('.touch-left');
    await stick.dispatchEvent('pointerdown', { pointerId: 7, clientX: sx, clientY: sy, isPrimary: true, pointerType: 'touch' });
    await stick.dispatchEvent('pointermove', { pointerId: 7, clientX: sx, clientY: sy - 60, isPrimary: true, pointerType: 'touch' });
    await simWait(page, 0.8);
    await stick.dispatchEvent('pointerup', { pointerId: 7, clientX: sx, clientY: sy - 60, isPrimary: true, pointerType: 'touch' });
    const b = await player(page);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.8);
    const jump = page.getByRole('button', { name: 'Jump' });
    await jump.dispatchEvent('pointerdown', { pointerId: 8, pointerType: 'touch' });
    await page.waitForFunction(() => (window as any).__GAME__.world.player.grounded === false);
    await jump.dispatchEvent('pointerup', { pointerId: 8, pointerType: 'touch' });
  });
});
