import {
  CarFront,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  Siren,
  Wrench,
} from 'lucide-react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { appToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { NotificationCenter } from '@/features/notifications/components/notification-center';

import { MobileNavSheetContent } from './mobile-nav-sheet';
import { adminNavigation, appNavigation } from './sidebar';

const sectionTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/maintenance-records': 'Maintenance record',
  '/maintenance': 'Maintenance',
  '/vehicles': 'Garage',
  '/reminders': 'Reminders',
  '/settings': 'Settings',
};

const mobileIcons = {
  '/dashboard': LayoutDashboard,
  '/maintenance': Wrench,
  '/reminders': Siren,
  '/settings': Settings,
  '/vehicles': CarFront,
};

export function Topbar() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const activeSection =
    Object.entries(sectionTitles).find(([routePath]) => pathname.startsWith(routePath))?.[1] ??
    'Garage';
  const navItems =
    auth.user?.role === 'admin' ? [...appNavigation, ...adminNavigation] : appNavigation;

  const handleLogout = async () => {
    auth.logout();
    appToast.info({
      title: 'Signed out',
      description: 'Your Vehicle Vault session has been cleared.',
    });
    await navigate({ to: '/login' });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Sheet onOpenChange={setIsMobileNavOpen} open={isMobileNavOpen}>
            <SheetTrigger asChild>
              {/* Below md the bottom bar's More opens the same menu. */}
              <Button className="hidden md:inline-flex xl:hidden" size="icon-sm" variant="ghost">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <MobileNavSheetContent onClose={() => setIsMobileNavOpen(false)} />
          </Sheet>

          <div className="hidden h-8 w-px bg-slate-200/60 xl:block" />

          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-bold tracking-tight text-slate-900">{activeSection}</h2>
            <div className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-xs font-medium text-slate-400">Manage your vault</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            className={cn(
              buttonVariants({ size: 'sm', variant: 'outline' }),
              'hidden sm:inline-flex',
            )}
            to="/vehicles/new"
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            New Vehicle
          </Link>

          <div className="hidden h-8 w-px bg-slate-200/60 xl:block" />

          <NotificationCenter />

          <div className="h-6 w-px bg-slate-200/60" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={auth.user?.name || 'User profile'}
                className="h-9 w-9 rounded-full border-slate-200/60 p-0 hover:bg-slate-50"
                variant="outline"
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                  {auth.user?.name?.charAt(0)}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-xl border-slate-200/60 p-1.5">
              <DropdownMenuLabel className="px-3 py-2">
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900">{auth.user?.name}</p>
                  <p className="truncate text-[11px] font-normal text-slate-500">
                    {auth.user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuItem asChild className="rounded-lg px-3 py-2 focus:bg-slate-100">
                <Link to="/settings">
                  <Settings className="mr-2.5 h-4 w-4 text-slate-500" />
                  Account Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-lg px-3 py-2 focus:bg-slate-100">
                <Link to="/maintenance">
                  <Wrench className="mr-2.5 h-4 w-4 text-slate-500" />
                  Service History
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuItem
                className="rounded-lg px-3 py-2 text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                onClick={handleLogout}
              >
                <LogOut className="mr-2.5 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Below md the bottom bar carries these, within thumb reach. */}
      <div className="hidden items-center gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 md:flex xl:hidden">
        {navItems.map((item) => {
          const Icon = mobileIcons[item.to as keyof typeof mobileIcons] ?? item.icon;

          return (
            <Link
              key={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              activeProps={{
                className: 'bg-primary text-primary-foreground border-transparent',
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 active:scale-95',
              )}
              to={item.to}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
