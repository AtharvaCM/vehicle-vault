import { createRoute } from '@tanstack/react-router';

import { ReminderDetailPage } from '@/features/reminders/pages/reminder-detail-page';

import { rootRoute } from './root-route';

function ReminderDetailRouteComponent() {
  const { reminderId } = reminderDetailRoute.useParams();

  return <ReminderDetailPage reminderId={reminderId} />;
}

export const reminderDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'reminders/$reminderId',
  component: ReminderDetailRouteComponent,
});
