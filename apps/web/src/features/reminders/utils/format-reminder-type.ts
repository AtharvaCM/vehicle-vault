export function formatReminderType(type: string) {
  if (type === 'puc') {
    return 'PUC';
  }

  return type
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
