export type AppNavigationItem = {
  label: string;
  subtitle: string;
  to: '/dashboard' | '/vehicles' | '/reminders' | '/settings';
  exact?: boolean;
};

export const appNavigation: AppNavigationItem[] = [
  {
    label: 'Dashboard',
    subtitle: 'Overview',
    to: '/dashboard',
    exact: true,
  },
  {
    label: 'Vehicles',
    subtitle: 'Fleet and records',
    to: '/vehicles',
  },
  {
    label: 'Reminders',
    subtitle: 'Due soon and overdue',
    to: '/reminders',
    exact: true,
  },
  {
    label: 'Settings',
    subtitle: 'Account and preferences',
    to: '/settings',
    exact: true,
  },
];
