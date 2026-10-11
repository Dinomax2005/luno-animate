import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createItem, createProject } from '../src/engine/project';
import { encodeLam, decodeLam } from '../src/engine/lam';
import { APP_VERSION } from '../src/config/version';

async function start(page: Page) {
  await page.goto('/'); const news = page.getByRole('dialog', { name: 'What’s New', exact: true }); await expect(news).toBeVisible(); await news.getByRole('button', { name: 'Continue', exact: true }).click(); return page.getByRole('dialog', { name: 'Luno Animate — Start' });
}
async function frame(page: Page, value: number) {
  const slider = page.getByRole('slider', { name: 'Timeline playhead' }); const current = Number(await slider.getAttribute('aria-valuenow')); await slider.focus();
  for (let n = 0; n < Math.abs(value - current); n++) await slider.press(value > current ? 'ArrowRight' : 'ArrowLeft'); await expect(slider).toHaveAttribute('aria-valuenow', String(value));
}
async function exportLam(page: Page) {
  await page.getByRole('button', { name: 'Export', exact: true }).click(); await page.getByRole('button', { name: '.LAM Editable document', exact: true }).click(); const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export project', exact: true }).click(); const file = await download; return decodeLam(await readFile((await file.path())!));
}
async function videoDocument(page: Page) {
  const dialog = await start(page); await dialog.getByRole('button', { name: 'Video editing', exact: false }).click(); const create = page.getByRole('dialog', { name: 'Create a new project' }); await expect(create.getByLabel('New document width')).toHaveValue('1920'); await expect(create.getByLabel('New project frame rate')).toHaveValue('30'); await create.getByLabel('New document width').fill('128'); await create.getByLabel('New document height').fill('72'); await create.getByLabel('Project name').fill('Footage study'); await create.getByRole('button', { name: 'Create project', exact: true }).click(); await expect(page.getByTestId('stage')).toBeVisible(); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
}

test('shows the compact blue startup popup before the version-aware workspace and all three document types', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' }); await expect(page.getByText('Starting up Luno Animations', { exact: true })).toBeVisible();
  const news = page.getByRole('dialog', { name: 'What’s New', exact: true }); await expect(news).toBeVisible(); await expect(news).toContainText(APP_VERSION); await expect(page.getByTestId('startup-popup')).toHaveCount(0);
  await news.getByRole('button', { name: 'Continue', exact: true }).click(); const launch = page.getByRole('dialog', { name: 'Luno Animate — Start' }); await expect(launch.getByRole('button', { name: 'Video editing', exact: false })).toBeVisible(); await expect(launch.getByRole('button', { name: 'Hand-drawn', exact: false })).toBeVisible(); await expect(launch.getByRole('button', { name: 'Rig / motion', exact: false })).toBeVisible();
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()); expect(accent).toBe('#77b8ff');
});

test('edits real property keys, exportable effects, and accessible custom Bézier handles in the motion studio', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); const launch = await start(page); await launch.getByRole('button', { name: 'All projects', exact: true }).click();
  const p = createProject('blank'); p.name = 'Motion study'; p.width = p.height = 128; p.camera.x = p.camera.y = 64; p.fps = 10; p.duration = 20; p.workArea.end = 19; p.items = [createItem('shape', { name: 'Orbit', shape: 'ellipse', x: 32, y: 64, width: 24, height: 24, fill: '#ef6373' })];
  await page.getByLabel('Open Luno project file').setInputFiles({ name: 'motion.lam', mimeType: 'application/vnd.luno.lam', buffer: Buffer.from(encodeLam(p)) }); await expect(page.getByText('Motion / layer studio', { exact: true })).toBeVisible(); await expect(page.locator('.motion-clip')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add X keyframe', exact: true }).click(); await frame(page, 10); await page.getByLabel('X', { exact: true }).fill('96'); await page.getByLabel('X', { exact: true }).press('Enter'); await expect(page.getByRole('button', { name: 'Remove X keyframe', exact: true })).toBeVisible();
  await page.locator('.inspector-tabs').getByRole('button', { name: 'Effects', exact: true }).click(); await page.getByLabel('Blur', { exact: true }).fill('4'); await page.getByLabel('Blur', { exact: true }).press('Enter'); await expect(page.locator('[data-item-id] feGaussianBlur')).toHaveAttribute('stdDeviation', '4');
  await page.locator('.inspector-tabs').getByRole('button', { name: /^Motion/ }).click(); await page.getByLabel('Keyframe easing').selectOption('bezier'); const handle = page.getByRole('slider', { name: 'Bézier control 1' }); await expect(handle).toBeVisible(); await handle.press('ArrowRight'); await expect(page.getByLabel('Bezier X1', { exact: true })).toHaveValue('0.47');
  const saved = await exportLam(page); expect(saved.animationMode).toBe('rigged'); expect(saved.keyframes[p.items[0].id].some(k => k.values.x === 96 && k.values.blur === 4 && k.bezier?.[0] === 0.47)).toBe(true); expect(errors).toEqual([]);
});

