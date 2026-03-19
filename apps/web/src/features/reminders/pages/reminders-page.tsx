import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';

import { ReminderSections } from '../components/reminder-sections';

const dueSoon = [
  {
    id: 'reminder-1',
    title: 'Insurance renewal for MH12AB1234',
    dueDate: '2026-03-26',
    priority: 'due-soon' as const,
  },
  {
    id: 'reminder-2',
    title: 'Periodic service for KA03CD4567',
    dueDate: '2026-03-29',
    priority: 'due-soon' as const,
  },
];

const overdue = [
  {
    id: 'reminder-3',
    title: 'PUC renewal for MH12AB1234',
    dueDate: '2026-03-10',
    priority: 'overdue' as const,
  },
];

export function RemindersPage() {
  return (
    <PageContainer>
      <PageTitle
        description="Reminders should stay isolated from maintenance and vehicle UIs so due-date logic, notifications, and escalation states can evolve independently."
        title="Reminders"
      />

      <ReminderSections dueSoon={dueSoon} overdue={overdue} />
    </PageContainer>
  );
}
