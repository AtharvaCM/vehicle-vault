import { createRoute } from '@tanstack/react-router';

import { HomePage } from '@/features/home/components/home-page';

import { rootRoute } from './__root';

function IndexRouteComponent() {
  return <HomePage />;
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexRouteComponent,
});
