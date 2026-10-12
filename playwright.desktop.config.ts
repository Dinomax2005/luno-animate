import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "desktop-tests",
  timeout: 120000,
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
});
