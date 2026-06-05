import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const AcceptInvitePage = createLazyPage(
  () =>
    import('@/features/vehicle-sharing/pages/accept-invite-page').then((module) => ({
      default: module.AcceptInvitePage,
    })),
  {
    title: 'Accepting invitation',
    description: 'Validating your vehicle invitation.',
  },
);

function AcceptInviteRouteComponent() {
  const { token } = acceptInviteRoute.useParams();
  return <AcceptInvitePage token={token} />;
}

export const acceptInviteRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicle-invites/$token',
  component: AcceptInviteRouteComponent,
});
