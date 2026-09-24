import { Link } from '@tanstack/react-router';
import { BellRing, ChevronRight, LogOut, Settings, Shield } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { canSeeCatalogReview, canSeeUsers } from '@/features/admin/lib/admin-access';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { themePreferences, useThemePreference, type ThemePreference } from '@/lib/theme';
import { cn } from '@/lib/utils';

import { AccountAvatar, themeOptions } from './account-menu';
import { navItem, type NavSection } from './navigation';
import { useActiveSection } from './use-active-section';
import { useSignOut } from './use-sign-out';

/** The destinations that do not fit on the phone's bar, in nav order. */
export const MORE_SECTIONS: readonly NavSection[] = ['costs'];

const ROW_CLASS =
  'flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-body font-medium text-fg transition-colors hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring';

function SheetLink({ children, ...props }: { children: ReactNode } & Parameters<typeof Link>[0]) {
  return (
    <SheetClose asChild>
      <Link className={ROW_CLASS} {...props}>
        {children}
        <ChevronRight aria-hidden="true" className="ml-auto size-4 text-fg-3" />
      </Link>
    </SheetClose>
  );
}

/**
 * The phone's More, a bottom sheet rising from the bar it was opened from:
 * the destinations the bar has no room for, then the account menu's contents
 * (settings, alert preferences, theme, admin, sign out).
 */
export function MoreSheetContent({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const signOut = useSignOut();
  const activeSection = useActiveSection();
  const [themePreference, setThemePreference] = useThemePreference();
  const name = auth.user?.name;

  return (
    <SheetContent
      className="max-h-[85dvh] overflow-y-auto rounded-t-sheet px-3 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      side="bottom"
    >
      <SheetHeader className="px-3 pb-2 text-left">
        <SheetTitle>More</SheetTitle>
        <SheetDescription className="sr-only">
          The rest of the app, and your account.
        </SheetDescription>
      </SheetHeader>

      <nav aria-label="More destinations" className="flex flex-col">
        {MORE_SECTIONS.map((section) => {
          const item = navItem(section);
          const Icon = item.icon;
          return (
            <SheetLink
              className={cn(ROW_CLASS, activeSection === section && 'bg-brand-tint text-brand')}
              key={section}
              to={item.to}
            >
              <Icon aria-hidden="true" className="size-5 text-fg-3" strokeWidth={1.75} />
              {item.label}
            </SheetLink>
          );
        })}
      </nav>

      <div className="mt-3 border-t border-line pt-3">
        <div className="flex items-center gap-3 px-3 pb-2">
          <AccountAvatar name={name} />
          <div className="min-w-0">
            <p className="truncate text-ui font-semibold text-fg">{name}</p>
            <p className="truncate text-small text-fg-3">{auth.user?.email}</p>
          </div>
        </div>
        <SheetLink to="/settings">
          <Settings aria-hidden="true" className="size-5 text-fg-3" strokeWidth={1.75} />
          Settings
        </SheetLink>
        <SheetLink to="/settings/preferences">
          <BellRing aria-hidden="true" className="size-5 text-fg-3" strokeWidth={1.75} />
          Notification preferences
        </SheetLink>
        {canSeeUsers(auth.user) ? (
          <SheetLink to="/admin">
            <Shield aria-hidden="true" className="size-5 text-fg-3" strokeWidth={1.75} />
            Admin
          </SheetLink>
        ) : canSeeCatalogReview(auth.user) ? (
          <SheetLink to="/admin/catalog">
            <Shield aria-hidden="true" className="size-5 text-fg-3" strokeWidth={1.75} />
            Catalog curation
          </SheetLink>
        ) : null}

        <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-1">
          <span className="text-body font-medium text-fg" id="more-theme-label">
            Theme
          </span>
          {/* Kept on this device; System follows the phone. */}
          <ToggleGroup
            aria-labelledby="more-theme-label"
            onValueChange={(value) => {
              if (value) setThemePreference(value as ThemePreference);
            }}
            type="single"
            value={themePreference}
          >
            {themePreferences.map((preference) => (
              <ToggleGroupItem key={preference} value={preference}>
                {themeOptions[preference].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <button
          className={cn(ROW_CLASS, 'text-late hover:bg-late-tint')}
          onClick={() => {
            onClose();
            void signOut();
          }}
          type="button"
        >
          <LogOut aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </SheetContent>
  );
}
