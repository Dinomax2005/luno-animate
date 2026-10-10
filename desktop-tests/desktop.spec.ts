import { _electron as electron, test, expect } from '@playwright/test';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decodeLam, encodeLam } from '../src/engine/lam';
import { movie, sound } from '../tests/fixtures/media';

test('packaged app: safe bridge, native library, LAM association, backups, real MP4 audio, and restart', async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(join(tmpdir(), 'luno-desktop-test-')); const profile = join(directory, 'profile'); await mkdir(profile);
  const executablePath = process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE ? resolve(process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE) : undefined;
  const args = [...(executablePath ? [] : ['.']), ...(process.platform === 'linux' ? ['--no-sandbox'] : [])];
  const launch = (extra: string[] = []) => electron.launch({ executablePath, args: [...args, ...extra], cwd: process.cwd(), env: { ...process.env, LUNO_DEV_URL: '', LUNO_DISABLE_UPDATES: '1', LUNO_TEST_USER_DATA: profile } });
  const app = await launch(); let restarted: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    const page = await app.firstWindow(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await expect(page.getByRole('dialog', { name: 'Set up your Luno studio' })).toBeVisible();
    expect(await page.evaluate(() => ({ bridge: typeof window.luno?.saveProject, require: typeof (window as unknown as { require?: unknown }).require }))).toEqual({ bridge: 'function', require: 'undefined' });
    if (executablePath) expect(await app.evaluate(({ app: nativeApp }) => nativeApp.isPackaged)).toBe(true);
    expect(await app.evaluate(({ app: nativeApp }) => nativeApp.getPath('userData'))).toBe(profile);
    await app.evaluate(({ dialog }, folder) => {
      dialog.showSaveDialog = (async (_window, options) => ({ canceled: false, filePath: `${folder}/Native file.${options.filters?.[0].extensions[0] ?? 'lam'}` })) as typeof dialog.showSaveDialog;
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [`${folder}/Native file.lam`] })) as typeof dialog.showOpenDialog;
    }, directory);
    await page.getByRole('button', { name: 'I’ll explore on my own' }).click(); await expect(page.locator('.home-project-card')).toHaveCount(0);
    await page.getByRole('button', { name: 'Make a little magic', exact: false }).click(); await expect(page.getByTestId('stage')).toBeVisible();
    await page.getByLabel('Project name').fill('Native little creation'); await page.getByLabel('Project name').press('Enter');
    await page.getByRole('button', { name: 'File', exact: true }).click(); await page.getByRole('button', { name: 'Export .lam project…', exact: false }).click(); await expect(page.getByText('Your portable .lam project is saved', { exact: false })).toBeVisible();
    const lam = await readFile(join(directory, 'Native file.lam')); expect(decodeLam(lam).name).toBe('Native little creation'); expect(lam.subarray(0, 7).toString()).toBe('LUNOLAM');
    await page.getByLabel('Project name').fill('A temporary edit'); await page.getByLabel('Project name').press('Enter'); await page.getByRole('button', { name: 'File', exact: true }).click(); await page.getByRole('button', { name: 'Open project…', exact: false }).click(); await expect(page.getByLabel('Project name')).toHaveValue('Native little creation (imported)');
    await page.getByRole('button', { name: 'Export', exact: true }).click(); await page.getByRole('button', { name: 'PNG A still moment', exact: true }).click(); await page.getByRole('button', { name: 'Export PNG', exact: true }).click(); await expect(page.getByText('Your PNG is saved.', { exact: false })).toBeVisible(); const png = await readFile(join(directory, 'Native file.png')); expect(png.subarray(1, 4).toString()).toBe('PNG'); expect(png.readUInt32BE(16)).toBe(960);
    await page.getByRole('button', { name: 'Back to all projects' }).click(); await expect(page.locator('.home-project-card')).toHaveCount(2); await page.getByRole('button', { name: 'Updates & backups', exact: false }).click(); const updates = page.getByRole('dialog', { name: 'Updates and protected backups' }); await updates.getByRole('button', { name: 'Back up now' }).click(); await expect(updates.locator('.backup-row')).toHaveCount(1); const backups = await page.evaluate(() => window.luno!.library.backups()); expect(backups[0].projects).toBe(2); await updates.getByRole('button', { name: 'Back to creating' }).click();
    const p = movie(); await page.getByLabel('Open Luno project file').setInputFiles({ name: 'movie.lam', mimeType: 'application/vnd.luno.lam', buffer: Buffer.from(encodeLam(p)) }); await page.getByLabel('Import audio file').setInputFiles({ name: 'Tone.wav', mimeType: 'audio/wav', buffer: sound() }); await expect(page.getByText('Embedded sound · 1.00s')).toBeVisible(); await page.getByRole('button', { name: 'Export', exact: true }).click(); await expect(page.getByRole('button', { name: 'Export MP4', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Export MP4', exact: true }).click(); await expect(page.getByText('Your MP4 is saved.', { exact: false })).toBeVisible(); const mp4 = await readFile(join(directory, 'Native file.mp4')); expect(mp4.subarray(4, 8).toString()).toBe('ftyp');
    const video = await page.evaluate(async base64 => { const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); const blob = new Blob([bytes], { type: 'video/mp4' }); const v = document.createElement('video'), url = URL.createObjectURL(blob); v.src = url; await new Promise<void>((resolve, reject) => { v.onloadedmetadata = () => resolve(); v.onerror = () => reject(new Error('Native MP4 playback failed')); }); const result = { width: v.videoWidth, height: v.videoHeight, duration: v.duration }; v.removeAttribute('src'); URL.revokeObjectURL(url); return result; }, mp4.toString('base64')); expect(video.width).toBe(64); expect(video.height).toBe(64); expect(video.duration).toBeCloseTo(1, 1);
    expect(await page.evaluate(async () => { try { await window.luno!.library.load('../escape'); return 'unsafe'; } catch { return 'blocked'; } })).toBe('blocked'); expect(errors).toEqual([]);
    await app.close(); restarted = await launch([join(directory, 'Native file.lam')]); const restored = await restarted.firstWindow(); await expect(restored.getByTestId('stage')).toBeVisible(); await expect(restored.getByRole('dialog')).toHaveCount(0); await expect(restored.getByLabel('Project name')).toHaveValue('Native little creation (imported)'); expect((await restored.evaluate(() => window.luno!.library.list())).length).toBe(4);
  } finally { await restarted?.close().catch(() => {}); await app.close().catch(() => {}); await rm(directory, { recursive: true, force: true }); }
});
