import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const ReminderDetailPage = createLazyPage(
  () =>
    import('@/features/reminders/pages/reminder-detail-page').then((module) => ({
      default: module.ReminderDetailPage,
    })),
  {
    title: 'Loading reminder',
    description: 'Loading this reminder.',
  },
);

function ReminderDetailRouteComponent() {
  const { reminderId } = reminderDetailRoute.useParams();

  return <ReminderDetailPage reminderId={reminderId} />;
}

export const reminderDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'reminders/$reminderId',
  component: ReminderDetailRouteComponent,
});
