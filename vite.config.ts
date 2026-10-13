import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: [".e2b.app", "localhost", "127.0.0.1"],
  },
  preview: { host: "0.0.0.0", allowedHosts: [".e2b.app", "localhost"] },
  // mediabunny ships a very large ESM module; pre-bundling it stalls dev first imports
  // ("Outdated Optimize Dep"), so the dev server serves the real module instead.
  optimizeDeps: { exclude: ["mediabunny"] },
});
