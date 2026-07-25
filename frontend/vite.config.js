import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The desktop host embeds this bundle and renders it in Edge Chromium WebView2,
// so no legacy/IE polyfills are needed — only a modern build is produced.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    watch: {
      // Runtime/generated dirs — WebView2 keeps files here locked (EBUSY on watch).
      ignored: ['**/webview_data/**', '**/logs/**', '**/backups/**', '**/dist/**', '**/ui/**'],
    },
  },
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
    // Scope collection to this checkout's unit tests. Without it Vitest's default glob walks
    // nested working copies (e.g. a git worktree created inside the repo) and collects a second
    // copy of every spec, which then fails against the wrong sources.
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
  },
});
