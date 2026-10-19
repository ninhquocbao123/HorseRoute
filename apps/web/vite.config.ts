import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Read workspace source directly: avoid stale pre-bundled CommonJS exports in dev.
  resolve: { alias: { '@my-project/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) } },
  optimizeDeps: { exclude: ['@my-project/shared'] },
});
