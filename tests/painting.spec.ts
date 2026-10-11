import { test, expect, type Page } from './fixtures/editor';
import { createDrawingLayer, createItem, createProject } from '../src/engine/project';
import { BRUSH_PRESETS, DEFAULT_BRUSH } from '../src/engine/brushes';
import { encodeLam, decodeLam } from '../src/engine/lam';
import type { EditorStore } from '../src/store/editor';
import type { Project } from '../src/engine/types';
import { readFile } from 'node:fs/promises';

function paintDocument(mode: Project['animationMode'] = 'frame-by-frame') {
  const p = createProject('blank', mode); p.name = 'Brushes & Paint acceptance'; p.width = p.height = 128; p.camera.x = p.camera.y = 64; p.fps = 12; p.duration = 3; p.workArea = { start: 0, end: 2 }; p.background = '#ffffff'; p.items = [createDrawingLayer(128, 128, 'Paint study')]; return p;
}
async function open(page: Page, p = paintDocument()) {
  await page.goto('/'); await page.getByLabel('Open Luno project file').setInputFiles({ name: 'paint.lam', mimeType: 'application/vnd.luno.lam', buffer: Buffer.from(encodeLam(p)) });
  await expect(page.getByLabel('Project name')).toHaveValue(p.name); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Draw tool', exact: true }).click(); await expect(page.getByTestId('brush-studio')).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  // Observe the actual renderer store, including Vite query strings; a second import would create a different store.
  await page.route('**/src/store/editor.ts*', async route => { const response = await route.fetch(); await route.fulfill({ response, body: `${await response.text()}\nwindow.__paintEditor = useEditor;` }); });
});
async function live(page: Page): Promise<Project> { return page.evaluate(() => (window as unknown as { __paintEditor: { getState: () => EditorStore } }).__paintEditor.getState().project); }
async function history(page: Page): Promise<number> { return page.evaluate(() => (window as unknown as { __paintEditor: { getState: () => EditorStore } }).__paintEditor.getState().history.length); }
async function coords(page: Page, x: number, y: number) { const b = await page.getByTestId('stage').boundingBox(); if (!b) throw new Error('Missing stage'); return { x: b.x + x / 128 * b.width, y: b.y + y / 128 * b.height }; }
async function stroke(page: Page, x1: number, y1: number, x2: number, y2: number, steps = 10) { const a = await coords(page, x1, y1), b = await coords(page, x2, y2); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps }); await page.mouse.up(); }
async function setInput(page: Page, name: string, value: string) { await page.getByLabel(name, { exact: true }).evaluate((node, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); }, value); }
async function color(page: Page, value: string) { await setInput(page, 'Brush color', value); }
async function range(page: Page, name: string, value: number) { await setInput(page, name, String(value)); }
async function pixels(page: Page, points: [number, number][]): Promise<number[][]> {
  return page.evaluate(async points => { // @ts-expect-error Vite browser import
    const { rasterize } = await import('/src/engine/export.tsx');
    const s = (window as unknown as { __paintEditor: { getState: () => EditorStore } }).__paintEditor.getState(), canvas = document.createElement('canvas'); canvas.width = canvas.height = 128; const context = await rasterize(s.project, s.frame, canvas);
    return points.map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data));
  }, points);
}

