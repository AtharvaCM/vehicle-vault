import { LogOut, Plus } from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';

import { APP_NAME } from '@vehicle-vault/shared';

import { Button } from '@/components/ui/button';
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { appToast } from '@/lib/toast';

import { adminNavigation, appNavigation } from './sidebar';

type MobileNavSheetContentProps = {
  /** Closes the owning sheet; logging out does not go through a SheetClose. */
  onClose: () => void;
};

/**
 * Every destination, for widths without the sidebar. The topbar's menu button
 * opens it from `md` up to `xl`; below `md` the bottom bar's More does, for the
 * destinations that do not fit on the bar itself.
 */
export function MobileNavSheetContent({ onClose }: MobileNavSheetContentProps) {
  const auth = useAuth();
  const navigate = useNavigate();
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
    <SheetContent className="w-[88vw] max-w-sm p-0" side="left">
      <SheetHeader className="border-b border-slate-200/60 px-6 py-6 text-left">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground shadow-premium-sm">
            VV
          </div>
          <SheetTitle className="text-lg font-bold tracking-tight">{APP_NAME}</SheetTitle>
        </div>
        <SheetDescription className="mt-1 text-[13px]">
          Manage your garage, records, and reminders.
        </SheetDescription>
      </SheetHeader>

      <div className="flex h-[calc(100vh-100px)] flex-col">
        <nav className="grid gap-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <SheetClose asChild key={item.to}>
                <Link
                  activeOptions={{ exact: item.exact ?? false }}
                  activeProps={{
                    className: 'bg-primary text-primary-foreground shadow-premium-sm',
                  }}
                  className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium transition-all hover:bg-slate-100"
                  to={item.to}
                >
                  <Icon className="h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <p className="leading-none">{item.label}</p>
                    <p className="mt-1 text-[10px] opacity-70">{item.subtitle}</p>
                  </div>
                </Link>
              </SheetClose>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-slate-200/60 p-4">
          <div className="rounded-xl border border-slate-200/50 bg-slate-50/50 p-4 shadow-premium-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-premium-sm">
                <span className="text-xs font-bold">{auth.user?.name?.charAt(0)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{auth.user?.name}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <SheetClose asChild>
                <Link className="w-full" to="/vehicles/new">
                  <Button className="w-full shadow-premium-sm" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Vehicle
                  </Button>
                </Link>
              </SheetClose>
              <Button
                className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => {
                  void handleLogout();
                  onClose();
                }}
                size="sm"
                variant="ghost"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SheetContent>
  );
}
