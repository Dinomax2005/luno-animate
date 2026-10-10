import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  optimizeDeps: { include: ['mediabunny', 'react-dom/server', 'gifenc'] },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Tools may replace files in multiple writes; never cache a transient empty module.
    watch: { awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 } },
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: ['.e2b.app', 'localhost'] },
});
