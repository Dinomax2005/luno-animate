import { expect, test, type Page } from '@playwright/test';
import { APP_VERSION } from '../src/config/version';
import { createProject } from '../src/engine/project';
import { decodeLam, encodeLam } from '../src/engine/lam';

type FileFixture = { files: Record<string, { bytes: number[]; modified: number }>; pickerCalls: number; writes: number; cancel: boolean };
const fixture = (page: Page) => page.evaluate(() => (window as unknown as { fileFixture: FileFixture }).fileFixture);
async function installPicker(page: Page) {
  const p = createProject('character'); p.name = 'Approved document';
  await page.addInitScript(({ bytes, version }) => {
    localStorage.setItem('luno.launch.v1', JSON.stringify({ seenVersion: version, showStart: false }));
    const state = { files: { 'Original.lam': { bytes, modified: 1 }, 'Chosen.lam': { bytes: [] as number[], modified: 1 } } as Record<string, { bytes: number[]; modified: number }>, pickerCalls: 0, writes: 0, cancel: false };
    (window as unknown as { fileFixture: typeof state }).fileFixture = state;
    const handle = (name: string) => ({
      name, getFile: async () => new File([new Uint8Array(state.files[name].bytes)], name, { lastModified: state.files[name].modified }),
      queryPermission: async () => 'granted' as const,
      createWritable: async () => {
        let staged: Uint8Array;
        return { write: async (data: Uint8Array) => { staged = data; }, close: async () => { state.files[name] = { bytes: [...staged], modified: state.files[name].modified + 1 }; state.writes++; }, abort: async () => {} };
      },
    });
    window.showOpenFilePicker = async () => [handle('Original.lam')];
    window.showSaveFilePicker = async () => { state.pickerCalls++; if (state.cancel) throw new DOMException('Cancelled', 'AbortError'); return handle('Chosen.lam'); };
  }, { bytes: [...encodeLam(p)], version: APP_VERSION });
  await page.goto('/'); await page.getByRole('button', { name: 'Open…', exact: true }).click(); await expect(page.getByLabel('Project name')).toHaveValue(p.name); return p;
}
async function rename(page: Page, name: string) { await page.getByLabel('Project name').fill(name); await page.getByLabel('Project name').press('Enter'); }
async function save(page: Page, name: string, as = false) { await page.keyboard.press(as ? 'Control+Shift+s' : 'Control+s'); await expect(page.getByText(`Saved ${name}.`, { exact: true })).toBeVisible(); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false'); await expect(page.getByLabel('Unsaved file changes')).toHaveCount(0); }

test('Save repeatedly updates the opened handle; Save As changes only the explicit new destination', async ({ page }) => {
  const p = await installPicker(page); await rename(page, 'First direct edit'); await expect(page.getByLabel('Unsaved file changes')).toHaveText('*');
  await save(page, 'Original.lam'); await rename(page, 'Second direct edit'); await save(page, 'Original.lam');
  const first = await fixture(page); expect(first.pickerCalls).toBe(0); expect(first.writes).toBe(2); expect(decodeLam(new Uint8Array(first.files['Original.lam'].bytes))).toMatchObject({ id: p.id, name: 'Second direct edit' });
  await expect(page.getByLabel('Unsaved file changes')).toHaveCount(0); await page.getByRole('menuitem', { name: 'File', exact: true }).click(); await page.getByRole('menuitem', { name: 'Save As…', exact: true }).click(); await expect(page.getByText('Saved Chosen.lam.', { exact: true })).toBeVisible();
  await rename(page, 'New destination edit'); await save(page, 'Chosen.lam'); const after = await fixture(page);
  expect(after.pickerCalls).toBe(1); expect(decodeLam(new Uint8Array(after.files['Chosen.lam'].bytes)).name).toBe('New destination edit'); expect(after.files['Original.lam'].bytes).toEqual(first.files['Original.lam'].bytes);
});

test('collision-safe import links, cancelled Save As, visible external conflicts, and safe recovery to a new file', async ({ page }) => {
  const p = await installPicker(page); await page.keyboard.press('Control+o'); await expect(page.getByLabel('Project name')).toHaveValue(p.name); await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  await rename(page, 'Collision-safe edit'); await save(page, 'Original.lam'); expect(decodeLam(new Uint8Array((await fixture(page)).files['Original.lam'].bytes)).id).toBe(p.id);
  await page.evaluate(() => { (window as unknown as { fileFixture: FileFixture }).fileFixture.cancel = true; }); await rename(page, 'Cancellation kept the link'); await page.keyboard.press('Control+Shift+s'); await expect(page.getByText('Save cancelled.', { exact: false })).toBeVisible();
  expect(decodeLam(new Uint8Array((await fixture(page)).files['Original.lam'].bytes)).name).toBe('Collision-safe edit'); await save(page, 'Original.lam'); expect(decodeLam(new Uint8Array((await fixture(page)).files['Original.lam'].bytes)).name).toBe('Cancellation kept the link');
  const external = [...encodeLam({ ...p, name: 'External change' })];
  await page.evaluate(bytes => { const s = (window as unknown as { fileFixture: FileFixture }).fileFixture; s.files['Original.lam'] = { bytes, modified: s.files['Original.lam'].modified + 1 }; s.cancel = false; }, external);
  await rename(page, 'Stale editor changes'); await page.keyboard.press('Control+s'); const error = page.locator('.document-save-error'); await expect(error).toContainText('changed on disk'); expect((await fixture(page)).files['Original.lam'].bytes).toEqual(external);
  await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click(); await expect(error).toBeVisible(); await error.getByRole('button', { name: 'Save As…', exact: true }).click(); await expect(page.getByText('Saved Chosen.lam.', { exact: true })).toBeVisible(); await expect(error).toHaveCount(0);
  const final = await fixture(page); expect(final.files['Original.lam'].bytes).toEqual(external); expect(decodeLam(new Uint8Array(final.files['Chosen.lam'].bytes)).name).toBe('Stale editor changes');
  expect(decodeLam(new Uint8Array(final.files['Chosen.lam'].bytes)).id).not.toBe(p.id);
});
