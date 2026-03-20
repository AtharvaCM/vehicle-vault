import type { LucideIcon } from 'lucide-react';

import {
  CarFront,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Settings,
  Siren,
  Wrench,
} from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';

import { APP_NAME } from '@vehicle-vault/shared';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { appToast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';

type NavigationItem = {
  label: string;
  subtitle: string;
  to: '/dashboard' | '/vehicles' | '/maintenance' | '/reminders' | '/settings';
  icon: LucideIcon;
  exact?: boolean;
};

export const appNavigation: NavigationItem[] = [
  {
    label: 'Dashboard',
    subtitle: 'Overview',
    to: '/dashboard',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: 'Vehicles',
    subtitle: 'Garage records',
    to: '/vehicles',
    icon: CarFront,
  },
  {
    label: 'Maintenance',
    subtitle: 'Service history',
    to: '/maintenance',
    icon: Wrench,
    exact: true,
  },
  {
    label: 'Reminders',
    subtitle: 'Upcoming work',
    to: '/reminders',
    icon: Siren,
    exact: true,
  },
  {
    label: 'Settings',
    subtitle: 'Account',
    to: '/settings',
    icon: Settings,
    exact: true,
  },
];

export function Sidebar() {
  const auth = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    auth.logout();
    appToast.info({
      title: 'Signed out',
      description: 'Your Vehicle Vault session has been cleared.',
    });
    await navigate({ to: '/login' });
  };

  return (
    <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-white/90 xl:flex xl:flex-col">
      <div className="border-b border-border/70 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-sm">
            VV
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
            <p className="text-xs text-muted-foreground">Operations workspace</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between px-4 py-6">
        <nav className="space-y-2">
          {appNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                activeOptions={{ exact: item.exact ?? false }}
                activeProps={{
                  className:
                    'border-slate-950/10 bg-slate-950 text-white shadow-sm hover:bg-slate-900',
                }}
                className={cn(
                  'group flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm transition-colors hover:bg-slate-100',
                )}
                to={item.to}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100/90 text-slate-700 transition-colors group-hover:bg-slate-200">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40" />
              </Link>
            );
          })}
        </nav>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{auth.user?.name}</p>
                <p className="text-xs text-muted-foreground">{auth.user?.email}</p>
              </div>
              <Badge tone="neutral">Live</Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background p-4">
            <p className="text-sm font-medium text-foreground">Quick actions</p>
            <div className="mt-3 grid gap-2">
              <Link
                className="rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                to="/vehicles/new"
              >
                Add Vehicle
              </Link>
              <Link
                className="rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                to="/maintenance"
              >
                Review Maintenance
              </Link>
              <Link
                className="rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                to="/reminders"
              >
                Check Reminders
              </Link>
              <Button className="justify-start rounded-xl" onClick={handleLogout} variant="ghost">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
