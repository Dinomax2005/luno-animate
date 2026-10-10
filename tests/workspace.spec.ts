import { test, expect, type Page } from '@playwright/test';
import { createProject, createShape } from '../src/engine/project';
import { encodeLam } from '../src/engine/lam';

async function studio(page: Page) {
  const project = createProject('blank'); project.name = 'Production test'; project.width = 640; project.height = 400; project.duration = 48; project.workArea.end = 47;
  const first = createShape('rectangle', 180, 180), second = createShape('ellipse', 450, 230); first.name = 'Primary'; second.name = 'Secondary'; project.items = [first, second];
  await page.goto('/'); await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeEnabled();
  await page.getByLabel('Open Luno project file').setInputFiles({ name: 'production.lam', mimeType: 'application/vnd.luno.lam', buffer: Buffer.from(encodeLam(project)) });
  await expect(page.getByLabel('Project name')).toHaveValue(project.name); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false'); await expect(page.getByTestId('stage')).toBeVisible();
  return project;
}

async function reopen(page: Page) { await page.reload(); await page.locator('.project-open').first().click(); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false'); }

test('professional chrome, docked panels, and timeline share aligned frame geometry', async ({ page }) => {
  await studio(page); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(page.getByRole('menubar')).toBeVisible(); await expect(page.locator('.menu-trigger')).toHaveCount(8);
  const heading = await page.locator('.timeline-layer-heading').boundingBox(), ruler = await page.getByRole('slider', { name: 'Timeline playhead' }).boundingBox(), track = await page.locator('.timeline-track').first().boundingBox(), playhead = await page.locator('.timeline-playhead').boundingBox();
  expect(heading && ruler && track && playhead).toBeTruthy(); expect(Math.abs(heading!.x + heading!.width - ruler!.x)).toBeLessThan(1); expect(Math.abs(track!.x - ruler!.x)).toBeLessThan(1); expect(Math.abs(playhead!.x - track!.x)).toBeLessThan(1);
  await page.getByRole('slider', { name: 'Timeline playhead' }).focus(); await page.keyboard.press('ArrowRight'); await expect(page.getByRole('slider', { name: 'Timeline playhead' })).toHaveAttribute('aria-valuenow', '2');
});

test('command search is keyboard focused, skips disabled commands, and runs real workspace presets', async ({ page }) => {
  await studio(page); await page.keyboard.press('Control+Shift+p'); const search = page.getByRole('combobox', { name: 'Search commands' }); await expect(search).toBeFocused();
  await search.fill('undo'); await expect(page.getByRole('option', { name: /^Undo/ })).toBeDisabled(); await search.press('ArrowDown'); await search.press('Enter'); await expect(page.getByRole('dialog', { name: 'Command search' })).toBeVisible();
  await search.fill('rigging workspace'); await search.press('Enter'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByLabel('Workspace', { exact: true })).toHaveValue('Rigging'); await expect(page.getByRole('button', { name: 'Pose rig tool' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control+Shift+p'); await search.fill('drawing workspace'); await search.press('Enter'); await expect(page.getByLabel('Workspace', { exact: true })).toHaveValue('Drawing'); await expect(page.getByLabel('Drawing mode')).toHaveValue('cel'); await expect(page.getByRole('button', { name: 'Onion skin', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('resizes all docks, persists the layout, and does not pollute document undo', async ({ page }) => {
  await studio(page); const handles = [{ label: 'Resize layers panel', dx: 40, dy: 0, panel: '.library-panel', field: 'leftWidth' }, { label: 'Resize properties panel', dx: -35, dy: 0, panel: '.inspector-panel', field: 'rightWidth' }, { label: 'Resize timeline panel', dx: 0, dy: -40, panel: '.timeline', field: 'timelineHeight' }];
  for (const item of handles) {
    const handle = page.getByRole('separator', { name: item.label }), box = await handle.boundingBox(), before = Number(await handle.getAttribute('aria-valuenow')); expect(box).toBeTruthy(); await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2); await page.mouse.down(); await page.mouse.move(box!.x + box!.width / 2 + item.dx, box!.y + box!.height / 2 + item.dy, { steps: 5 }); await page.mouse.up();
    const after = Number(await handle.getAttribute('aria-valuenow')); expect(after).toBeGreaterThan(before); const rect = await page.locator(item.panel).boundingBox(); expect(Math.abs((item.field === 'timelineHeight' ? rect!.height : rect!.width) - after)).toBeLessThan(1);
  }
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled(); await page.waitForTimeout(220); const saved = await page.evaluate(() => localStorage.getItem('luno.workspace.pro.v1')); expect(saved).toBeTruthy(); await reopen(page);
  const layout = JSON.parse(saved!); await expect(page.getByRole('separator', { name: 'Resize layers panel' })).toHaveAttribute('aria-valuenow', String(layout.leftWidth)); await expect(page.getByRole('separator', { name: 'Resize properties panel' })).toHaveAttribute('aria-valuenow', String(layout.rightWidth)); await expect(page.getByRole('separator', { name: 'Resize timeline panel' })).toHaveAttribute('aria-valuenow', String(layout.timelineHeight));
});

test('menu keyboard navigation does not trigger global timeline shortcuts', async ({ page }) => {
  await studio(page); const file = page.getByRole('menuitem', { name: 'File', exact: true }); await file.focus(); await file.press('ArrowDown'); await expect(page.getByRole('menuitem', { name: 'New project', exact: true })).toBeFocused(); await page.keyboard.press('ArrowRight'); await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toHaveAttribute('aria-expanded', 'true'); await expect(page.getByRole('menuitem', { name: 'Select all layers', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeFocused(); await expect(page.getByRole('slider', { name: 'Timeline playhead' })).toHaveAttribute('aria-valuenow', '1');
});

test('right-click selects the target and exposes working context actions and keyboard navigation', async ({ page }) => {
  const project = await studio(page); const target = page.locator(`.art-item[data-item-id="${project.items[0].id}"]`); await target.click({ button: 'right' }); const menu = page.getByRole('menu', { name: 'Stage context actions' }); await expect(menu).toBeVisible(); await expect(page.getByLabel('Layer name')).toHaveValue('Primary'); await expect(menu.getByRole('menuitem', { name: 'Duplicate selection', exact: true })).toBeFocused();
  await page.keyboard.press('End'); await expect(menu.getByRole('menuitem', { name: 'Fit stage in window', exact: false })).toBeFocused(); await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0); await expect(page.getByTestId('stage')).toBeFocused();
  await target.click({ button: 'right' }); await page.keyboard.press('Enter'); await expect(menu).toHaveCount(0); await expect(page.getByLabel('Layer name')).toHaveValue('Primary copy'); await expect(page.locator('.art-item')).toHaveCount(3);
});

test('stage arrows nudge selected layers, shift nudges ten pixels, and undo restores the transform', async ({ page }) => {
  const project = await studio(page); const x = page.getByRole('spinbutton', { name: 'X', exact: true }); await expect(x).toHaveValue(String(project.items[1].x)); await page.getByTestId('stage').focus(); await page.keyboard.press('ArrowRight'); await expect(x).toHaveValue(String(project.items[1].x + 1)); await page.keyboard.press('Shift+ArrowRight'); await expect(x).toHaveValue(String(project.items[1].x + 11)); await expect(page.getByRole('slider', { name: 'Timeline playhead' })).toHaveAttribute('aria-valuenow', '1');
  await page.keyboard.press('Control+z'); await expect(x).toHaveValue(String(project.items[1].x + 1)); await page.keyboard.press('.'); await expect(page.getByRole('slider', { name: 'Timeline playhead' })).toHaveAttribute('aria-valuenow', '2');
});

test('focus mode, stage rulers, and light theme can be toggled without damaging document content', async ({ page }) => {
  await studio(page); await page.getByTestId('stage').focus(); await page.keyboard.press('Tab'); await expect(page.locator('.library-panel')).toHaveCount(0); await expect(page.locator('.inspector-panel')).toHaveCount(0); await expect(page.locator('.timeline')).toHaveCount(0); await page.keyboard.press('Tab'); await expect(page.locator('.library-panel')).toBeVisible(); await expect(page.locator('.timeline')).toBeVisible();
  await page.getByRole('menuitem', { name: 'View', exact: true }).click(); await page.getByRole('menuitemcheckbox', { name: 'Stage rulers', exact: true }).click(); await expect(page.locator('.stage-rulers')).toHaveCount(0); await page.getByRole('menuitem', { name: 'View', exact: true }).click(); await page.getByRole('menuitem', { name: 'Use light interface', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light'); await expect(page.getByLabel('Project name')).toHaveValue('Production test'); await expect(page.locator('.art-item')).toHaveCount(2); await page.getByRole('button', { name: 'Back to all projects' }).click(); await expect(page.locator('.home-shell')).toBeVisible(); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false'); await reopen(page); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('compact screen fits the viewport and keeps both editing panels reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await studio(page); expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390); await expect(page.locator('.library-panel')).toBeHidden(); await expect(page.locator('.inspector-panel')).toBeHidden();
  await page.getByRole('button', { name: 'Toggle Properties panel' }).click(); await expect(page.locator('.inspector-panel')).toBeVisible(); await page.getByRole('spinbutton', { name: 'X', exact: true }).fill('320'); await page.getByRole('spinbutton', { name: 'X', exact: true }).press('Enter'); await page.getByRole('button', { name: 'Close panel overlay' }).click(); await expect(page.locator('.inspector-panel')).toBeHidden();
  await page.getByRole('button', { name: 'Toggle Layers panel' }).click(); await expect(page.locator('.library-panel')).toBeVisible(); await page.locator('.layer-select').first().click(); await page.getByRole('button', { name: 'Close panel overlay' }).click(); await expect(page.locator('.library-panel')).toBeHidden(); expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await page.keyboard.press('Control+Shift+p'); await expect(page.getByRole('dialog', { name: 'Command search' })).toBeVisible(); await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Export', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Export your animation' })).toBeVisible(); expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
});
