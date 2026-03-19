export type ReminderSummary = {
  id: string;
  title: string;
  dueDate: string;
  priority: 'due-soon' | 'overdue';
};