test('Brushes & Paint provides twelve real brush engines and captures style per gesture', async ({ page }) => {
  await open(page); await expect(page.getByTestId('brush-studio').getByText('Brushes & Paint', { exact: true })).toBeVisible();
  for (const preset of BRUSH_PRESETS) await expect(page.getByRole('button', { name: `Use ${preset.name} brush`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use Smooth Ink brush', exact: true }).click(); await range(page, 'Stroke smoothing', 88); await color(page, '#235c9c'); await stroke(page, 15, 20, 90, 70);
  const first = (await live(page)).items[0].cels![0].strokes[0]; expect(first.brush).toMatchObject({ kind: 'ink', smoothing: 0.88, sizePressure: true }); expect(first.points.length).toBeGreaterThan(3); expect(first.points.every(p => p.pressure === 1)).toBe(true);
  await page.getByRole('button', { name: 'Use Chalk brush', exact: true }).click(); await stroke(page, 15, 90, 95, 90); const marks = (await live(page)).items[0].cels![0].strokes; expect(marks[0]).toEqual(first); expect(marks[1].brush?.kind).toBe('chalk'); await expect(page.locator('[data-item-id] [data-paint-kind="chalk"]')).toBeVisible();
});

test('pixel painting is grid-aligned, crisp in PNG rendering, and supports single-click dots', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Use Pixel Square brush', exact: true }).click(); await page.getByLabel('Brush size', { exact: true }).fill('4'); await range(page, 'Pixel cell size', 4); await color(page, '#ff0000');
  const at = await coords(page, 41, 41); await page.mouse.click(at.x, at.y); await expect(page.locator('[data-item-id] [data-paint-kind="pixel"]')).toHaveAttribute('shape-rendering', 'crispEdges');
  const mark = (await live(page)).items[0].cels![0].strokes[0]; expect(mark.brush?.pixelSize).toBe(4); expect(mark.points).toHaveLength(2); expect(await pixels(page, [[40, 40], [43, 43], [39, 40], [44, 40]])).toEqual([[255, 0, 0, 255], [255, 0, 0, 255], [255, 255, 255, 255], [255, 255, 255, 255]]);
});

test('cel eraser removes earlier paint, preserves the layer below, and later paint survives it', async ({ page }) => {
  const p = paintDocument(), below = createItem('shape', { name: 'Underlay', shape: 'rectangle', x: 64, y: 64, width: 128, height: 128, fill: '#0000ff' }); p.items.unshift(below); await open(page, p);
  await page.getByRole('button', { name: 'Use Studio Round brush', exact: true }).click(); await page.getByLabel('Brush size', { exact: true }).fill('20'); await color(page, '#ff0000'); await stroke(page, 20, 64, 105, 64);
  await page.getByRole('button', { name: 'Eraser tool', exact: true }).click(); await page.getByLabel('Brush size', { exact: true }).fill('16'); await stroke(page, 64, 30, 64, 98);
  let project = await live(page); expect(project.items[0].fill).toBe('#0000ff'); expect(project.items[1].cels![0].strokes[1].mode).toBe('erase'); expect((await pixels(page, [[64, 64], [30, 64]]))).toEqual([[0, 0, 255, 255], [255, 0, 0, 255]]);
  await page.getByRole('button', { name: 'Draw tool', exact: true }).click(); await color(page, '#00ff00'); await stroke(page, 64, 48, 64, 78); expect((await pixels(page, [[64, 64]]))[0]).toEqual([0, 255, 0, 255]);
  await page.keyboard.press('Control+z'); expect((await pixels(page, [[64, 64]]))[0]).toEqual([0, 0, 255, 255]); await page.keyboard.press('Control+z'); expect((await pixels(page, [[64, 64]]))[0]).toEqual([255, 0, 0, 255]);
});

test('bucket fills an enclosed cel region, leaves the exterior alone, and Undo removes only the fill', async ({ page }) => {
  const p = paintDocument(), layer = p.items[0]; layer.cels![0].strokes = [{ points: [{ x: -34, y: -34 }, { x: 34, y: -34 }, { x: 34, y: 34 }, { x: -34, y: 34 }, { x: -34, y: -34 }], color: '#000000', width: 4, brush: { ...DEFAULT_BRUSH, smoothing: 0 }, mode: 'paint' }]; await open(page, p);
  await color(page, '#ff0000'); await page.getByRole('button', { name: 'Fill tool', exact: true }).click(); await range(page, 'Fill tolerance', 0); const at = await coords(page, 64, 64); await page.mouse.click(at.x, at.y); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(async () => (await live(page)).items[0].cels![0].strokes.length).toBe(2); const fill = (await live(page)).items[0].cels![0].strokes[1]; expect(fill.fill?.runs.length).toBeGreaterThan(10); expect(await pixels(page, [[64, 64], [8, 8], [30, 64]])).toEqual([[255, 0, 0, 255], [255, 255, 255, 255], [0, 0, 0, 255]]);
  await page.keyboard.press('Control+z'); expect((await live(page)).items[0].cels![0].strokes).toHaveLength(1); expect((await pixels(page, [[64, 64]]))[0]).toEqual([255, 255, 255, 255]);
});

test('eyedropper and temporary Alt sampling use actual composited canvas colors', async ({ page }) => {
  const p = paintDocument(); p.items.unshift(createItem('shape', { name: 'Color source', shape: 'rectangle', x: 64, y: 64, width: 110, height: 110, fill: '#b64e39' })); await open(page, p);
  await page.getByRole('button', { name: 'Eyedropper tool', exact: true }).click(); const at = await coords(page, 64, 64); await page.mouse.click(at.x, at.y); await expect(page.getByLabel('Brush color', { exact: true })).toHaveValue('#b64e39'); await expect(page.getByRole('button', { name: 'Draw tool', exact: true })).toHaveAttribute('aria-pressed', 'true'); expect((await live(page)).items[1].cels![0].strokes).toHaveLength(0);
  await color(page, '#00ff00'); await page.keyboard.down('Alt'); await page.mouse.click(at.x, at.y); await page.keyboard.up('Alt'); await expect(page.getByLabel('Brush color', { exact: true })).toHaveValue('#b64e39'); expect((await live(page)).items[1].cels![0].strokes).toHaveLength(0);
});

test('symmetry commits four marks in one undo step, and Escape cancels a draft completely', async ({ page }) => {
  await open(page); await page.getByLabel('Paint symmetry').selectOption('both'); await expect(page.getByTestId('paint-symmetry-guides')).toBeVisible(); const before = await history(page); await stroke(page, 20, 20, 35, 36); expect((await live(page)).items[0].cels![0].strokes).toHaveLength(4); expect(await history(page)).toBe(before + 1); await page.keyboard.press('Control+z'); expect((await live(page)).items[0].cels![0].strokes).toHaveLength(0);
  const at = await coords(page, 20, 60), end = await coords(page, 50, 60); await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 4 }); await page.keyboard.press('Escape'); await page.mouse.up(); expect((await live(page)).items[0].cels![0].strokes).toHaveLength(0); expect(await history(page)).toBe(before);
});

