import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base must match the GitHub Pages repo path: thevikram123.github.io/mcs-pmu-platform/
export default defineConfig({
  base: '/mcs-pmu-platform/',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
