import { APP_VERSION } from '../src/config/version';
import { _electron as electron, test, expect, type ElectronApplication } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decodeLam, encodeLam } from '../src/engine/lam';
import { movie, sound } from '../tests/fixtures/media';

async function studioWindow(app: ElectronApplication) {
  await expect.poll(() => app.windows().some(page => /\/dist\/index\.html$/.test(page.url()))).toBe(true);
  const page = app.windows().find(page => /\/dist\/index\.html$/.test(page.url()))!;
  const native = await app.browserWindow(page);
  await expect.poll(() => native.evaluate(window => window.isVisible())).toBe(true);
  await native.dispose(); await expect(page.locator('.startup-screen')).toHaveCount(0); return page;
}

test('packaged app: safe bridge, native library, LAM association, backups, real MP4 audio, and restart', async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(join(tmpdir(), 'luno-desktop-test-')); const profile = join(directory, 'profile'); await mkdir(profile);
  const executablePath = process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE ? resolve(process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE) : undefined;
  const args = [...(executablePath ? [] : ['.']), ...(process.platform === 'linux' ? ['--no-sandbox'] : [])];
  const launch = (extra: string[] = []) => electron.launch({ executablePath, args: [...args, ...extra], cwd: process.cwd(), env: { ...process.env, LUNO_DEV_URL: '', LUNO_DISABLE_UPDATES: '1', LUNO_TEST_USER_DATA: profile } });
  const app = await launch(); let restarted: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    const page = await studioWindow(app); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const news = page.getByRole('dialog', { name: 'What’s New', exact: true }); await expect(news).toBeVisible(); await expect(news).toContainText(APP_VERSION);
    expect(await page.evaluate(() => ({ bridge: typeof window.luno?.documents?.save, require: typeof (window as unknown as { require?: unknown }).require }))).toEqual({ bridge: 'function', require: 'undefined' });
    if (executablePath) expect(await app.evaluate(({ app: nativeApp }) => nativeApp.isPackaged)).toBe(true);
    expect(await app.evaluate(({ app: nativeApp }) => nativeApp.getPath('userData'))).toBe(profile);
    await app.evaluate(({ dialog }, folder) => {
      (globalThis as unknown as { saveDialogCalls: number }).saveDialogCalls = 0;
      dialog.showSaveDialog = (async (_window, options) => { (globalThis as unknown as { saveDialogCalls: number }).saveDialogCalls++; return { canceled: false, filePath: `${folder}/Native file.${options.filters?.[0].extensions[0] ?? 'lam'}` }; }) as typeof dialog.showSaveDialog;
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [`${folder}/Native file.lam`] })) as typeof dialog.showOpenDialog;
    }, directory);
    await news.getByRole('button', { name: 'Continue', exact: true }).click(); await page.getByRole('dialog', { name: 'Luno Animate — Start' }).getByRole('button', { name: 'All projects', exact: true }).click(); await expect(page.locator('.home-project-card')).toHaveCount(0);
    { await page.getByRole('button', { name: 'Templates', exact: true }).click(); await page.getByRole('button', { name: 'Character animation', exact: false }).click(); } await expect(page.getByTestId('stage')).toBeVisible(); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
    await page.getByLabel('Project name').fill('Native little creation'); await page.getByLabel('Project name').press('Enter');
    await page.keyboard.press('Control+s'); await expect(page.getByText('Saved Native file.lam.', { exact: true })).toBeVisible(); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
    const lam = await readFile(join(directory, 'Native file.lam')), diskId = decodeLam(lam).id; expect(decodeLam(lam).name).toBe('Native little creation'); expect(lam.subarray(0, 7).toString()).toBe('LUNOLAM');
    for (const name of ['Direct first edit', 'Direct second edit']) {
      await page.getByLabel('Project name').fill(name); await page.getByLabel('Project name').press('Enter'); await page.keyboard.press('Control+s'); await expect(page.getByText('Saved Native file.lam.', { exact: true })).toBeVisible(); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false'); expect(decodeLam(await readFile(join(directory, 'Native file.lam'))).name).toBe(name);
    }
    expect(await app.evaluate(() => (globalThis as unknown as { saveDialogCalls: number }).saveDialogCalls)).toBe(1);
    await page.getByLabel('Project name').fill('A temporary edit'); await page.getByLabel('Project name').press('Enter'); await page.getByRole('menuitem', { name: 'File', exact: true }).click(); await page.getByRole('menuitem', { name: 'Open project…', exact: true }).click(); await expect(page.getByLabel('Project name')).toHaveValue('Direct second edit'); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
    await app.evaluate(({ dialog }) => { dialog.showSaveDialog = (async () => ({ canceled: true, filePath: '' })) as typeof dialog.showSaveDialog; });
    await page.getByLabel('Project name').fill('Cancellation kept the link'); await page.getByLabel('Project name').press('Enter'); await page.keyboard.press('Control+Shift+s'); await expect(page.getByText('Save cancelled.', { exact: false })).toBeVisible(); expect(decodeLam(await readFile(join(directory, 'Native file.lam'))).name).toBe('Direct second edit');
    await page.keyboard.press('Control+s'); await expect(page.getByText('Saved Native file.lam.', { exact: true })).toBeVisible(); const original = await readFile(join(directory, 'Native file.lam')); expect(decodeLam(original)).toMatchObject({ id: diskId, name: 'Cancellation kept the link' });
    await app.evaluate(({ dialog }, folder) => { dialog.showSaveDialog = (async () => ({ canceled: false, filePath: `${folder}/Chosen.lam` })) as typeof dialog.showSaveDialog; }, directory);
    await page.keyboard.press('Control+Shift+s'); await expect(page.getByText('Saved Chosen.lam.', { exact: true })).toBeVisible(); expect(decodeLam(await readFile(join(directory, 'Chosen.lam'))).id).not.toBe(diskId);
    await page.getByLabel('Project name').fill('Chosen revision'); await page.getByLabel('Project name').press('Enter'); await page.keyboard.press('Control+s'); await expect(page.getByText('Saved Chosen.lam.', { exact: true })).toBeVisible(); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false'); expect(await readFile(join(directory, 'Native file.lam'))).toEqual(original);
    const chosen = decodeLam(await readFile(join(directory, 'Chosen.lam'))), outside = encodeLam({ ...chosen, name: 'Changed outside Luno' }); await writeFile(join(directory, 'Chosen.lam'), outside);
    await page.getByLabel('Project name').fill('Stale editor changes'); await page.getByLabel('Project name').press('Enter'); await page.keyboard.press('Control+s'); await expect(page.locator('.document-save-error')).toContainText('changed on disk'); expect(await readFile(join(directory, 'Chosen.lam'))).toEqual(Buffer.from(outside));
    await app.evaluate(({ dialog }, folder) => { dialog.showSaveDialog = (async () => ({ canceled: false, filePath: `${folder}/Protected copy.lam` })) as typeof dialog.showSaveDialog; }, directory);
    await page.locator('.document-save-error').getByRole('button', { name: 'Save As…', exact: true }).click(); await expect(page.getByText('Saved Protected copy.lam.', { exact: true })).toBeVisible(); await expect(page.locator('.document-save-error')).toHaveCount(0); expect(await readFile(join(directory, 'Chosen.lam'))).toEqual(Buffer.from(outside));
    await app.evaluate(({ dialog }, folder) => { dialog.showSaveDialog = (async (_window, options) => ({ canceled: false, filePath: `${folder}/Native file.${options.filters?.[0].extensions[0] ?? 'lam'}` })) as typeof dialog.showSaveDialog; }, directory);
    await page.getByRole('button', { name: 'Export', exact: true }).click(); await page.getByRole('button', { name: 'PNG Raster image', exact: true }).click(); await page.getByRole('button', { name: 'Export PNG', exact: true }).click(); await expect(page.getByText('Your PNG is saved.', { exact: false })).toBeVisible(); const png = await readFile(join(directory, 'Native file.png')); expect(png.subarray(1, 4).toString()).toBe('PNG'); expect(png.readUInt32BE(16)).toBe(960);
    await page.getByRole('button', { name: 'Back to all projects' }).click(); await expect(page.locator('.home-project-card')).toHaveCount(2); await page.getByRole('button', { name: 'Updates & backups', exact: false }).click(); const updates = page.getByRole('dialog', { name: 'Updates and protected backups' }); await updates.getByRole('button', { name: 'Back up now' }).click(); await expect(updates.locator('.backup-row')).toHaveCount(1); const backups = await page.evaluate(() => window.luno!.library.backups()); expect(backups[0].projects).toBe(2); await updates.getByRole('button', { name: 'Close', exact: true }).click();
    const p = movie(); await page.getByLabel('Open Luno project file').setInputFiles({ name: 'movie.lam', mimeType: 'application/vnd.luno.lam', buffer: Buffer.from(encodeLam(p)) }); await expect(page.getByLabel('Project name')).toHaveValue(p.name); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false'); await page.getByLabel('Import audio file').setInputFiles({ name: 'Tone.wav', mimeType: 'audio/wav', buffer: sound() }); await expect(page.getByText('Embedded sound · 1.00s')).toBeVisible(); await page.getByRole('button', { name: 'Export', exact: true }).click(); await expect(page.getByRole('button', { name: 'Export MP4', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Export MP4', exact: true }).click(); await expect(page.getByText('Your MP4 is saved.', { exact: false })).toBeVisible(); const mp4 = await readFile(join(directory, 'Native file.mp4')); expect(mp4.subarray(4, 8).toString()).toBe('ftyp');
    const video = await page.evaluate(async base64 => {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)), blob = new Blob([bytes], { type: 'video/mp4' });
      const v = document.createElement('video'), url = URL.createObjectURL(blob); v.src = url; v.muted = true;
      await new Promise<void>((resolve, reject) => { v.onloadeddata = () => resolve(); v.onerror = () => reject(new Error('Native MP4 playback failed')); });
      const canvas = document.createElement('canvas'); canvas.width = v.videoWidth; canvas.height = v.videoHeight; const context = canvas.getContext('2d')!;
      const pixel = async (time: number) => { const sought = new Promise<void>(resolve => { v.onseeked = () => resolve(); }); v.currentTime = time; await sought; context.drawImage(v, 0, 0); return Array.from(context.getImageData(12, 32, 1, 1).data); };
      const first = await pixel(0.05), last = await pixel(0.95);
      const audio = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(bytes.buffer); const channel = audio.getChannelData(0); let sum = 0; for (const value of channel) sum += value * value;
      const result = { width: v.videoWidth, height: v.videoHeight, duration: v.duration, first, last, samples: channel.length, rms: Math.sqrt(sum / channel.length) }; v.removeAttribute('src'); URL.revokeObjectURL(url); return result;
    }, mp4.toString('base64'));
    expect(video.width).toBe(64); expect(video.height).toBe(64); expect(video.duration).toBeCloseTo(1, 1); expect(video.first[0]).toBeGreaterThan(200); expect(video.first[1]).toBeLessThan(50); expect(video.last[1]).toBeGreaterThan(200); expect(video.samples).toBeGreaterThan(40000); expect(video.rms).toBeGreaterThan(0.05);

    expect(await page.evaluate(async () => { try { await window.luno!.library.load('../escape'); return 'unsafe'; } catch { return 'blocked'; } })).toBe('blocked'); expect(errors).toEqual([]);
    await app.close(); restarted = await launch([join(directory, 'Native file.lam')]); const restored = await studioWindow(restarted); await expect(restored.getByTestId('stage')).toBeVisible(); await expect(restored.getByRole('dialog')).toHaveCount(0); await expect(restored.getByLabel('Project name')).toHaveValue('Cancellation kept the link'); expect((await restored.evaluate(() => window.luno!.library.list())).length).toBe(4);
  } finally { await restarted?.close().catch(() => {}); await app.close().catch(() => {}); await rm(directory, { recursive: true, force: true }); }
});