test('manual cels preserve brush styles on F6, keep F7 blank, and export painted LAM files exactly', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Use Neon Glow brush', exact: true }).click(); await stroke(page, 20, 25, 96, 65); const first = (await live(page)).items[0].cels![0].strokes[0]; await page.keyboard.press('F6'); await page.keyboard.press('F7'); const project = await live(page); expect(project.items[0].cels![1].strokes[0]).toEqual(first); expect(project.items[0].cels![2].strokes).toHaveLength(0);
  const download = page.waitForEvent('download'); await page.keyboard.press('Control+s'); const bytes = await readFile((await (await download).path())!); const reopened = decodeLam(new Uint8Array(bytes)); expect(reopened.items[0].cels).toEqual(project.items[0].cels); expect(new DataView(bytes.buffer, bytes.byteOffset).getUint16(10, true)).toBe(3);
});

test('color studio accepts HEX, palettes, saved swatches, and X/D without modifying artwork', async ({ page }) => {
  await open(page); const before = await live(page); await page.getByRole('tab', { name: 'Color studio', exact: true }).click(); await page.getByLabel('Paint hex color').fill('#8F32B5'); await page.getByLabel('Paint hex color').press('Enter'); await expect(page.getByLabel('Brush color', { exact: true })).toHaveValue('#8f32b5'); await page.getByRole('button', { name: 'Save color swatch' }).click(); await expect(page.getByRole('button', { name: 'Saved paint color #8f32b5' })).toBeVisible();
  await page.getByLabel('Paint palette').selectOption('Pixel 16'); await page.getByRole('button', { name: 'Paint color #d04648', exact: true }).click(); await expect(page.getByLabel('Brush color', { exact: true })).toHaveValue('#d04648'); await page.getByTestId('stage').focus(); await page.keyboard.press('x'); await expect(page.getByLabel('Brush color', { exact: true })).toHaveValue('#ffffff'); await page.keyboard.press('x'); await expect(page.getByLabel('Brush color', { exact: true })).toHaveValue('#d04648'); await page.keyboard.press('d'); await expect(page.getByLabel('Brush color', { exact: true })).toHaveValue('#0b1020'); expect((await live(page)).items).toEqual(before.items); expect(await history(page)).toBe(0);
});

