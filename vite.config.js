import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The desktop host embeds this bundle and renders it in Edge Chromium WebView2,
// so no legacy/IE polyfills are needed — only a modern build is produced.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'ui',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/unit/setup.js',
  },
});
