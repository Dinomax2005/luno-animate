import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './desktop-tests',
  timeout: 60_000,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
});
