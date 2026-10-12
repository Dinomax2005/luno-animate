import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 960 },
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        }
      : {},
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
