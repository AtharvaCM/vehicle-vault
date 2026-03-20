import {
  Bell,
  CarFront,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Siren,
  UserCircle2,
  Wrench,
} from 'lucide-react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';

import { APP_NAME } from '@vehicle-vault/shared';

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { appToast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';

import { appNavigation } from './sidebar';

const sectionTitles: Record<string, string> = {
  '/dashboard': 'Dashboard overview',
  '/maintenance-records': 'Maintenance record',
  '/maintenance': 'Maintenance history',
  '/vehicles': 'Vehicle workspace',
  '/reminders': 'Reminder center',
  '/settings': 'Workspace settings',
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
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const activeSection =
    Object.entries(sectionTitles).find(([routePath]) => pathname.startsWith(routePath))?.[1] ??
    'Workspace';

  const handleLogout = async () => {
    auth.logout();
    appToast.info({
      title: 'Signed out',
      description: 'Your Vehicle Vault session has been cleared.',
    });
    await navigate({ to: '/login' });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-white/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button className="xl:hidden" size="icon-sm" variant="outline">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[320px] p-0" side="left">
              <SheetHeader className="border-b border-border/70 px-6 py-5">
                <SheetTitle>{APP_NAME}</SheetTitle>
                <SheetDescription>Move through your dashboard, vehicles, reminders, and service records.</SheetDescription>
              </SheetHeader>

              <nav className="grid gap-2 p-4">
                {appNavigation.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.to}
                      activeOptions={{ exact: item.exact ?? false }}
                      activeProps={{
                        className: 'border-slate-950/10 bg-slate-950 text-white hover:bg-slate-900',
                      }}
                      className="flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm transition-colors hover:bg-accent"
                      to={item.to}
                    >
                      <Icon className="h-4 w-4" />
                      <div className="space-y-0.5">
                        <p className="font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {APP_NAME}
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{activeSection}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} to="/vehicles/new">
            Add Vehicle
          </Link>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() =>
                  appToast.info({
                    title: 'Notifications are not wired yet',
                    description: 'Reminders are visible in the dashboard and reminders pages today.',
                  })
                }
                size="icon-sm"
                variant="ghost"
              >
                <Bell className="h-4 w-4" />
                <span className="sr-only">Notifications</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Notification delivery will land in a later slice.</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-full px-3" variant="outline">
                <UserCircle2 className="mr-2 h-4 w-4" />
                <span className="hidden max-w-[140px] truncate sm:inline-block">
                  {auth.user?.name}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{auth.user?.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {auth.user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-t border-border/60 px-4 py-3 xl:hidden">
        {appNavigation.map((item) => {
          const Icon = mobileIcons[item.to] ?? LayoutDashboard;

          return (
            <Link
              key={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              activeProps={{
                className: 'bg-slate-950 text-white border-slate-950',
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
              )}
              to={item.to}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
