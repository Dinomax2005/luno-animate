import { test, expect, type Page } from './fixtures/editor';
import { readFile } from 'node:fs/promises';
import { createItem, createProject } from '../src/engine/project';
import { decodeLam, encodeLam } from '../src/engine/lam';
import type { Project } from '../src/engine/types';
async function open(page: Page, project: Project) {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeEnabled();
  await page.getByLabel('Open Luno project file').setInputFiles({ name: 'precision.lam', mimeType: 'application/vnd.luno.lam', buffer: Buffer.from(encodeLam(project)) });
  await expect(page.getByTestId('stage')).toBeVisible(); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
}
async function saved(page: Page) {
  const download = page.waitForEvent('download'); await page.keyboard.press('Control+s'); const file = await download;
  return decodeLam(await readFile((await file.path())!));
}
async function frame(page: Page, at: number) {
  const slider = page.getByRole('slider', { name: 'Timeline playhead' }); await slider.focus(); await slider.press('Home');
  for (let n = 0; n < at; n++) await slider.press('ArrowRight');
}
function rigged() {
  const p = createProject('character'), item = p.items.find(i => i.rig)!; item.name = 'Orbit'; p.name = 'Channel study'; p.items = [item];
  p.keyframes[item.id] = [{ id: 'first', frame: 0, easing: 'linear', values: { x: 320, y: 280, opacity: 1, bones: { [item.rig!.bones[0].id]: 20 } } }, { id: 'second', frame: 10, easing: 'hold', values: { y: 380, blur: 2, bones: { [item.rig!.bones[0].id]: 35 } } }]; return p;
}

test('the browser boot fallback is a small blue card, not the removed fullscreen loading screen', async ({ page }) => {
  let release: (() => void) | undefined;
  await page.route('**/src/main.tsx*', async route => { await new Promise<void>(resolve => { release = resolve; }); await route.continue(); });
  await page.goto('/', { waitUntil: 'commit' }); const popup = page.getByTestId('startup-popup'); await expect(popup).toBeVisible();
  await expect.poll(() => !!release).toBe(true); const r = await popup.boundingBox(); expect(r!.width).toBeLessThan(480); expect(r!.height).toBeLessThan(300);
  expect(r!.width).toBeLessThan(1440 / 2); await expect(page.locator('.startup-screen')).toHaveCount(0);
  await expect.poll(() => !!release).toBe(true); release!(); await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeEnabled(); await expect(popup).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#77b8ff');
});

test('dragging, copying, pasting and deleting a property lane keeps unrelated values and rig keys', async ({ page }) => {
  const p = rigged(), id = p.items[0].id; await open(page, p); await page.getByRole('button', { name: 'Expand Orbit property tracks' }).click();
  const lane = page.locator('.timeline-property-row[data-channel="x"]'), dot = lane.getByRole('button', { name: 'Orbit Position X keyframe 1', exact: true });
  await expect(dot).toBeVisible(); const box = await dot.boundingBox(), track = await lane.locator('.timeline-track').boundingBox();
  await page.mouse.move(box!.x + box!.width / 2 + .5, box!.y + box!.height / 2); await page.mouse.down();
  await page.mouse.move(track!.x + 5 / (p.duration - 1) * track!.width, box!.y + box!.height / 2, { steps: 5 }); await page.mouse.up();
  const moved = lane.getByRole('button', { name: 'Orbit Position X keyframe 6', exact: true }); await expect(moved).toBeVisible();
  await moved.click(); await page.keyboard.press('Control+c'); await frame(page, 10); await page.keyboard.press('Control+v');
  let n = await saved(page); expect(n.keyframes[id].find(k => k.frame === 0)!.values).toEqual({ y: 280, opacity: 1, bones: p.keyframes[id][0].values.bones });
  expect(n.keyframes[id].find(k => k.frame === 10)!.values).toEqual({ ...p.keyframes[id][1].values, x: 320 });
  const pasted = lane.getByRole('button', { name: 'Orbit Position X keyframe 11', exact: true }); await pasted.click(); await page.keyboard.press('Delete');
  n = await saved(page); expect(n.keyframes[id].find(k => k.frame === 10)!.values).toEqual(p.keyframes[id][1].values);
  await page.keyboard.press('Control+z'); await expect(pasted).toBeVisible(); await expect(page.locator('.timeline-property-row[data-channel="bones"]')).toBeVisible();
});

test('property diamonds support frame-precise keyboard moves without nudging the artwork', async ({ page }) => {
  const p = rigged(), id = p.items[0].id; await open(page, p); await page.getByRole('button', { name: 'Expand Orbit property tracks' }).click();
  const dot = page.getByRole('button', { name: 'Orbit Position X keyframe 1', exact: true }); await dot.focus(); await dot.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Orbit Position X keyframe 2', exact: true })).toBeVisible();
  const n = await saved(page); expect(n.items[0].x).toBe(p.items[0].x); expect(n.keyframes[id].find(k => k.frame === 1)!.values).toEqual({ x: 320 });
  expect(n.keyframes[id][0].values.bones).toEqual(p.keyframes[id][0].values.bones);
});

