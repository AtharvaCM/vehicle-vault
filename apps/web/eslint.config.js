import react from '@vehicle-vault/config/eslint/react';

// Every value the UI shows goes through `src/lib/format` (#238), so one screen
// cannot print "23 Sept 2026" beside "May 26, 2026", or follow the browser's
// locale for grouping.
const FORMAT_MODULE_HINT = 'Use `format` from `@/lib/format`.';

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
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/format/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]',
          message: `toLocaleString and friends follow the browser's locale. ${FORMAT_MODULE_HINT}`,
        },
        {
          selector:
            "NewExpression[callee.object.name='Intl'][callee.property.name=/^(NumberFormat|DateTimeFormat)$/]",
          message: `Formatters live in one module. ${FORMAT_MODULE_HINT}`,
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'date-fns',
              importNames: ['format', 'lightFormat'],
              message: `Display dates come from format.date(). For a date input's value use toDateInputValue / todayDateInputValue. ${FORMAT_MODULE_HINT}`,
            },
          ],
        },
      ],
    },
  },
];
