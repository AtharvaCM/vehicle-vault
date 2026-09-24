import {
  CarFront,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  Settings,
  Siren,
  Sun,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { themePreferences, useThemePreference, type ThemePreference } from '@/lib/theme';
import { appToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { NotificationCenter } from '@/features/notifications/components/notification-center';

import { MobileNavSheetContent } from './mobile-nav-sheet';
import { adminNavigation, appNavigation } from './sidebar';

const sectionTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/maintenance-records': 'Service record',
  '/maintenance': 'Maintenance',
  '/vehicles': 'Garage',
  '/reminders': 'Reminders',
  '/settings': 'Settings',
};

const themeOptions: Record<ThemePreference, { label: string; icon: typeof Sun }> = {
  system: { label: 'System', icon: Monitor },
  light: { label: 'Light', icon: Sun },
  dark: { label: 'Dark', icon: Moon },
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
  const [themePreference, setThemePreference] = useThemePreference();
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
    <header className="sticky top-0 z-30 border-b border-line/60 bg-surface/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Sheet onOpenChange={setIsMobileNavOpen} open={isMobileNavOpen}>
            <SheetTrigger asChild>
              {/* Below md the bottom bar's More opens the same menu. */}
              <Button
                aria-label="Open navigation"
                className="hidden md:inline-flex xl:hidden"
                size="icon-sm"
                variant="ghost"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <MobileNavSheetContent onClose={() => setIsMobileNavOpen(false)} />
          </Sheet>

          <div className="hidden h-8 w-px bg-line-subtle/60 xl:block" />

          <div className="flex items-baseline gap-2">
            <h2 className="text-lead font-bold tracking-tight text-fg">{activeSection}</h2>
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
            Add vehicle
          </Link>

          <div className="hidden h-8 w-px bg-line-subtle/60 xl:block" />

          <NotificationCenter />

          <div className="h-6 w-px bg-line-subtle/60" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={auth.user?.name || 'User profile'}
                className="rounded-full border-line/60 p-0 hover:bg-page md:h-9 md:w-9"
                size="icon"
                variant="outline"
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-page text-caption font-bold text-fg-2">
                  {auth.user?.name?.charAt(0)}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-xl border-line/60 p-1.5">
              <DropdownMenuLabel className="px-3 py-2">
                <div className="flex flex-col space-y-0.5">
                  <p className="text-ui font-semibold text-fg">{auth.user?.name}</p>
                  <p className="truncate text-caption font-normal text-fg-3">{auth.user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuItem asChild className="rounded-lg px-3 py-2 focus:bg-page">
                <Link to="/settings">
                  <Settings className="mr-2.5 h-4 w-4 text-fg-3" />
                  Account settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-lg px-3 py-2 focus:bg-page">
                <Link to="/maintenance">
                  <Wrench className="mr-2.5 h-4 w-4 text-fg-3" />
                  Service history
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuLabel className="px-3 pt-1 pb-0.5 text-small font-medium text-fg-3">
                Theme
              </DropdownMenuLabel>
              {/* Kept on this device; System follows the phone or computer. */}
              <DropdownMenuRadioGroup
                aria-label="Theme"
                onValueChange={(value) => setThemePreference(value as ThemePreference)}
                value={themePreference}
              >
                {themePreferences.map((preference) => {
                  const { label, icon: Icon } = themeOptions[preference];
                  return (
                    <DropdownMenuRadioItem
                      className="rounded-lg py-2"
                      key={preference}
                      onSelect={(event) => event.preventDefault()}
                      value={preference}
                    >
                      <Icon className="mr-2.5 h-4 w-4 text-fg-3" />
                      {label}
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuItem
                className="rounded-lg px-3 py-2 text-late focus:bg-late-tint focus:text-late"
                onClick={handleLogout}
              >
                <LogOut className="mr-2.5 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Below md the bottom bar carries these, within thumb reach. */}
      <div className="hidden items-center gap-2 overflow-x-auto border-t border-line-subtle px-4 py-2 md:flex xl:hidden">
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
                'inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-caption font-semibold text-fg-2 transition-colors hover:bg-page active:scale-95',
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
