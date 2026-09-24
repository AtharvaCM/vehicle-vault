import type { LucideIcon } from 'lucide-react';

import { CalendarClock, CarFront, History, House, Wallet } from 'lucide-react';

/**
 * The top level answers the three questions an owner comes with: what's due
 * (Upcoming), what have I done (History) and what is it costing me (Costs),
 * beside Home and the Garage. Account things (settings, preferences, theme,
 * admin, sign-out) live in the account menu, not here.
 */
export type NavSection = 'home' | 'garage' | 'upcoming' | 'history' | 'costs';

export type NavItem = {
  section: NavSection;
  label: string;
  to: '/home' | '/garage' | '/upcoming' | '/history' | '/costs';
  icon: LucideIcon;
};

export const primaryNavigation: readonly NavItem[] = [
  { section: 'home', label: 'Home', to: '/home', icon: House },
  { section: 'garage', label: 'Garage', to: '/garage', icon: CarFront },
  { section: 'upcoming', label: 'Upcoming', to: '/upcoming', icon: CalendarClock },
  { section: 'history', label: 'History', to: '/history', icon: History },
  { section: 'costs', label: 'Costs', to: '/costs', icon: Wallet },
];

export function navItem(section: NavSection): NavItem {
  return primaryNavigation.find((item) => item.section === section)!;
}

/**
 * The section a page belongs to, so a detail page lights its parent: a vehicle
 * and everything recorded against it (its service records, reminders, papers)
 * sit under Garage. Account and admin pages belong to no section.
 */
export function sectionForPath(pathname: string): NavSection | null {
  const [first = ''] = pathname.split('/').filter(Boolean);

  switch (first) {
    case 'home':
      return 'home';
    case 'garage':
    case 'vehicles':
    case 'maintenance-records':
    case 'reminders':
      return 'garage';
    case 'upcoming':
      return 'upcoming';
    case 'history':
      return 'history';
    case 'costs':
      return 'costs';
    default:
      return null;
  }
}
