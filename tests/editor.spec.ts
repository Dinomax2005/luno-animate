import { test, expect, type Page } from '@playwright/test';
import { createProject, serializeProject } from '../src/engine/project';
import { createPreset } from '../src/engine/animation';
import { decodeLam } from '../src/engine/lam';
async function openStudio(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeEnabled();
  if (await page.locator('.project-open').count()) await page.locator('.project-open').first().click();
  else await page.getByRole('button', { name: 'Make a little magic', exact: false }).click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
}

test('opens a working studio without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openStudio(page);
  await expect(page.getByTestId('stage')).toBeVisible();
  await expect(page.getByLabel('Project name')).toHaveValue('A little hello');
  await expect(page.getByText('15 bones · character')).toBeVisible();
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await expect(page.locator('[data-bone]')).toHaveCount(10);
  expect(errors).toEqual([]);
});

test('plays and pauses the animation with the keyboard', async ({ page }) => {
  await openStudio(page);
  const initial = await page.getByTestId('stage').getAttribute('aria-label');
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause animation', exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.getByTestId('stage').getAttribute('aria-label')).not.toBe(initial);
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeVisible();
  const paused = await page.getByTestId('stage').getAttribute('aria-label');
  await page.waitForTimeout(150);
  expect(await page.getByTestId('stage').getAttribute('aria-label')).toBe(paused);
});

test('draws a rectangle, edits a property, and undoes/redoes it', async ({ page }) => {
  await openStudio(page);
  await page.getByRole('button', { name: 'Rectangle tool' }).click();
  const stage = await page.getByTestId('stage').boundingBox();
  if (!stage) throw new Error('Missing artboard');
  await page.mouse.move(stage.x + 35, stage.y + 35); await page.mouse.down();
  await page.mouse.move(stage.x + 130, stage.y + 100, { steps: 6 }); await page.mouse.up();
  await expect(page.getByLabel('Layer name')).toHaveValue('Rectangle');
  await page.getByRole('spinbutton', { name: 'X', exact: true }).fill('200');
  await page.getByRole('spinbutton', { name: 'X', exact: true }).press('Enter');
  await expect(page.getByRole('spinbutton', { name: 'X', exact: true })).toHaveValue('200');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'X', exact: true })).not.toHaveValue('200');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'X', exact: true })).toHaveValue('200');
});

test('poses a connected joint and creates an automatic keyframe', async ({ page }) => {
  await openStudio(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const joint = page.locator('[data-bone="rightHand"]');
  const before = await joint.getAttribute('cx');
  const box = await joint.boundingBox(); if (!box) throw new Error('Missing joint');
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 30, y + 20, { steps: 8 }); await page.mouse.up();
  expect(await joint.getAttribute('cx')).not.toBe(before);
  await expect(page.getByRole('button', { name: 'Milo keyframe 3', exact: true })).toBeVisible();
  await expect(page.getByText('Right forearm', { exact: true }).first()).toBeVisible();
});

