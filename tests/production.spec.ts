import { APP_VERSION } from '../src/config/version';
import { expect, test } from './fixtures/editor';

test('production home has real list management without mascot, preset dashboard, or tutorial prompts', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Recent documents', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Project list view' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.home-hero, .home-template-strip, .home-sidebar-tip, .welcome-illustration')).toHaveCount(0);
  await expect(page.locator('.home-footer')).toContainText(APP_VERSION);
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create a new project' });
  await expect(dialog.getByLabel('New document template')).toHaveValue('blank'); await expect(dialog.locator('.new-template-grid')).toHaveCount(0);
  await dialog.getByLabel('New document width').fill('63'); await expect(dialog.getByRole('button', { name: 'Create project', exact: true })).toBeDisabled(); await expect(dialog.getByRole('alert')).toContainText('64 and 4096');
  await dialog.getByLabel('New document width').fill('640'); await dialog.getByLabel('New document height').fill('400'); await dialog.getByLabel('Project name').fill('Untitled production');
  await dialog.getByRole('button', { name: 'Create project', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByText('No layers yet')).toBeVisible();
  await expect(page.locator('.application-version')).toHaveText(APP_VERSION); await expect(page.getByTestId('stage')).toHaveAttribute('viewBox', '0 0 640 400');
  await expect(page.locator('.setup-button, .preset-grid, .empty-canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to all projects' }).click(); await expect(page.locator('.home-projects.list .home-project-card')).toHaveCount(1); await expect(page.locator('.document-table-heading')).toContainText('Modified');
});

test('desktop downloads use permanent release URLs, never expired Actions artifacts', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Desktop builds', exact: false }).click(); const dialog = page.getByRole('dialog', { name: 'Desktop installation' });
  await expect(dialog.getByRole('link', { name: 'Release downloads', exact: false })).toHaveCount(3);
  for (const link of await dialog.getByRole('link', { name: 'Release downloads', exact: false }).all()) await expect(link).toHaveAttribute('href', `https://github.com/Dinomax2005/luno-animate/releases/tag/v${APP_VERSION}`);
  await expect(dialog).toContainText('Unsigned macOS'); await expect(dialog).toContainText('DEB'); await expect(dialog.locator('a[href*="/actions/runs/"]')).toHaveCount(0);
});

test('icon-only compact home navigation remains named and keyboard accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  for (const label of ['All projects', 'Favorites', 'Templates', 'Trash']) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  const sidebar = await page.locator('.home-sidebar').boundingBox(), main = await page.locator('.home-main').boundingBox(); expect(sidebar && main).toBeTruthy(); expect(main!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width);
  await page.getByRole('button', { name: 'Templates', exact: true }).click(); await page.getByRole('button', { name: 'Blank document', exact: false }).click(); await expect(page.getByTestId('stage')).toBeVisible(); expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
});
