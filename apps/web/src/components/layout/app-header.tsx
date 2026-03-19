import { Link, useNavigate, useRouterState } from '@tanstack/react-router';

import { APP_NAME } from '@vehicle-vault/shared';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';

import { appNavigation } from './app-navigation';

const sectionTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/maintenance-records': 'Maintenance',
  '/vehicles': 'Vehicles',
  '/reminders': 'Reminders',
  '/settings': 'Settings',
};

export function AppHeader() {
  const auth = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const activeSection =
    Object.entries(sectionTitles).find(([routePath]) => pathname.startsWith(routePath))?.[1] ??
    'Workspace';

  const handleLogout = async () => {
    auth.logout();
    await navigate({ to: '/login' });
  };

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {APP_NAME}
            </p>
            <p className="mt-1 text-sm text-slate-600">{activeSection}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">{auth.user?.name}</p>
              <p className="text-xs text-slate-500">{auth.user?.email}</p>
            </div>

            <Link
              className={buttonVariants({ size: 'sm', variant: 'secondary' })}
              to="/vehicles/new"
            >
              Add Vehicle
            </Link>
            <Button onClick={handleLogout} size="sm" variant="ghost">
              Logout
            </Button>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto lg:hidden">
          {appNavigation.map((item) => (
            <Link
              key={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              activeProps={{
                className: buttonVariants({ size: 'sm', variant: 'primary' }),
              }}
              className={buttonVariants({ size: 'sm', variant: 'ghost' })}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
