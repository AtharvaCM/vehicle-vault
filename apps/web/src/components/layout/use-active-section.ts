import { useRouterState } from '@tanstack/react-router';

import { sectionForPath, type NavSection } from './navigation';

/** The top-level section the current page belongs to, for lighting the navigation. */
export function useActiveSection(): NavSection | null {
  return useRouterState({ select: (state) => sectionForPath(state.location.pathname) });
}