test('custom presets and color swatches survive reload and export/import as a validated brush pack', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Use Calligraphy brush', exact: true }).click(); await range(page, 'Paint opacity', 73); await page.getByText('Custom presets & brush packs', { exact: true }).click(); await page.getByLabel('Custom brush name').fill('Studio nib'); await page.getByRole('button', { name: 'Save custom brush', exact: true }).click(); await expect(page.getByRole('button', { name: 'Use Studio nib brush', exact: true })).toBeVisible();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export pack', exact: true }).click(); const pack = await readFile((await (await download).path())!, 'utf8'); expect(JSON.parse(pack).brushes[0].brush.opacity).toBe(0.73);
  await page.reload(); await page.getByRole('button', { name: 'All projects', exact: true }).first().click().catch(() => {}); await page.locator('.home-project-card').filter({ has: page.getByRole('heading', { name: 'Brushes & Paint acceptance', exact: true }) }).locator('.project-open').click(); await page.getByRole('button', { name: 'Draw tool', exact: true }).click(); await page.getByLabel('Brush category').selectOption('Custom'); await expect(page.getByRole('button', { name: 'Use Studio nib brush', exact: true })).toBeVisible(); await expect(page.getByLabel('Paint opacity')).toHaveValue('73'); await expect(page.getByLabel('Paint size')).toHaveValue('28');
  await page.getByText('Custom presets & brush packs', { exact: true }).click(); await page.getByLabel('Import Luno brush pack').setInputFiles({ name: 'brush.lunobrush', mimeType: 'application/json', buffer: Buffer.from(pack) }); await expect(page.getByRole('button', { name: 'Use Studio nib brush', exact: true })).toHaveCount(2);
});

test('stroke stack recolor/delete is undoable and does not change copied frames', async ({ page }) => {
  await open(page); await color(page, '#ff0000'); await stroke(page, 20, 64, 96, 64); await page.keyboard.press('F6'); await page.getByText('Stroke stack', { exact: false }).click(); await setInput(page, 'Recolor paint mark 1', '#00ff00'); let project = await live(page); expect(project.items[0].cels![0].strokes[0].color).toBe('#ff0000'); expect(project.items[0].cels![1].strokes[0].color).toBe('#00ff00'); await page.getByRole('button', { name: 'Use Pixel Square brush', exact: true }).click(); await page.getByRole('button', { name: 'Apply brush to paint mark 1', exact: true }).click(); project = await live(page); expect(project.items[0].cels![1].strokes[0].brush?.kind).toBe('pixel'); expect(project.items[0].cels![0].strokes[0].brush?.kind).toBe('round'); await page.getByRole('button', { name: 'Delete paint mark 1', exact: true }).click(); project = await live(page); expect(project.items[0].cels![1].strokes).toHaveLength(0); await page.keyboard.press('Control+z'); expect((await live(page)).items[0].cels![1].strokes[0].color).toBe('#00ff00');
});

test('vector and video documents can paint without losing their other animation channels', async ({ page }) => {
  const p = paintDocument('rigged'); p.items = []; await open(page, p); await page.getByLabel('Drawing mode').selectOption('vector'); await page.getByRole('button', { name: 'Use Calligraphy brush', exact: true }).click(); await stroke(page, 20, 30, 98, 75); let project = await live(page); expect(project.items[0].type).toBe('path'); expect(project.items[0].brush?.kind).toBe('flat'); await page.getByRole('button', { name: 'Select tool', exact: true }).click(); await expect(page.getByLabel('Vector paint color')).toBeVisible(); await setInput(page, 'Vector paint color', '#00ff00'); expect((await live(page)).items[0].stroke).toBe('#00ff00');
  const video = paintDocument('video-editing'); const layer = video.items[0]; layer.holdCels = true; video.keyframes[layer.id] = [{ id: 'old-pose', frame: 0, easing: 'linear', values: { rotation: 10, opacity: 0.7 } }]; await open(page, video); await page.getByLabel('Drawing mode').selectOption('cel'); await stroke(page, 20, 30, 98, 75); project = await live(page); expect(project.animationMode).toBe('video-editing'); expect(project.keyframes[layer.id]).toEqual(video.keyframes[layer.id]); expect(project.items[0].cels![0].strokes[0].brush).toBeDefined();
});


