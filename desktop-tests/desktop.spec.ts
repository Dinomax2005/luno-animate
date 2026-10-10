import { _electron as electron, test, expect } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('packaged app opens, isolates Node, saves/opens files, exports, and remembers setup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'luno-desktop-test-'));
  const executablePath = process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE ? resolve(process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE) : undefined;
  const args = [...(executablePath ? [] : ['.']), ...(process.platform === 'linux' ? ['--no-sandbox'] : [])];
  const launch = (extra: string[] = []) => electron.launch({ executablePath, args: [...args, ...extra], cwd: process.cwd(), env: { ...process.env, LUNO_DEV_URL: '' } });
  const app = await launch();
  let restarted: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    const page = await app.firstWindow();
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await expect(page.getByRole('dialog', { name: 'Set up your Luno studio' })).toBeVisible();
    const isolation = await page.evaluate(() => ({ bridge: typeof window.luno?.saveProject, require: typeof (window as unknown as { require?: unknown }).require }));
    expect(isolation).toEqual({ bridge: 'function', require: 'undefined' });
    if (executablePath) expect(await app.evaluate(({ app: nativeApp }) => nativeApp.isPackaged)).toBe(true);
    await app.evaluate(({ dialog }, folder) => {
      dialog.showSaveDialog = (async (_window, options) => ({ canceled: false, filePath: `${folder}/Native file.${options.filters?.[0].extensions[0] ?? 'luno'}` })) as typeof dialog.showSaveDialog;
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [`${folder}/Native file.luno`] })) as typeof dialog.showOpenDialog;
    }, directory);
    await page.getByRole('button', { name: 'I’ll explore on my own' }).click();
    await page.getByLabel('Project name').fill('Native little creation'); await page.getByLabel('Project name').press('Enter');
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await page.getByRole('button', { name: 'Save a copy…', exact: false }).click();
    await expect(page.getByText('Your editable .luno project is saved.')).toBeVisible();
    const raw = await readFile(join(directory, 'Native file.luno'), 'utf8');
    expect(JSON.parse(raw).name).toBe('Native little creation');
    await page.getByLabel('Project name').fill('A temporary edit'); await page.getByLabel('Project name').press('Enter');
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await page.getByRole('button', { name: 'Open project…', exact: false }).click();
    await expect(page.getByLabel('Project name')).toHaveValue('Native little creation');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.locator('.format-button').filter({ hasText: 'PNG' }).click();
    await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
    await expect(page.getByText('Your PNG is saved.')).toBeVisible();
    const png = await readFile(join(directory, 'Native file.png')); expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(960); expect(errors).toEqual([]);
    await app.close();
    restarted = await launch([join(directory, 'Native file.luno')]);
    const restored = await restarted.firstWindow();
    await expect(restored.getByTestId('stage')).toBeVisible();
    await expect(restored.getByRole('dialog')).toHaveCount(0);
    await expect(restored.getByLabel('Project name')).toHaveValue('Native little creation');
  } finally {
    await restarted?.close().catch(() => {});
    await app.close().catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
