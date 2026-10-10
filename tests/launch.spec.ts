import { expect, test, type Page } from '@playwright/test';
import { APP_VERSION } from '../src/config/version';
import { decodeLam } from '../src/engine/lam';

async function firstStart(page: Page) {
  await page.goto('/'); const news = page.getByRole('dialog', { name: 'What’s New', exact: true });
  await expect(news).toBeVisible(); await expect(news).toContainText(APP_VERSION);
  await news.getByRole('button', { name: 'Continue', exact: true }).click();
  const start = page.getByRole('dialog', { name: 'Luno Animate — Start' }); await expect(start).toBeVisible(); return start;
}
async function ink(page: Page, offset = 0) {
  const r = await page.getByTestId('stage').boundingBox(); if (!r) throw new Error('Missing drawing stage');
  await page.mouse.move(r.x + r.width * .25 + offset, r.y + r.height * .3); await page.mouse.down();
  await page.mouse.move(r.x + r.width * .55 + offset, r.y + r.height * .6, { steps: 8 }); await page.mouse.up();
}

test('shows one version-aware news popup, then a focused start window; both trap focus', async ({ page }) => {
  await page.goto('/'); const news = page.getByRole('dialog', { name: 'What’s New', exact: true });
  await expect(news).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(1); await expect(news).toContainText(APP_VERSION);
  for (let n = 0; n < 8; n++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true); }
  await page.keyboard.press('Escape'); const start = page.getByRole('dialog', { name: 'Luno Animate — Start' }); await expect(start).toBeVisible();
  await expect(start.getByRole('button', { name: 'Hand-drawn', exact: false })).toBeVisible(); await expect(start.getByRole('button', { name: 'Rig / motion', exact: false })).toBeVisible();
  for (let n = 0; n < 10; n++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await page.reload();
  await expect(start).toBeVisible(); await expect(news).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('luno.launch.v1')!).seenVersion)).toBe(APP_VERSION);
});

test('start preference survives restart and both windows can be reopened from Help', async ({ page }) => {
  const start = await firstStart(page); await start.getByLabel('Show this window at startup').uncheck(); await start.getByRole('button', { name: 'All projects', exact: true }).click();
  await page.reload(); await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeEnabled(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'New project', exact: true }).click(); await page.getByRole('button', { name: 'Create project', exact: true }).click(); await expect(page.getByTestId('stage')).toBeVisible();
  await page.getByRole('menuitem', { name: 'Help', exact: true }).click(); await page.getByRole('menuitem', { name: 'What’s New…', exact: true }).click();
  await page.getByRole('dialog', { name: 'What’s New', exact: true }).getByRole('button', { name: 'Continue', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByTestId('stage')).toBeVisible();
  await page.getByRole('menuitem', { name: 'Help', exact: true }).click(); await page.getByRole('menuitem', { name: 'Start window…', exact: true }).click(); await expect(start).toBeVisible();
  await expect(start.getByRole('button', { name: 'Open recent Untitled-1', exact: true })).toBeVisible(); await expect(start.getByLabel('Show this window at startup')).not.toBeChecked();
});

