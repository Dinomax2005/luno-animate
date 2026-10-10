import { test as base, expect, type Page } from '@playwright/test';
import { APP_VERSION } from '../../src/config/version';

// Existing workspace regression tests start past launch UI and exercise the download fallback.
// Launch/file-picker acceptance tests import Playwright directly and test the real launch flow.
export const test = base.extend<{ editorLaunch: void }>({
  editorLaunch: [async ({ page }, use) => {
    await page.addInitScript(version => {
      localStorage.setItem('luno.launch.v1', JSON.stringify({ showStart: false, seenVersion: version }));
      window.showOpenFilePicker = undefined; window.showSaveFilePicker = undefined;
    }, APP_VERSION);
    await use();
  }, { auto: true }],
});
export { expect };
export type { Page };
