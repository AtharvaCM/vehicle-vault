import { createRouter } from '@tanstack/react-router';

import { indexRoute } from '@/routes';
import { rootRoute } from '@/routes/__root';

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
