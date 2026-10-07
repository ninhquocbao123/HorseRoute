import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // package shared build ra CommonJS nên cần pre-bundle
  optimizeDeps: { include: ['@my-project/shared'] },
  build: { commonjsOptions: { include: [/shared/, /node_modules/] } },
});
