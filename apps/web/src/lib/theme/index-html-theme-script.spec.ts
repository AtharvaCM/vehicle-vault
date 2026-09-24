import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveTheme, THEME_COLORS, THEME_STORAGE_KEY, type ThemePreference } from './theme';

/**
 * index.html sets the theme before the first paint, before this module can
 * load. The two must agree, so this runs the page's own inline script against
 * every preference and system setting and compares it with resolveTheme.
 */
const html = readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8');
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]!);
const themeScript = inlineScripts.find((script) => script.includes(THEME_STORAGE_KEY));

const root = document.documentElement;

function runThemeScript() {
  new Function(themeScript!)();
}

function stubSystem(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: dark && query === '(prefers-color-scheme: dark)' })),
  );
}

beforeEach(() => {
  root.className = '';
  root.removeAttribute('style');
  document.head.innerHTML = `
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLORS.light}" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLORS.dark}" />`;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("index.html's theme script", () => {
  it('is there, and reads the same storage key', () => {
    expect(themeScript).toBeDefined();
  });

  describe.each([true, false])('with the system dark: %s', (systemDark) => {
    it.each<[stored: string | null, preference: ThemePreference]>([
      [null, 'system'],
      ['light', 'light'],
      ['dark', 'dark'],
      ['something else', 'system'],
    ])('stored %s puts the page in the theme resolveTheme gives', (stored, preference) => {
      stubSystem(systemDark);
      if (stored !== null) window.localStorage.setItem(THEME_STORAGE_KEY, stored);

      runThemeScript();

      const expected = resolveTheme(preference, systemDark);
      expect(root.classList.contains('dark')).toBe(expected === 'dark');
      expect(root.style.colorScheme).toBe(expected);

      const colors = [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) =>
        meta.getAttribute('content'),
      );
      expect(colors).toEqual(
        preference === 'system'
          ? [THEME_COLORS.light, THEME_COLORS.dark]
          : [THEME_COLORS[expected], THEME_COLORS[expected]],
      );
    });
  });

  it('falls back to the system when the store throws', () => {
    stubSystem(true);
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    runThemeScript();

    expect(root).toHaveClass('dark');
  });

  it('keeps the colours it writes in step with THEME_COLORS', () => {
    expect(themeScript).toContain(THEME_COLORS.light);
    expect(themeScript).toContain(THEME_COLORS.dark);
    expect(html).toContain(
      `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLORS.dark}" />`,
    );
  });
});
