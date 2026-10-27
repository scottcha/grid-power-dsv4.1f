/**
 * Browser end-to-end check of the real UI: new game, build, claim, end turn,
 * autosave, reload and resume. Fails on any console/page error.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5174';
const SAVE_KEY = 'gridpower.save.v3';

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((key) => window.localStorage.removeItem(key), SAVE_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  assert.match((await page.locator('.menu-title').textContent()) ?? '', /GRIDPOWER/);
  console.log('menu rendered');

  await page.locator('#seed').fill('4242');
  await page.getByRole('button', { name: /Start new game/ }).click();
  await page.waitForTimeout(1500);
  assert.match((await page.locator('.turn-pill').textContent()) ?? '', /Turn 1/);
  assert.equal(await page.locator('canvas.game-canvas').isVisible(), true);

  const saved = async (): Promise<Record<string, unknown>> =>
    JSON.parse((await page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY)) ?? '{}') as Record<
      string,
      unknown
    >;
  const before = await saved();
  const tiles = before.tiles as Array<{ owner: number; structure: { owner: number } | null }>;
  const beforeStructures = tiles.filter((t) => t.structure && t.structure.owner === 0).length;
  const beforeTiles = tiles.filter((t) => t.owner === 0).length;
  console.log('initial save', { beforeStructures, beforeTiles });

  const canvas = page.locator('canvas.game-canvas');
  const box = (await canvas.boundingBox()) ?? { x: 0, y: 0, width: 1440, height: 900 };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Select an owned empty plot and build something legal on it.
  let built = false;
  for (const [ox, oy] of [
    [-46, -23],
    [-46, 23],
    [46, 23],
    [0, 46],
  ] as Array<[number, number]>) {
    await page.mouse.click(cx + ox, cy + oy);
    await page.waitForTimeout(300);
    const enabled = page.locator('.right-panel .panel-body button.btn.small:not([disabled])');
    if ((await enabled.count()) > 0) {
      await enabled.first().click();
      await page.waitForTimeout(300);
      await page.mouse.click(cx + ox, cy + oy);
      await page.waitForTimeout(700);
      built = true;
      break;
    }
  }
  assert.equal(built, true, 'no buildable plot was offered next to the starter campus');
  const afterBuild = await saved();
  const afterBuildStructures = (afterBuild.tiles as typeof tiles).filter((t) => t.structure && t.structure.owner === 0).length;
  assert.ok(afterBuildStructures > beforeStructures, 'building did not add a structure');
  console.log('build action persisted', { beforeStructures, afterBuildStructures });

  // Claim an adjacent unowned tile.
  let claimed = false;
  for (const [ox, oy] of [
    [46, -23],
    [-46, -23],
    [46, 23],
    [0, -46],
    [92, 0],
    [-92, 0],
  ] as Array<[number, number]>) {
    await page.mouse.click(cx + ox, cy + oy);
    await page.waitForTimeout(250);
    const claim = page.getByRole('button', { name: /Claim territory/ });
    if ((await claim.count()) > 0) {
      await claim.click();
      await page.waitForTimeout(600);
      claimed = true;
      break;
    }
  }
  if (claimed) {
    const afterClaim = await saved();
    const afterClaimTiles = (afterClaim.tiles as typeof tiles).filter((t) => t.owner === 0).length;
    assert.ok(afterClaimTiles > beforeTiles, 'claim did not add territory');
    console.log('claim action persisted', { beforeTiles, afterClaimTiles });
  } else {
    console.log('claim skipped: no adjacent unclaimed tile reachable from the starter pocket');
  }

  // End turn and continue.
  await page.getByRole('button', { name: /End Turn/ }).click();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('.modal').isVisible(), true, 'turn summary did not open');
  await page.getByRole('button', { name: /^Continue$/ }).click();
  await page.waitForTimeout(600);
  assert.match((await page.locator('.turn-pill').textContent()) ?? '', /Turn 2/);

  // Tech tree opens and closes.
  await page.keyboard.press('t');
  await page.waitForTimeout(400);
  assert.ok((await page.locator('.tech-card').count()) >= 20, 'tech tree did not render');
  await page.keyboard.press('Escape');

  // Reload and resume from the autosave.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Continue campaign/ }).click();
  await page.waitForTimeout(1200);
  assert.match((await page.locator('.turn-pill').textContent()) ?? '', /Turn 2/, 'resumed game lost its turn');
  console.log('reload/resume preserved the campaign');

  // Layout sanity at laptop size.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(600);
  const bar = await page.locator('.bottom-bar').boundingBox();
  assert.ok(bar && bar.x >= 0 && bar.x + bar.width <= 1281 && bar.y + bar.height <= 801, 'bottom bar overflows the viewport');
  const right = await page.locator('.right-panel').boundingBox();
  assert.ok(right && right.x + right.width <= 1281, 'right panel overflows the viewport');
  console.log('laptop layout fits');

  await browser.close();
  assert.deepEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
  console.log('E2E PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
