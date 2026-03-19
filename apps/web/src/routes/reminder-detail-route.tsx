import { createRoute } from '@tanstack/react-router';

import { ReminderDetailPage } from '@/features/reminders/pages/reminder-detail-page';

import { appRoute } from './app-route';

function ReminderDetailRouteComponent() {
  const { reminderId } = reminderDetailRoute.useParams();

  return <ReminderDetailPage reminderId={reminderId} />;
}

export const reminderDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'reminders/$reminderId',
  component: ReminderDetailRouteComponent,
});
