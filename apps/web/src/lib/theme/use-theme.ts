import { useSyncExternalStore } from 'react';

import {
  getThemePreference,
  resolveTheme,
  setThemePreference,
  subscribeToTheme,
  type Theme,
  type ThemePreference,
} from './theme';

// A prerender knows nothing of the visitor's device: it renders as System, in
// light, and the client catches up right after hydrating.
const getServerPreference = (): ThemePreference => 'system';
const getServerTheme = (): Theme => 'light';

/** This device's choice (System, Light or Dark) and its setter. */
export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const preference = useSyncExternalStore(
    subscribeToTheme,
    getThemePreference,
    getServerPreference,
  );
  return [preference, setThemePreference];
}

/** The theme on screen: the choice, or the system's while on System. */
export function useResolvedTheme(): Theme {
  return useSyncExternalStore(
    subscribeToTheme,
    () => resolveTheme(getThemePreference()),
    getServerTheme,
  );
}
