import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3000' },
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
