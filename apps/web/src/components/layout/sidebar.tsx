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
    subtitle: 'Your garage',
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
    subtitle: 'Due items',
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
    <aside className="hidden w-64 shrink-0 border-r border-slate-200/60 bg-slate-50/40 xl:flex xl:flex-col">
      <div className="px-6 py-8">
        <Link className="flex items-center gap-2.5 transition-opacity hover:opacity-90" to="/dashboard">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground shadow-premium-sm">
            VV
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-slate-900">{APP_NAME}</p>
            <p className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-500/80">
              Garage Management
            </p>
          </div>
        </Link>
      </div>

      <div className="flex flex-1 flex-col justify-between px-3 pb-8">
        <nav className="space-y-1">
          {appNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                activeOptions={{ exact: item.exact ?? false }}
                activeProps={{
                  className: 'bg-white text-primary shadow-premium-sm border-slate-200/60',
                }}
                className={cn(
                  'group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-white/50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                to={item.to}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-transparent transition-colors group-hover:bg-slate-100 group-data-[state=active]:bg-primary/5 group-data-[state=active]:text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-40 group-data-[state=active]:opacity-0" />
              </Link>
            );
          })}
        </nav>

        <div className="px-2">
          <div className="rounded-xl border border-slate-200/50 bg-white/50 p-4 shadow-premium-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <span className="text-xs font-bold">{auth.user?.name?.charAt(0)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-900">
                  {auth.user?.name}
                </p>
                <p className="truncate text-[11px] text-slate-500">{auth.user?.email}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link to="/settings">
                <Button className="w-full text-[11px]" size="sm" variant="ghost">
                  <Settings className="mr-1.5 h-3 w-3" />
                  Settings
                </Button>
              </Link>
              <Button
                className="w-full text-[11px] text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={handleLogout}
                size="sm"
                variant="ghost"
              >
                <LogOut className="mr-1.5 h-3 w-3" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
