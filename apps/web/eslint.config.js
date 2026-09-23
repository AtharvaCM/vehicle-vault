import react from '@vehicle-vault/config/eslint/react';

export default [
  // TypeScript only, as `--ext ts,tsx` did under the legacy config.
  {
    ignores: [
      'dist-ssr/**',
      'dev-dist/**',
      'test-results/**',
      'playwright-report/**',
      '**/*.{js,cjs,mjs}',
    ],
  },
  ...react,
];
