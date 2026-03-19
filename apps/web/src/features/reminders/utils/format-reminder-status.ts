export function formatReminderStatus(status: string) {
  if (status === 'due_today') {
    return 'Due Today';
  }

  return status
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
