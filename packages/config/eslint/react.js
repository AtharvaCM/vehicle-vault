import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import base from './base.js';

export default tseslint.config(
  ...base,
  react.configs.flat.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // The two classic hook rules only. eslint-plugin-react-hooks 7's
      // recommended preset adds the React Compiler rules (purity, refs,
      // set-state-in-effect, ...), which this codebase has never been held to.
      'react-hooks/rules-of-hooks': 'error',
      // An error, not a warning: the web lint lets warnings through (they
      // track the design-system migration), and this one must not slip.
      'react-hooks/exhaustive-deps': 'error',
      'react/react-in-jsx-scope': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  prettier,
);