test('imports actual VP8/Opus footage, splits linked audio, trims, saves and reopens an editable video document', async ({ page }) => {
  test.setTimeout(90_000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await videoDocument(page);
  await page.getByLabel('Import video file').setInputFiles('tests/fixtures/red-green-tone.webm'); await expect(page.getByRole('dialog', { name: 'Importing video', exact: true })).toHaveCount(0, { timeout: 45_000 }); await expect(page.getByText('Footage imported as an embedded proxy.', { exact: false })).toBeVisible(); await expect(page.locator('.motion-clip.video')).toHaveCount(1); await expect(page.locator('.audio-clip')).toHaveCount(1); await expect(page.locator('.document-animation-mode')).toHaveText('VIDEO');
  await frame(page, 16);
  const color = await page.getByTestId('stage').locator('.art-item image').getAttribute('href'); const pixel = await page.evaluate(async url => { const img = new Image(); img.src = url!; await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0); return Array.from(ctx.getImageData(64, 36, 1, 1).data); }, color); expect(pixel[1]).toBeGreaterThan(200); expect(pixel[0]).toBeLessThan(50);
  await page.locator('.inspector-tabs').getByRole('button', { name: 'Timing', exact: true }).click(); await expect(page.getByText('EMBEDDED VIDEO PROXY', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Split at playhead', exact: true }).click(); await expect(page.locator('.motion-clip.video')).toHaveCount(2); await expect(page.locator('.audio-clip')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.locator('.motion-clip.video')).toHaveCount(1); await expect(page.locator('.audio-clip')).toHaveCount(1);
  await page.getByRole('button', { name: 'Trim end to playhead', exact: true }).click(); await expect(page.locator('.clip-range-summary')).toContainText('016');
  const body = page.getByRole('button', { name: 'Move red-green-tone clip', exact: true }); const box = (await body.boundingBox())!, track = (await page.locator('.timeline-track').first().boundingBox())!; await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + track.width / 29 * 4, box.y + box.height / 2, { steps: 6 }); await page.mouse.up(); await expect(page.getByLabel('Clip start', { exact: true })).toHaveValue('5'); await page.getByRole('button', { name: 'Fade in', exact: false }).click();
  const saved = await exportLam(page); expect(saved.animationMode).toBe('video-editing'); expect(saved.media).toHaveLength(1); expect(saved.media[0].frames.length).toBeGreaterThanOrEqual(30); expect(saved.items[0]).toMatchObject({ startFrame: 4, endFrame: 20 }); expect(saved.audio[0]).toMatchObject({ startFrame: 4, endFrame: 20 }); expect(saved.keyframes[saved.items[0].id][0].values.opacity).toBe(0); expect(saved.items[0].linkedAudioId).toBe(saved.audio[0].id);
  await page.getByLabel('Open Luno project file').setInputFiles({ name: 'saved-video.lam', mimeType: 'application/vnd.luno.lam', buffer: Buffer.from(encodeLam(saved)) }); await expect(page.getByLabel('Project name')).toHaveValue('Footage study (imported)'); await expect(page.locator('.motion-clip.video')).toHaveCount(1); expect(errors).toEqual([]);
});

test('cancels video import before decoding without adding layers or modifying the source', async ({ page }) => {
  await videoDocument(page); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/src/services/video-import.ts*', async route => { await gate; await route.continue(); });
  const upload = page.getByLabel('Import video file').setInputFiles('tests/fixtures/red-green-tone.webm'); const busy = page.getByRole('dialog', { name: 'Importing video' }); await expect(busy).toBeVisible(); await busy.getByRole('button', { name: 'Cancel import', exact: true }).click(); release(); await upload; await expect(busy).toHaveCount(0); await expect(page.locator('.motion-clip.video')).toHaveCount(0); await expect(page.locator('.audio-clip')).toHaveCount(0); await expect(page.getByText('Video import cancelled. No clips were added.', { exact: true })).toBeVisible();
});


test('exports imported footage and its linked sound as a genuinely playable, non-silent MP4', async ({ page }) => {
  test.setTimeout(90_000); await videoDocument(page); await page.getByLabel('Import video file').setInputFiles('tests/fixtures/red-green-tone.webm'); await expect(page.locator('.motion-clip.video')).toHaveCount(1, { timeout: 45_000 });
  await page.getByRole('button', { name: 'Export', exact: true }).click(); const button = page.getByRole('button', { name: 'Export MP4', exact: true }); await expect(button).toBeEnabled(); const download = page.waitForEvent('download'); await button.click(); const bytes = await readFile((await (await download).path())!); expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
  const media = await page.evaluate(async data => {
    const toolkit = await (new Function('return import("/node_modules/.vite/deps/mediabunny.js")')() as Promise<typeof import('mediabunny')>); const input = new toolkit.Input({ source: new toolkit.BlobSource(new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))])), formats: toolkit.ALL_FORMATS });
    try { const track = (await input.getPrimaryVideoTrack())!, sink = new toolkit.CanvasSink(track); const first = (await sink.getCanvas(0))!, firstPixel = Array.from(first.canvas.getContext('2d')!.getImageData(64, 36, 1, 1).data); const last = (await sink.getCanvas(0.9))!, lastPixel = Array.from(last.canvas.getContext('2d')!.getImageData(64, 36, 1, 1).data); const audio = (await input.getPrimaryAudioTrack())!; let squares = 0, samples = 0; for await (const chunk of new toolkit.AudioBufferSink(audio).buffers()) for (const v of chunk.buffer.getChannelData(0)) { squares += v * v; samples++; } return { width: track.displayWidth, height: track.displayHeight, duration: await input.computeDuration(), firstPixel, lastPixel, rms: Math.sqrt(squares / samples) }; }
    finally { input.dispose(); }
  }, bytes.toString('base64')); expect(media.width).toBe(128); expect(media.height).toBe(72); expect(media.duration).toBeCloseTo(1, 1); expect(media.firstPixel[0]).toBeGreaterThan(200); expect(media.lastPixel[1]).toBeGreaterThan(200); expect(media.rms).toBeGreaterThan(0.05);
});

