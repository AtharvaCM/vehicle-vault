import viteConfig from './vite.config';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      clearMocks: true,
      environment: 'jsdom',
      include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
      mockReset: true,
      restoreMocks: true,
      setupFiles: ['./src/test/setup.ts'],
    },
  }),
);