test('real footage edge clicks are safe, handles restore source, and the split shortcut is not duplicate', async ({ page }) => {
  const p = createProject('blank', 'video-editing'); p.fps = 12; await open(page, p);
  const original = await readFile('tests/fixtures/red-green-tone.webm'); await page.getByLabel('Import video file').setInputFiles('tests/fixtures/red-green-tone.webm');
  await expect(page.locator('.motion-clip.video')).toHaveCount(1); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  await page.locator('.inspector-tabs').getByRole('button', { name: 'Timing', exact: true }).click();
  await page.getByRole('button', { name: 'Trim end of red-green-tone', exact: true }).click(); await expect(page.getByLabel('Clip out', { exact: true })).toHaveValue('12');
  await page.getByRole('button', { name: 'Trim start of red-green-tone', exact: true }).click(); await expect(page.getByLabel('Clip in', { exact: true })).toHaveValue('1');
  for (const [label, value] of [['Clip out', '6'], ['Clip in', '3'], ['Clip out', '12'], ['Clip in', '1']]) { await page.getByLabel(label, { exact: true }).fill(value); await page.getByLabel(label, { exact: true }).press('Enter'); }
  let n = await saved(page); expect(n.items[0]).toMatchObject({ startFrame: 0, endFrame: 12, sourceStart: 0 }); expect(n.audio[0]).toMatchObject({ startFrame: 0, endFrame: 12, trimStart: 0 }); expect(n.media[0].frames).toHaveLength(12);
  await frame(page, 6); await page.keyboard.press('Control+Shift+d'); await expect(page.locator('.motion-clip.video')).toHaveCount(2); await expect(page.locator('.audio-clip')).toHaveCount(2);
  n = await saved(page); expect(n.items.map(i => [i.startFrame, i.endFrame])).toEqual([[0, 6], [6, 12]]); expect(n.media).toHaveLength(1); expect(await readFile('tests/fixtures/red-green-tone.webm')).toEqual(original);
  await page.keyboard.press('Control+d'); await expect(page.locator('.motion-clip.video')).toHaveCount(3);
});

test('clip drag snaps a trailing boundary to its neighbor, shows alignment, and Alt bypasses it', async ({ page }) => {
  const p = createProject('blank'); p.name = 'Snap study'; p.duration = 180; p.workArea.end = 179;
  p.items = [createItem('shape', { name: 'Clip A', startFrame: 10, endFrame: 30 }), createItem('shape', { name: 'Neighbor', startFrame: 42, endFrame: 80 })]; await open(page, p);
  const body = page.getByRole('button', { name: 'Move Clip A clip', exact: true }), track = await body.locator('xpath=../..').boundingBox();
  let box = await body.boundingBox(); await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2); await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 12.25 * track!.width / 179, box!.y + box!.height / 2, { steps: 4 });
  await expect(page.locator('.timeline-snap-guide span')).toContainText('Neighbor'); await page.mouse.up();
  let n = await saved(page); expect(n.items[0]).toMatchObject({ startFrame: 22, endFrame: 42 });
  box = await body.boundingBox(); await page.keyboard.down('Alt'); await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2); await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + .6 * track!.width / 179, box!.y + box!.height / 2, { steps: 2 });
  await expect(page.locator('.timeline-snap-guide')).toHaveCount(0); await page.mouse.up(); await page.keyboard.up('Alt');
  n = await saved(page); expect(n.items[0]).toMatchObject({ startFrame: 23, endFrame: 43 });
});

test('workspaces retain individual dock/zoom/snap choices across switching and restarting', async ({ page }) => {
  const p = createProject('blank'); p.name = 'Remembered desks'; p.items = [createItem('shape')]; await open(page, p);
  const workspace = page.getByLabel('Workspace', { exact: true }); await workspace.selectOption('Motion');
  await page.getByRole('separator', { name: 'Resize properties panel' }).press('Shift+ArrowLeft'); await page.getByRole('button', { name: 'Zoom timeline in' }).click(); await page.getByRole('button', { name: 'Snap clips' }).click();
  await workspace.selectOption('Video editing'); await expect(page.getByRole('button', { name: 'Snap clips' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('separator', { name: 'Resize properties panel' }).press('ArrowRight'); await workspace.selectOption('Motion');
  await expect(page.getByRole('separator', { name: 'Resize properties panel' })).toHaveAttribute('aria-valuenow', '352'); await expect(page.getByRole('button', { name: 'Snap clips' })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('luno.workspace.pro.profiles.v1') ?? '{}').Motion?.rightWidth)).toBe(352);
  await page.reload(); await page.locator('.project-open').first().click(); await expect(workspace).toHaveValue('Motion'); await expect(page.getByRole('separator', { name: 'Resize properties panel' })).toHaveAttribute('aria-valuenow', '352');
  await expect(page.getByRole('button', { name: 'Snap clips' })).toHaveAttribute('aria-pressed', 'false'); await workspace.selectOption('Video editing'); await expect(page.getByRole('separator', { name: 'Resize properties panel' })).toHaveAttribute('aria-valuenow', '312');
  await page.getByRole('menuitem', { name: 'View', exact: true }).click(); await page.getByRole('menuitem', { name: 'Use light interface', exact: true }).click();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#1f61af'); expect(await page.evaluate(() => document.body.scrollWidth)).toBe(1440);
});

test('opacity drag edits the animated channel and is one undo gesture, not an ignored base edit', async ({ page }) => {
  const p = rigged(), id = p.items[0].id; await open(page, p); await frame(page, 10);
  const slider = page.getByRole('slider', { name: 'Object opacity' }), box = await slider.boundingBox();
  await page.mouse.move(box!.x + box!.width * .25, box!.y + box!.height / 2); await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * .4, box!.y + box!.height / 2, { steps: 6 }); await page.mouse.up();
  let n = await saved(page); expect(n.keyframes[id].find(k => k.frame === 10)!.values.opacity).toBeGreaterThan(.2); expect(n.keyframes[id].find(k => k.frame === 10)!.values.opacity).toBeLessThan(.6); expect(n.items[0].opacity).toBe(1);
  await page.keyboard.press('Control+z'); n = await saved(page); expect(n.keyframes[id]).toEqual(p.keyframes[id]);
});