test('rejects malformed footage atomically and keeps the video document editable', async ({ page }) => {
  await videoDocument(page); await page.getByLabel('Import video file').setInputFiles({ name: 'broken.mp4', mimeType: 'video/mp4', buffer: Buffer.from('not a video') }); await expect(page.getByRole('dialog', { name: 'Importing video' })).toHaveCount(0); await expect(page.getByText(/unsupported or unrecognizable format/)).toBeVisible(); await expect(page.locator('.motion-clip.video')).toHaveCount(0); await expect(page.locator('.audio-clip')).toHaveCount(0); await page.getByLabel('Project name').fill('Still editable'); await page.getByLabel('Project name').press('Enter'); await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  const oversized = await page.evaluate(async () => { const { importVideo } = await (new Function('return import("/src/services/video-import.ts")')() as Promise<typeof import('../src/services/video-import')>); const f = new File([], 'big.mp4'); Object.defineProperty(f, 'size', { value: 150_000_001 }); try { await importVideo(f, {} as never, 0, () => {}, new AbortController().signal); } catch (e) { return (e as Error).message; } return ''; }); expect(oversized).toContain('150 MB');
});

test('aborts an active decoder cleanly without producing a partial asset', async ({ page }) => {
  await videoDocument(page); const data = (await readFile('tests/fixtures/red-green-tone.webm')).toString('base64');
  const result = await page.evaluate(async data => {
    const { importVideo } = await (new Function('return import("/src/services/video-import.ts")')() as Promise<typeof import('../src/services/video-import')>), { createProject } = await (new Function('return import("/src/engine/project.ts")')() as Promise<typeof import('../src/engine/project')>); const abort = new AbortController(); let decoded = 0;
    try { await importVideo(new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], 'active.webm', { type: 'video/webm' }), createProject('blank', 'video-editing'), 0, value => { if (value > 0) { decoded++; abort.abort(); } }, abort.signal); return { decoded, message: 'unexpected success' }; }
    catch (e) { return { decoded, message: (e as Error).message }; }
  }, data); expect(result.decoded).toBe(1); expect(result.message).toBe('Video import cancelled.'); await expect(page.locator('.motion-clip.video')).toHaveCount(0);
});

test('explains unavailable codecs and leaves all source layers untouched', async ({ page }) => {
  await page.addInitScript(() => { const probe = VideoDecoder.isConfigSupported.bind(VideoDecoder); VideoDecoder.isConfigSupported = config => config.codec === 'vp8' ? Promise.resolve({ supported: false, config }) : probe(config); });
  await videoDocument(page); await page.getByLabel('Import video file').setInputFiles('tests/fixtures/red-green-tone.webm'); await expect(page.getByText('This device cannot decode this video codec.', { exact: false })).toBeVisible(); await expect(page.getByRole('dialog', { name: 'Importing video' })).toHaveCount(0); await expect(page.locator('.motion-clip.video')).toHaveCount(0); await expect(page.locator('.audio-clip')).toHaveCount(0);
});
