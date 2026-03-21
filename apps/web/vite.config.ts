import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('@tanstack')) {
            return 'tanstack';
          }

          if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('sonner')) {
            return 'ui';
          }

          if (id.includes('react-hook-form') || id.includes('zod')) {
            return 'forms';
          }

          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@vehicle-vault/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: process.env.VITE_API_PROXY_TARGET
      ? {
          '/api': {
            target: process.env.VITE_API_PROXY_TARGET,
            changeOrigin: true,
            secure: true,
          },
        }
      : undefined,
  },
});
