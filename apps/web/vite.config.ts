import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // src/sw.ts, built to /sw.js with this build's precache list injected.
    // The manifest stays public/site.webmanifest, registration happens in
    // main.tsx, and nothing runs in dev, where a caching worker would fight HMR.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'vendor';
          }

          if (id.includes('@tanstack')) {
            return 'tanstack';
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