test('upgrading from an acknowledged older version shows the current changes once', async ({ page }) => {
  await page.addInitScript(version => { if (!localStorage.getItem('luno.launch.v1')) localStorage.setItem('luno.launch.v1', JSON.stringify({ showStart: false, seenVersion: version })); }, '0.3.4');
  await page.goto('/'); const news = page.getByRole('dialog', { name: 'What’s New', exact: true }); await expect(news).toContainText('Save to the file you opened'); await expect(news).toContainText(APP_VERSION);
  await news.getByRole('button', { name: 'Continue', exact: true }).click(); await page.reload(); await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeEnabled(); await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('hand-drawn creation, blank/duplicate frames, real playback, LAM export and recent reopening', async ({ page }) => {
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; });
  const start = await firstStart(page); await start.getByRole('button', { name: 'Hand-drawn', exact: false }).click();
  const create = page.getByRole('dialog', { name: 'Create a new project' }); await expect(create.getByRole('button', { name: 'Hand-drawn', exact: false })).toHaveAttribute('aria-pressed', 'true'); await expect(create.getByLabel('New document template')).toBeDisabled();
  await create.getByLabel('Project name').fill('Ink studies'); await create.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByTestId('stage')).toBeVisible(); await expect(page.getByLabel('Drawing mode')).toHaveValue('cel'); await expect(page.getByLabel('Workspace', { exact: true })).toHaveValue('Drawing'); await expect(page.getByRole('button', { name: 'Automatic keyframes' })).toHaveCount(0);
  const paths = page.getByTestId('stage').locator('.art-item path'); await ink(page); await expect(paths).toHaveCount(1);
  await page.getByRole('button', { name: 'Next blank frame from Properties', exact: true }).click(); await expect(page.getByRole('slider', { name: 'Timeline playhead' })).toHaveAttribute('aria-valuenow', '2'); await expect(paths).toHaveCount(0); await expect(page.getByTestId('onion-ghost')).toHaveCount(1);
  await ink(page, 20); await expect(paths).toHaveCount(1); await page.keyboard.press('F6'); await expect(page.getByRole('slider', { name: 'Timeline playhead' })).toHaveAttribute('aria-valuenow', '3'); await expect(paths).toHaveCount(1);
  await expect(page.locator('.timeline-cel')).toHaveCount(3); await expect(page.locator('.document-animation-mode')).toHaveText('DRAW');
  await page.getByRole('button', { name: 'Play animation', exact: true }).click();
  const frames = await page.evaluate(() => new Promise<string[]>(resolve => {
    const stage = document.querySelector('[data-testid="stage"]')!, seen = new Set<string>();
    const observer = new MutationObserver(() => { seen.add(stage.getAttribute('aria-label')!); if (seen.size >= 3) { observer.disconnect(); clearTimeout(timer); resolve([...seen]); } });
    const timer = setTimeout(() => { observer.disconnect(); resolve([...seen]); }, 3000); observer.observe(stage, { attributes: true, attributeFilter: ['aria-label'] });
  })); expect(frames.length).toBe(3); await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  const download = page.waitForEvent('download'); await page.keyboard.press('Control+s'); const file = await (await download).path(); const { readFile } = await import('node:fs/promises'); const p = decodeLam(await readFile(file!));
  expect(p.animationMode).toBe('frame-by-frame'); expect(p.items[0].holdCels).toBe(false); expect(p.items[0].cels).toHaveLength(3); expect(p.duration).toBe(3); expect(p.keyframes).toEqual({});
  await page.getByRole('button', { name: 'Back to all projects' }).click(); await page.reload(); await expect(start.getByRole('button', { name: 'Open recent Ink studies', exact: true })).toBeVisible(); await start.getByRole('button', { name: 'Open recent Ink studies', exact: true }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('Ink studies'); await expect(page.locator('.timeline-cel')).toHaveCount(3); await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('rig/motion document choice keeps the current rig and automatic-keyframe workflow', async ({ page }) => {
  const start = await firstStart(page); await start.getByRole('button', { name: 'Rig / motion', exact: false }).click(); const create = page.getByRole('dialog', { name: 'Create a new project' });
  await expect(create.getByRole('button', { name: 'Rig / motion', exact: false })).toHaveAttribute('aria-pressed', 'true'); await create.getByLabel('New document template').selectOption('character'); await create.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.locator('[data-bone]')).toHaveCount(10); await expect(page.getByRole('button', { name: 'Automatic keyframes' })).toHaveAttribute('aria-pressed', 'true'); await expect(page.locator('.document-animation-mode')).toHaveText('RIG'); await expect(page.getByRole('button', { name: 'New blank frame', exact: true })).toHaveCount(0);
});

test('launch windows remain usable on a compact viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const start = await firstStart(page);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390); await expect(start.getByRole('button', { name: 'Hand-drawn', exact: false })).toBeVisible(); await expect(start.getByLabel('Show this window at startup')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('desktop first launch shows release notes and Start instead of an automatic setup wizard', async ({ page }) => {
  await page.addInitScript(() => {
    window.luno = { platform: 'win32', version: '0.3.5', saveProject: async () => true, openProject: async () => null, saveExport: async () => true, chooseFolder: async () => 'C:\\Animations', getWorkspace: async () => null, onCommand: () => () => {}, onProjectFile: () => () => {}, ready: async () => {}, library: { list: async () => [], save: async () => { throw new Error('Mock has no projects'); }, load: async () => { throw new Error('No projects'); }, patch: async () => {}, deleteForever: async () => {}, recover: async () => { throw new Error('No revisions'); }, getSettings: async () => ({ lastProjectId: null }), saveSettings: async () => {}, backups: async () => [], backup: async () => ({ id: 'test', createdAt: 0, reason: 'manual', version: '0.3.5', projects: 0 }), restore: async () => false }, updater: { state: async () => ({ phase: 'disabled', version: null, progress: 0, message: 'Test bridge', checkedAt: null, countdown: null, automatic: true, backupId: null }), check: async () => {}, install: async () => {}, defer: async () => {}, setAutomatic: async () => {}, activity: () => {}, onState: () => () => {} }, onPrepare: () => () => {}, preparationResult: () => {}, onResume: () => () => {} };
  });
  await page.goto('/');
  const news = page.getByRole('dialog', { name: 'What’s New', exact: true }); await expect(news).toBeVisible();
  await news.getByRole('button', { name: 'Continue', exact: true }).click();
  const start = page.getByRole('dialog', { name: 'Luno Animate — Start' }); await expect(start).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Workspace configuration' })).toHaveCount(0);
  await start.getByLabel('Show this window at startup').uncheck(); await start.getByRole('button', { name: 'All projects', exact: true }).click();
  await page.reload(); await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeEnabled(); await expect(page.getByRole('dialog')).toHaveCount(0);
});