test('packaged eclipse/video studio imports real footage, writes portable proxies, and reopens linked edits', async () => {
  test.setTimeout(120_000); const directory = await mkdtemp(join(tmpdir(), 'luno-video-desktop-')), profile = join(directory, 'profile'); await mkdir(profile);
  const executablePath = process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE ? resolve(process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE) : undefined;
  const args = [...(executablePath ? [] : ['.']), ...(process.platform === 'linux' ? ['--no-sandbox'] : [])];
  const launch = (extra: string[] = []) => electron.launch({ executablePath, args: [...args, ...extra], cwd: process.cwd(), env: { ...process.env, LUNO_DEV_URL: '', LUNO_DISABLE_UPDATES: '1', LUNO_TEST_USER_DATA: profile } });
  const app = await launch(); let reopened: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    const page = await studioWindow(app), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    const news = page.getByRole('dialog', { name: 'What’s New', exact: true }); await expect(news).toBeVisible(); await expect(news).toContainText(APP_VERSION);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    await news.getByRole('button', { name: 'Continue', exact: true }).click(); await page.getByRole('dialog', { name: 'Luno Animate — Start' }).getByRole('button', { name: 'Video editing', exact: false }).click();
    const create = page.getByRole('dialog', { name: 'Create a new project' }); await expect(create.getByLabel('New document width')).toHaveValue('1920'); await create.getByLabel('New document width').fill('128'); await create.getByLabel('New document height').fill('72'); await create.getByLabel('Project name').fill('Native footage'); await create.getByRole('button', { name: 'Create project', exact: true }).click(); await expect(page.getByTestId('stage')).toBeVisible(); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
    const source = await readFile('tests/fixtures/red-green-tone.webm'); await page.getByLabel('Import video file').setInputFiles(resolve('tests/fixtures/red-green-tone.webm')); await expect(page.locator('.motion-clip.video')).toHaveCount(1, { timeout: 45_000 }); await expect(page.locator('.audio-clip')).toHaveCount(1);
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = (async () => ({ canceled: false, filePath: file })) as typeof dialog.showSaveDialog; }, join(directory, 'Studio.lam'));
    await page.keyboard.press('Control+s'); await expect(page.getByText('Saved Studio.lam.', { exact: true })).toBeVisible();
    const p = decodeLam(await readFile(join(directory, 'Studio.lam'))); expect(p.animationMode).toBe('video-editing'); expect(p.media[0].frames).toHaveLength(30); expect(p.items[0].linkedAudioId).toBe(p.audio[0].id);
    const slider = page.getByRole('slider', { name: 'Timeline playhead' }); await slider.focus(); for (let n = 0; n < 15; n++) await slider.press('ArrowRight'); await page.locator('.inspector-tabs').getByRole('button', { name: 'Timing', exact: true }).click(); await page.getByRole('button', { name: 'Split at playhead', exact: true }).click(); await expect(page.locator('.motion-clip.video')).toHaveCount(2); await page.keyboard.press('Control+s'); await expect(page.getByText('Saved Studio.lam.', { exact: true })).toBeVisible();
    const split = decodeLam(await readFile(join(directory, 'Studio.lam'))); expect(split.media).toHaveLength(1); expect(split.items).toHaveLength(2); expect(split.audio).toHaveLength(2); expect(await readFile('tests/fixtures/red-green-tone.webm')).toEqual(source); expect(errors).toEqual([]);
    await app.close(); reopened = await launch([join(directory, 'Studio.lam')]); const restored = await studioWindow(reopened); await expect(restored.getByTestId('stage')).toBeVisible(); await expect(restored.getByRole('dialog')).toHaveCount(0); await expect(restored.getByLabel('Project name')).toHaveValue('Native footage'); await expect(restored.locator('.motion-clip.video')).toHaveCount(2); await expect(restored.locator('.audio-clip')).toHaveCount(2);
  } finally { await reopened?.close().catch(() => {}); await app.close().catch(() => {}); await rm(directory, { recursive: true, force: true }); }
});


