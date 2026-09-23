import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig.json excludes spec files, and Vite's Oxc transform only applies a
  // tsconfig to the files it includes, so specs that declare decorated fixture
  // classes need the legacy decorator settings spelled out here.
  oxc: {
    decorator: { legacy: true, emitDecoratorMetadata: true },
  },
  test: {
    clearMocks: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    mockReset: true,
    restoreMocks: true,
  },
});
