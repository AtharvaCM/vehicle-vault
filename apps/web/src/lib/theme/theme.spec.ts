import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyTheme,
  readThemePreference,
  resetThemeForTests,
  resolveTheme,
  setThemePreference,
  startThemeSync,
  subscribeToTheme,
  THEME_STORAGE_KEY,
} from './theme';

/** A controllable `prefers-color-scheme: dark` query. */
function stubSystem(initiallyDark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: initiallyDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query),
  );
  return {
    set(dark: boolean) {
      query.matches = dark;
      for (const listener of listeners) listener();
    },
  };
}

function themeColors() {
  return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((meta) =>
    meta.getAttribute('content'),
  );
}

const root = document.documentElement;

beforeEach(() => {
  resetThemeForTests();
  root.className = '';
  root.removeAttribute('style');
  document.head.innerHTML = `
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#0e5c63" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0f1216" />`;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveTheme', () => {
  it('follows the system on System and the choice otherwise', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('readThemePreference', () => {
  it('is System with nothing stored, or anything but light and dark', () => {
    expect(readThemePreference()).toBe('system');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readThemePreference()).toBe('system');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readThemePreference()).toBe('dark');
  });

  it('is System when the store throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readThemePreference()).toBe('system');
  });
});

describe('applyTheme', () => {
  it('sets the class, the colour scheme and, for a choice, both theme colours', () => {
    applyTheme('dark', 'dark');
    expect(root).toHaveClass('dark');
    expect(root.style.colorScheme).toBe('dark');
    expect(themeColors()).toEqual(['#0f1216', '#0f1216']);

    applyTheme('light', 'system');
    expect(root).not.toHaveClass('dark');
    expect(root.style.colorScheme).toBe('light');
    // On System each meta keeps its own scheme's colour.
    expect(themeColors()).toEqual(['#0e5c63', '#0f1216']);
  });
});

describe('setThemePreference', () => {
  it('applies and keeps a choice, and System forgets it', () => {
    stubSystem(false);
    setThemePreference('dark');
    expect(root).toHaveClass('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    setThemePreference('system');
    expect(root).not.toHaveClass('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('still switches the page when the store refuses the write', () => {
    stubSystem(false);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    setThemePreference('dark');
    expect(root).toHaveClass('dark');
  });

  it('tells subscribers', () => {
    stubSystem(false);
    const listener = vi.fn();
    const unsubscribe = subscribeToTheme(listener);
    setThemePreference('light');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setThemePreference('dark');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('startThemeSync', () => {
  it('follows the system while on System, and not once a theme is chosen', () => {
    const system = stubSystem(false);
    const stop = startThemeSync();
    expect(root).not.toHaveClass('dark');

    system.set(true);
    expect(root).toHaveClass('dark');

    setThemePreference('light');
    system.set(true);
    expect(root).not.toHaveClass('dark');
    stop();
  });

  it('picks up a choice made in another tab', () => {
    stubSystem(false);
    const stop = startThemeSync();
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    expect(root).toHaveClass('dark');
    stop();
  });
});
