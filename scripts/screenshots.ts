/**
 * Launches the real application in Chromium, plays through the UI, and captures
 * the screenshots that ship with the repository.
 *
 * Usage: npm run screenshots  (dev server on BASE_URL, default 5174)
 */
import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { createGame, endTurn } from '../src/engine/game';
import { serializeGame, SAVE_KEY } from '../src/engine/save';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5174';
const OUT = 'screenshots';

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`captured ${name}`);
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await shot(page, '01-main-menu');

  await page.getByRole('button', { name: /Start new game/ }).click();
  await page.waitForTimeout(1300);
  await shot(page, '02-new-game');
  await shot(page, '03-tile-selected');

  const canvas = page.locator('canvas.game-canvas');
  const box = await canvas.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const offsets: Array<[number, number]> = [
      [-46, -23],
      [-46, 23],
      [46, 23],
      [0, 46],
    ];
    for (const [ox, oy] of offsets) {
      await page.mouse.click(cx + ox, cy + oy);
      await page.waitForTimeout(350);
      const enabled = page.locator('.right-panel .panel-body button.btn.small:not([disabled])');
      if ((await enabled.count()) > 0) {
        await enabled.first().click();
        await page.waitForTimeout(350);
        await shot(page, '04-build-placement');
        await page.mouse.click(cx + ox, cy + oy);
        await page.waitForTimeout(750);
        break;
      }
    }
    await page.mouse.click(cx, cy);
    await page.keyboard.press('1');
    await page.waitForTimeout(500);
    await shot(page, '05-power-overlay');
    await page.keyboard.press('0');
  }

  await page.keyboard.press('t');
  await page.waitForTimeout(500);
  await shot(page, '06-tech-tree');
  await page.keyboard.press('Escape');

  await page.keyboard.press('Space');
  await page.waitForTimeout(950);
  await shot(page, '07-turn-summary');
  const cont = page.getByRole('button', { name: /^Continue$/ });
  if (await cont.count()) await cont.click();
  await page.waitForTimeout(500);
  await shot(page, '08-second-turn');

  // Play a handful of turns to show a developing empire.
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(900);
    const next = page.getByRole('button', { name: /^Continue$/ });
    if (await next.count()) await next.click();
    await page.waitForTimeout(450);
  }
  await page.mouse.click(10, 300);
  await page.keyboard.press('1');
  await page.waitForTimeout(500);
  await shot(page, '09-midgame-power');
  await page.keyboard.press('0');

  await page.keyboard.press('l');
  await page.waitForTimeout(500);
  await shot(page, '10-event-log');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await shot(page, '11-pause-menu');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Late-game view: run a full AI-controlled match headlessly, then resume that
  // save in the real UI so the screenshot shows a developed infrastructure map.
  const late = createGame({ seed: 2026, allAI: true });
  for (let i = 0; i < 26 && late.phase === 'playing'; i++) endTurn(late);
  const lateSave = serializeGame(late);
  const latePage = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  latePage.on('pageerror', (error) => errors.push(`late pageerror: ${error.message}`));
  await latePage.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SAVE_KEY, lateSave] as const,
  );
  await latePage.goto(BASE, { waitUntil: 'networkidle' });
  await latePage.waitForTimeout(600);
  await latePage.getByRole('button', { name: /Continue campaign/ }).click();
  await latePage.waitForTimeout(1400);
  await shot(latePage, '12-late-game');
  await latePage.keyboard.press('1');
  await latePage.waitForTimeout(500);
  await shot(latePage, '13-late-game-power');
  await latePage.keyboard.press('t');
  await latePage.waitForTimeout(500);
  await shot(latePage, '14-late-game-tech');
  await latePage.keyboard.press('Escape');
  await latePage.waitForTimeout(300);
  await latePage.setViewportSize({ width: 1280, height: 800 });
  await latePage.waitForTimeout(600);
  await shot(latePage, '15-laptop-layout');

  await browser.close();
  if (errors.length > 0) {
    console.error('Browser errors:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('No browser errors.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
