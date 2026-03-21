import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const ReminderEditPage = createLazyPage(
  () =>
    import('@/features/reminders/pages/reminder-edit-page').then((module) => ({
      default: module.ReminderEditPage,
    })),
  {
    title: 'Loading reminder form',
    description: 'Preparing the reminder edit workflow.',
  },
);

function ReminderEditRouteComponent() {
  const { reminderId } = reminderEditRoute.useParams();

  return <ReminderEditPage reminderId={reminderId} />;
}

export const reminderEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'reminders/$reminderId/edit',
  component: ReminderEditRouteComponent,
});