test('packaged startup: a small isolated native launcher closes before the real studio opens', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'luno-startup-test-')), profile = join(directory, 'profile'); await mkdir(profile);
  const executablePath = process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE ? resolve(process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE) : undefined;
  const app = await electron.launch({ executablePath, args: [...(executablePath ? [] : ['.']), ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], cwd: process.cwd(), env: { ...process.env, LUNO_DEV_URL: '', LUNO_DISABLE_UPDATES: '1', LUNO_TEST_USER_DATA: profile, LUNO_TEST_STARTUP_MS: '4000' } });
  try {
    const observed = await app.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows(), main = windows.find(w => /\/dist\/index\.html$/.test(w.webContents.getURL())), splash = windows.find(w => /\/electron\/startup\.html$/.test(w.webContents.getURL()));
      if (!main || !splash) throw new Error('The separate startup window was not created.');
      const events: string[] = []; (globalThis as unknown as { startupEvents: string[] }).startupEvents = events;
      splash.once('closed', () => events.push('splash closed')); main.once('show', () => events.push('studio shown'));
      return { mainVisible: main.isVisible(), bounds: splash.getBounds(), mainId: main.id, splashId: splash.id };
    });
    expect(observed.mainVisible).toBe(false); expect(observed.bounds.width).toBe(460); expect(observed.bounds.height).toBe(282); expect(observed.mainId).not.toBe(observed.splashId);
    await expect.poll(() => app.windows().some(page => /\/electron\/startup\.html$/.test(page.url()))).toBe(true);
    const splash = app.windows().find(page => /\/electron\/startup\.html$/.test(page.url()))!;
    await expect(splash.getByText('Starting up Luno Animations', { exact: true })).toBeVisible(); await expect(splash.locator('#version')).toHaveText(APP_VERSION);
    expect(await splash.evaluate(() => ({ require: typeof (window as unknown as { require?: unknown }).require, studio: typeof window.luno, retry: typeof (window as unknown as { lunoStartup: { retry: unknown } }).lunoStartup.retry }))).toEqual({ require: 'undefined', studio: 'undefined', retry: 'function' });
    const nativeSplash = await app.browserWindow(splash); await expect.poll(() => nativeSplash.evaluate(window => window.isVisible())).toBe(true); await nativeSplash.dispose();
    const page = await studioWindow(app); await expect(page.getByRole('dialog', { name: 'What’s New', exact: true })).toContainText(APP_VERSION);
    expect(await app.evaluate(() => (globalThis as unknown as { startupEvents: string[] }).startupEvents)).toEqual(['splash closed', 'studio shown']);
    expect(splash.isClosed()).toBe(true); await expect.poll(() => app.windows().length).toBe(1);
  } finally { await app.close().catch(() => {}); await rm(directory, { recursive: true, force: true }); }
});
