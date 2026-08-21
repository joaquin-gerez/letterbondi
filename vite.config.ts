import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.VITE_HOST ?? '127.0.0.1',
    port: 5173,
    watch: process.env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', ws: true } },
  },
  build: { outDir: 'dist/client' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/client/setupTests.ts',
    restoreMocks: true,
    exclude: ['dist/**', 'node_modules/**'],
  },
});
