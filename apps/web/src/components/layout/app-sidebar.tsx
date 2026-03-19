import { Link, useNavigate } from '@tanstack/react-router';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

import { appNavigation } from './app-navigation';

export function AppSidebar() {
  const auth = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    auth.logout();
    await navigate({ to: '/login' });
  };

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="border-b border-slate-200 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Vehicle Vault
        </p>
        <h1 className="mt-2 text-lg font-semibold text-slate-950">Maintenance tracking</h1>
      </div>

      <nav className="flex flex-1 flex-col gap-2 px-4 py-6">
        {appNavigation.map((item) => (
          <Link
            key={item.to}
            activeOptions={{ exact: item.exact ?? false }}
            activeProps={{
              className: 'bg-slate-900 text-white shadow-sm',
            }}
            className={cn(
              'rounded-2xl px-4 py-3 transition-colors hover:bg-slate-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300',
            )}
            to={item.to}
          >
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="mt-1 text-xs text-slate-500 data-[status=active]:text-slate-300">
              {item.subtitle}
            </p>
          </Link>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="mb-4 rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">{auth.user?.name}</p>
          <p className="mt-1 text-xs text-slate-500">{auth.user?.email}</p>
        </div>

        <Card className="bg-slate-50">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Jump into the next common workflow.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link className={buttonVariants({ size: 'sm' })} to="/vehicles/new">
              Add Vehicle
            </Link>
            <Link className={buttonVariants({ size: 'sm', variant: 'secondary' })} to="/vehicles">
              Log Maintenance
            </Link>
            <Link className={buttonVariants({ size: 'sm', variant: 'secondary' })} to="/vehicles">
              Add Reminder
            </Link>
            <Button onClick={handleLogout} size="sm" variant="ghost">
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    </aside>
  );
}
