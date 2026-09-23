import { createRoute } from '@tanstack/react-router';

import { createLazyPage } from './lazy-page';
import { rootRoute } from './root-route';

const AcceptInvitePage = createLazyPage(
  () =>
    import('@/features/vehicle-sharing/pages/accept-invite-page').then((module) => ({
      default: module.AcceptInvitePage,
    })),
  {
    title: 'Opening your invite',
    description: 'Loading the invitation.',
  },
);

function AcceptInviteRouteComponent() {
  const { token } = acceptInviteRoute.useParams();
  return <AcceptInvitePage token={token} />;
}

export const acceptInviteRoute = createRoute({
  // Outside the signed-in guard: the page shows the invite to anyone holding
  // the link and asks them to sign in or register only to accept it.
  getParentRoute: () => rootRoute,
  path: 'vehicle-invites/$token',
  component: AcceptInviteRouteComponent,
});
