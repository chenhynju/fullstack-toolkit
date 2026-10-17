import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'analyze'
      ? [visualizer({ filename: 'dist/bundle-report.html', gzipSize: true, open: false })]
      : [])
  ],
  build: { sourcemap: false, manifest: true }
}));
