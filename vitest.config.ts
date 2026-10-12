import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/spec/**/*.test.{ts,tsx}"],
    setupFiles: ["src/spec/setup.ts"],
    clearMocks: true,
  },
});
