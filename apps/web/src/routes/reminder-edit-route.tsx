import { createRoute } from '@tanstack/react-router';

import { ReminderEditPage } from '@/features/reminders/pages/reminder-edit-page';

import { appRoute } from './app-route';

function ReminderEditRouteComponent() {
  const { reminderId } = reminderEditRoute.useParams();

  return <ReminderEditPage reminderId={reminderId} />;
}

export const reminderEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'reminders/$reminderId/edit',
  component: ReminderEditRouteComponent,
});
