// @vitest-environment node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint, RuleTester } from 'eslint';
import { describe, expect, it } from 'vitest';

import { rules } from './design-system-plugin.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
});

const found = [{ messageId: 'found' }];

tester.run('no-palette-colors', rules['no-palette-colors'], {
  valid: [
    '<p className="text-fg-2 bg-surface border-line" />',
    "cn('text-late bg-late-tint', isOpen && 'bg-brand-tint')",
    "const label = 'Slate grey paint';",
  ],
  invalid: [
    { code: '<p className="text-slate-500" />', errors: found },
    { code: "cn('px-2', 'hover:bg-rose-50')", errors: found },
    {
      code: 'const card = `rounded-card ${active ? "border-emerald-200/60" : ""}`;',
      errors: found,
    },
    { code: "cva('bg-white text-fg')", errors: found },
    { code: '<div className="data-[state=open]:!text-amber-700" />', errors: found },
  ],
});

tester.run('no-arbitrary-font-size', rules['no-arbitrary-font-size'], {
  valid: ['<p className="text-small text-fg-3" />', '<p className="text-[var(--x)] w-[11px]" />'],
  invalid: [
    { code: '<p className="text-[11px]" />', errors: found },
    { code: "cn('sm:text-[0.8rem]')", errors: found },
  ],
});

tester.run('no-default-font-size', rules['no-default-font-size'], {
  valid: [
    '<p className="text-ui text-small text-fg-3 text-field md:text-body" />',
    '<p className="text-late text-center text-sm-foo" />',
  ],
  invalid: [
    { code: '<p className="text-sm" />', errors: found },
    { code: "cn('md:text-2xl')", errors: found },
    { code: '<p className="text-lg/6" />', errors: found },
  ],
});

tester.run('no-transition-all', rules['no-transition-all'], {
  valid: ['<a className="transition-colors duration-150" />'],
  invalid: [
    { code: '<a className="transition-all" />', errors: found },
    { code: "cn('motion-safe:transition-all')", errors: found },
  ],
});

tester.run('no-micro-labels', rules['no-micro-labels'], {
  valid: [
    '<span className="text-small text-fg-3" />',
    '<span className="tracking-wide" />',
    '<span className="normal-case lowercase capitalize" />',
    "const label = 'Uppercase letters';",
  ],
  invalid: [
    { code: '<span className="text-xs uppercase tracking-wider" />', errors: found },
    { code: "cn('uppercase tracking-[0.12em] text-fg-3')", errors: found },
    { code: '<span className="uppercase" />', errors: found },
    { code: '<th className="text-caption uppercase tracking-tight" />', errors: found },
    { code: "cn('font-medium', 'sm:uppercase tracking-tighter')", errors: found },
    { code: '<p className="data-[state=open]:!uppercase" />', errors: found },
  ],
});

describe('severity by path', () => {
  const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const eslint = new ESLint({ cwd: webRoot });
  const code = [
    "export const label = 'text-slate-500 uppercase tracking-widest transition-all text-[11px]';",
    "export const size = 'text-sm';",
    "export const ask = () => window.confirm('Sure?');",
    '',
  ].join('\n');

  async function severities(file) {
    const [result] = await eslint.lintText(code, { filePath: path.join(webRoot, file) });

    return result.messages.map((message) => [message.ruleId, message.severity]);
  }

  it('warns outside the migrated paths', async () => {
    const found = await severities('src/features/example/example.ts');

    expect(found).toEqual(
      expect.arrayContaining([
        ['vv/no-palette-colors', 1],
        ['vv/no-micro-labels', 1],
        ['vv/no-transition-all', 1],
        ['vv/no-arbitrary-font-size', 1],
        ['vv/no-default-font-size', 1],
        ['no-restricted-properties', 1],
      ]),
    );
  });

  it('fails on a migrated path', async () => {
    const found = await severities('src/lib/example.ts');

    expect(found).toEqual(
      expect.arrayContaining([
        ['vv/no-palette-colors', 2],
        ['vv/no-micro-labels', 2],
        ['vv/no-transition-all', 2],
        ['vv/no-arbitrary-font-size', 2],
        ['vv/no-default-font-size', 2],
        ['no-restricted-properties', 2],
      ]),
    );
  });

  it('leaves specs alone', async () => {
    expect(await severities('src/features/example/example.spec.ts')).toEqual([]);
  });
}, 30_000);
