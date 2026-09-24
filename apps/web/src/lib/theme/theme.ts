/**
 * Light and dark (#252). The theme follows the system unless this device has
 * chosen Light or Dark in the account menu. The choice lives in localStorage;
 * a store that throws (private mode, blocked site data) reads as System.
 *
 * The inline script in `index.html` applies the theme before the first paint
 * and before any module loads, so no page flashes the wrong one. Prerendered
 * catalog pages are built from the same `index.html`, and since the script
 * only touches <html>, never #root, they hydrate as before. This module takes
 * over once the app runs; `index-html-theme-script.spec.ts` keeps the two in
 * step.
 */

export const THEME_STORAGE_KEY = 'vehicle-vault.theme';

export const themePreferences = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof themePreferences)[number];
export type Theme = 'light' | 'dark';

/** The browser chrome's colour (`theme-color`): the brand in light, the page in dark. */
export const THEME_COLORS: Record<Theme, string> = {
  light: '#0e5c63',
  dark: '#0f1216',
};

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isThemePreference(value: unknown): value is ThemePreference {
  return themePreferences.includes(value as ThemePreference);
}

/** This device's choice; System when there is none or the store can't be read. */
export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark() {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean = systemPrefersDark(),
): Theme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

/**
 * Puts a theme on the page: the `.dark` class the tokens key off, the
 * colour scheme native controls follow, and the browser chrome's colour.
 */
export function applyTheme(
  theme: Theme,
  preference: ThemePreference,
  root: HTMLElement = document.documentElement,
) {
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  for (const meta of root.ownerDocument.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )) {
    // On System each meta keeps the colour of its own media query, so the
    // browser can follow the system by itself; a choice overrides both.
    const own: Theme = meta.getAttribute('media')?.includes('dark') ? 'dark' : 'light';
    meta.setAttribute('content', THEME_COLORS[preference === 'system' ? own : theme]);
  }
}

let current: ThemePreference | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function getThemePreference(): ThemePreference {
  current ??= readThemePreference();
  return current;
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // A blocked store still switches this page; the choice just isn't kept.
  }
  current = preference;
  applyTheme(resolveTheme(preference), preference);
  notify();
}

/** For `useSyncExternalStore`: called when the choice, or on System the system theme, changes. */
export function subscribeToTheme(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Keeps the page in step with the system while on System, and with a choice
 * made in another tab. Called once at startup; returns the teardown.
 */
export function startThemeSync() {
  const media = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
  const reapply = () => {
    const preference = getThemePreference();
    applyTheme(resolveTheme(preference), preference);
    notify();
  };
  const onStorage = (event: StorageEvent) => {
    // `key` is null when another tab clears the whole store.
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    current = readThemePreference();
    reapply();
  };

  // The inline script has applied the theme already; this agrees with it, and
  // covers a page served without the script.
  reapply();
  media?.addEventListener('change', reapply);
  window.addEventListener('storage', onStorage);

  return () => {
    media?.removeEventListener('change', reapply);
    window.removeEventListener('storage', onStorage);
  };
}

/** Test seam: forget the cached choice so the next read goes to the store. */
export function resetThemeForTests() {
  current = null;
  listeners.clear();
}