test('painting menus and keyboard commands reveal Brush Studio in a compact workspace', async ({ page }) => {
  await open(page); await page.setViewportSize({ width: 760, height: 768 }); await page.getByRole('button', { name: 'Select tool', exact: true }).click(); await page.getByTestId('stage').focus(); await page.keyboard.press('Control+Shift+b'); await expect(page.getByTestId('brush-studio')).toBeVisible();
  await page.getByRole('button', { name: 'Close panel overlay', exact: true }).click(); await page.setViewportSize({ width: 1440, height: 950 }); await page.getByRole('menuitem', { name: 'Paint', exact: true }).click(); await page.getByRole('menuitem', { name: 'Brush: Graphite', exact: true }).click(); await expect(page.getByRole('button', { name: 'Use Graphite brush', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Brush grain')).toBeHidden(); await page.getByText('Dynamics & texture', { exact: true }).click(); await expect(page.getByLabel('Brush grain')).toBeVisible(); await expect(page.getByLabel('Brush angle')).toHaveCount(0); await page.getByRole('button', { name: 'Use Pixel Square brush', exact: true }).click(); await expect(page.getByLabel('Stroke smoothing')).toHaveCount(0); await expect(page.getByLabel('Pixel cell size')).toBeVisible();
});

test('real browser pen events preserve pressure and snapshot brush settings for the whole gesture', async ({ page, context }) => {
  await open(page); await page.getByRole('button', { name: 'Use Smooth Ink brush', exact: true }).click(); const session = await context.newCDPSession(page), a = await coords(page, 24, 48), b = await coords(page, 58, 64), c = await coords(page, 98, 48);
  try {
    await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x, y: a.y, pointerType: 'pen' }); await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a.x, y: a.y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen', force: 0.2 });
    await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, button: 'left', buttons: 1, pointerType: 'pen', force: 0.9 }); await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y, button: 'left', buttons: 1, pointerType: 'pen', force: 0.5 }); await setInput(page, 'Paint opacity', '15'); await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' });
  } finally { await session.detach(); }
  const mark = (await live(page)).items[0].cels![0].strokes[0]; expect(mark.brush?.kind).toBe('ink'); expect(mark.brush?.opacity).toBe(1); await expect(page.getByLabel('Paint opacity')).toHaveValue('15'); expect(mark.brush?.sizePressure).toBe(true); expect(mark.points.some(p => (p.pressure ?? 1) < 0.3)).toBe(true); expect(mark.points.some(p => (p.pressure ?? 1) > 0.8)).toBe(true); expect(await history(page)).toBe(1);
});

test('paint tools draw at the canvas corners without grabbing transform handles', async ({ page }) => {
  await open(page); await expect(page.getByTestId('scale-handle-0')).toHaveCount(0); await stroke(page, 1, 1, 28, 20); expect((await live(page)).items[0].cels![0].strokes).toHaveLength(1); await page.getByRole('button', { name: 'Select tool', exact: true }).click(); await expect(page.getByTestId('scale-handle-0')).toBeVisible();
});


test('color-plane alternatives and painting tabs support keyboard navigation', async ({ page }) => {
  await open(page); const library = page.getByRole('tab', { name: 'Brush library', exact: true }), color = page.getByRole('tab', { name: 'Color studio', exact: true }); await library.focus(); await library.press('ArrowRight'); await expect(color).toBeFocused(); await expect(color).toHaveAttribute('aria-selected', 'true'); await expect(page.getByLabel('Color saturation')).toBeVisible(); await page.getByLabel('Color saturation').focus(); await page.keyboard.press('Home'); await expect(page.getByLabel('Color saturation')).toHaveValue('0'); await color.focus(); await color.press('Home'); await expect(library).toBeFocused(); await expect(page.getByLabel('Search brushes')).toBeVisible();
});
