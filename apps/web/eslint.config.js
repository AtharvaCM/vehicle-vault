import react from '@vehicle-vault/config/eslint/react';

import designSystem from './eslint/design-system-plugin.js';
import {
  MICRO_LABEL_ALLOWED,
  MIGRATED_PATHS,
  NO_MICRO_LABEL_PATHS,
} from './eslint/design-system-paths.js';

// Every value the UI shows goes through `src/lib/format` (#238), so one screen
// cannot print "23 Sept 2026" beside "May 26, 2026", or follow the browser's
// locale for grouping.
const FORMAT_MODULE_HINT = 'Use `format` from `@/lib/format`.';

const DIALOG_HINT =
  'Use a confirmation dialog (components/ui/alert-dialog), which the app can style and test.';

/**
 * The design-system guardrails (#243), at one severity. They warn everywhere
 * and are errors on MIGRATED_PATHS (eslint/design-system-paths.js); CI fails
 * on errors only.
 */
function designSystemRules(severity) {
  return {
    'vv/no-palette-colors': severity,
    'vv/no-arbitrary-font-size': severity,
    'vv/no-default-font-size': severity,
    'vv/no-transition-all': severity,
    'vv/no-micro-labels': severity,
    'no-restricted-properties': [
      severity,
      { object: 'window', property: 'confirm', message: DIALOG_HINT },
      { object: 'window', property: 'prompt', message: DIALOG_HINT },
    ],
    'no-restricted-globals': [
      severity,
      { name: 'confirm', message: DIALOG_HINT },
      { name: 'prompt', message: DIALOG_HINT },
    ],
  };
}

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
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    // Specs assert class names and stub dialogs on purpose.
    ignores: ['src/**/*.spec.{ts,tsx}', 'src/test/**'],
    plugins: { vv: designSystem },
    rules: designSystemRules('warn'),
  },
  {
    files: MIGRATED_PATHS,
    ignores: ['src/**/*.spec.{ts,tsx}'],
    rules: designSystemRules('error'),
  },
  // ESLint's flat config rejects an empty `files` array, so the block goes
  // while the list is empty.
  ...(NO_MICRO_LABEL_PATHS.length > 0
    ? [
        {
          files: NO_MICRO_LABEL_PATHS,
          ignores: ['src/**/*.spec.{ts,tsx}'],
          rules: { 'vv/no-micro-labels': 'error' },
        },
      ]
    : []),
  {
    files: MICRO_LABEL_ALLOWED,
    rules: { 'vv/no-micro-labels': 'off' },
  },
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