test('adds assets and hides, locks, and duplicates layers', async ({ page }) => {
  await openStudio(page);
  await page.getByRole('button', { name: 'Assets', exact: false }).first().click();
  await page.getByLabel('Search assets').fill('Star');
  await page.locator('.asset-card').click();
  await expect(page.getByLabel('Layer name')).toHaveValue('Star');
  await page.getByRole('button', { name: 'Scene', exact: false }).first().click();
  await page.getByRole('button', { name: 'Hide Star', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show Star', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show Star', exact: true }).click();
  await page.getByRole('button', { name: 'Lock Star', exact: true }).click();
  await expect(page.getByLabel('Layer name')).toBeDisabled();
  await page.getByRole('button', { name: 'Unlock Star', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate layer', exact: true }).click();
  await expect(page.getByLabel('Layer name')).toHaveValue('Star copy');
});

test('chooses a motion starter and edits easing', async ({ page }) => {
  await openStudio(page);
  await page.getByRole('button', { name: 'Walk', exact: true }).click();
  await expect(page.getByText('Walk motion added.', { exact: false })).toBeVisible();
  await page.locator('.inspector-tabs button').filter({ hasText: 'Motion' }).click();
  await expect(page.locator('.keyframe-list > div')).toHaveCount(5);
  await page.locator('.select-field select').selectOption('hold');
  await expect(page.getByText('Keep the pose until the next keyframe.')).toBeVisible();
  await page.getByRole('button', { name: 'Delete keyframe at frame 72' }).click();
  await expect(page.locator('.keyframe-list > div')).toHaveCount(4);
});

test('moves a keyframe by dragging its diamond', async ({ page }) => {
  await openStudio(page);
  const key = page.getByRole('button', { name: 'Milo keyframe 19', exact: true });
  const box = await key.boundingBox(); if (!box) throw new Error('Missing key');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 75, box.y + box.height / 2, { steps: 7 }); await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Milo keyframe 19', exact: true })).toHaveCount(0);
  await expect(page.locator('.timeline-key')).toHaveCount(5);
});

test('saves an editable project and restores edits after refresh', async ({ page }) => {
  await openStudio(page);
  await page.getByLabel('Project name').fill('My happy robot'); await page.getByLabel('Project name').press('Enter');
  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Control+s'); const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('My happy robot.lam');
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  const { readFile } = await import('node:fs/promises'); const file = await download.path(); expect(file).toBeTruthy(); expect(decodeLam(await readFile(file!)).name).toBe('My happy robot');
  await page.reload(); await page.locator('.project-open').first().click(); await expect(page.getByLabel('Project name')).toHaveValue('My happy robot');
});

test('opens valid project files and rejects corrupt ones without losing the canvas', async ({ page }) => {
  await openStudio(page);
  const project = createProject('shapes'); project.name = 'Imported little bounce';
  await page.getByLabel('Open Luno project file').setInputFiles({ name: 'sample.luno', mimeType: 'application/json', buffer: Buffer.from(serializeProject(project)) });
  await expect(page.getByLabel('Project name')).toHaveValue(project.name);
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('Open Luno project file').setInputFiles({ name: 'broken.luno', mimeType: 'application/json', buffer: Buffer.from('{"version":900}') });
  await expect(page.getByRole('alert')).toContainText('not a supported');
  await expect(page.getByLabel('Project name')).toHaveValue(project.name);
});

test('exports a real SVG without editing guides', async ({ page }) => {
  await openStudio(page); await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.locator('.format-button').filter({ hasText: 'SVG' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toMatch(/\.svg$/);
  const path = await download.path(); if (!path) throw new Error('Missing SVG download');
  const { readFile } = await import('node:fs/promises'); const contents = await readFile(path, 'utf8');
  expect(contents).toContain('<svg'); expect(contents).toContain('width="960"');
  expect(contents).not.toContain('rig-overlay'); expect(contents).not.toContain('selection-overlay');
});

test('exports a real PNG image', async ({ page }) => {
  await openStudio(page); await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'PNG A still moment', exact: true }).click();
  await page.getByText('Transparent background', { exact: true }).click();
  const promise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  const download = await promise; const path = await download.path(); if (!path) throw new Error('Missing PNG download');
  const { readFile } = await import('node:fs/promises'); const bytes = await readFile(path);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG'); expect(bytes.readUInt32BE(16)).toBe(960); expect(bytes.readUInt32BE(20)).toBe(600);
});

test('encodes a genuine animated GIF', async ({ page }) => {
  const project = createProject('shapes'); project.width = 64; project.height = 64; project.duration = 12; project.fps = 12; project.workArea = { start: 0, end: 11 }; project.camera.x = 32; project.camera.y = 32;
  project.items = [project.items.at(-1)!]; const item = project.items[0]; item.x = 32; item.y = 32; item.width = 18; item.height = 18;
  project.keyframes[item.id] = createPreset(item, 'spin', project.duration);
  await page.addInitScript(raw => localStorage.setItem('luno.project.v1', raw), serializeProject(project));
  await openStudio(page); await page.getByRole('button', { name: 'Export', exact: true }).click();
  const promise = page.waitForEvent('download'); await page.locator('.format-button').filter({ hasText: 'GIF' }).click(); await page.getByRole('button', { name: 'Export GIF', exact: true }).click();
  const download = await promise; const path = await download.path(); if (!path) throw new Error('Missing GIF download');
  const { readFile } = await import('node:fs/promises'); const bytes = await readFile(path);
  expect(bytes.subarray(0, 6).toString()).toBe('GIF89a'); expect(bytes.readUInt16LE(6)).toBe(64); expect(bytes.length).toBeGreaterThan(300);
  expect(bytes.toString('latin1')).toContain('NETSCAPE');
});

test('completes the four-step setup wizard and creates a blank project', async ({ page }) => {
  await openStudio(page); await page.getByRole('button', { name: 'Quick setup', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('Little learning curve.');
  await page.getByRole('button', { name: 'Let’s get started' }).click();
  await page.getByRole('button', { name: 'Something entirely your own', exact: false }).click();
  await page.getByRole('button', { name: 'Looks good' }).click();
  await dialog.getByText('Project name', { exact: true }).locator('..').locator('input').fill('A fresh possibility');
  await page.getByRole('button', { name: 'Looks good' }).click();
  await expect(dialog).toContainText('You’ve got this.');
  await page.getByRole('button', { name: 'Start creating' }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByLabel('Project name')).toHaveValue('A fresh possibility');
  await expect(page.getByText('No layers yet')).toBeVisible();
  await page.getByRole('button', { name: 'Add your first character', exact: false }).click();
  await expect(page.getByLabel('Layer name')).toHaveValue('Milo');
});

test('automatically shows first-run setup in desktop mode', async ({ page }) => {
  await page.addInitScript(() => {
    window.luno = { platform: 'win32', version: '0.2.0', saveProject: async () => true, openProject: async () => null, saveExport: async () => true, chooseFolder: async () => 'C:\\Animations', getWorkspace: async () => null, onCommand: () => () => {}, onProjectFile: () => () => {}, ready: async () => {}, library: { list: async () => [], save: async () => { throw new Error('Mock has no projects'); }, load: async () => { throw new Error('No projects'); }, patch: async () => {}, deleteForever: async () => {}, recover: async () => { throw new Error('No revisions'); }, getSettings: async () => ({ lastProjectId: null }), saveSettings: async () => {}, backups: async () => [], backup: async () => ({ id: 'test', createdAt: 0, reason: 'manual', version: '0.2.0', projects: 0 }), restore: async () => false }, updater: { state: async () => ({ phase: 'disabled', version: null, progress: 0, message: 'Test bridge', checkedAt: null, countdown: null, automatic: true, backupId: null }), check: async () => {}, install: async () => {}, defer: async () => {}, setAutomatic: async () => {}, activity: () => {}, onState: () => () => {} }, onPrepare: () => () => {}, preparationResult: () => {}, onResume: () => () => {} };
  });
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Set up your Luno studio' })).toBeVisible();
  await page.getByRole('button', { name: 'I’ll explore on my own' }).click();
  await page.reload(); await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('applies canvas settings and workspace preferences', async ({ page }) => {
  await openStudio(page); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Canvas width', { exact: true }).fill('1080');
  await page.getByLabel('Canvas height', { exact: true }).fill('1080');
  await page.getByRole('switch', { name: 'Show canvas grid', exact: false }).check();
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(page.getByText('1080 × 1080', { exact: true })).toBeVisible();
  await expect(page.locator('rect[fill="url(#canvas-grid)"]')).toBeVisible();
});

test('keeps dialogs keyboard accessible and renders on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await openStudio(page);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await page.getByRole('button', { name: 'Quick setup', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Export your animation' })).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
});
