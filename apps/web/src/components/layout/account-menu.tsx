import { Link } from '@tanstack/react-router';
import {
  BellRing,
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Shield,
  Sun,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { useAuth } from '@/features/auth/hooks/use-auth';
import { themePreferences, useThemePreference, type ThemePreference } from '@/lib/theme';
import { cn } from '@/lib/utils';

import { initialsOf, useSignOut } from './use-sign-out';

export const themeOptions: Record<ThemePreference, { label: string; icon: typeof Sun }> = {
  system: { label: 'System', icon: Monitor },
  light: { label: 'Light', icon: Sun },
  dark: { label: 'Dark', icon: Moon },
};

export function AccountAvatar({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  return (
    <Avatar aria-hidden="true" className={className}>
      <AvatarFallback>{initialsOf(name)}</AvatarFallback>
    </Avatar>
  );
}

type AccountMenuProps = {
  /**
   * `row`: avatar, name and a chevron, at the foot of the desktop sidebar.
   * `avatar`: the avatar alone, in the topbar below `xl`.
   */
  trigger: 'row' | 'avatar';
  className?: string;
};

/**
 * Everything about the account rather than the vehicles: settings, where
 * alerts go, the theme, the admin area for admins, and signing out.
 */
export function AccountMenu({ trigger, className }: AccountMenuProps) {
  const auth = useAuth();
  const signOut = useSignOut();
  const [themePreference, setThemePreference] = useThemePreference();
  const name = auth.user?.name;
  const isAdmin = auth.user?.role === 'admin';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger === 'row' ? (
          <button
            aria-label={`Account menu for ${name ?? 'you'}`}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-page',
              className,
            )}
            type="button"
          >
            <AccountAvatar name={name} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-small font-semibold text-fg">{name}</span>
              <span className="truncate text-small text-fg-3">Settings and account</span>
            </span>
            <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
          </button>
        ) : (
          <button
            aria-label={`Account menu for ${name ?? 'you'}`}
            className={cn(
              'flex size-11 items-center justify-center rounded-full transition-colors hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
              className,
            )}
            type="button"
          >
            <AccountAvatar name={name} />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={trigger === 'row' ? 'start' : 'end'}
        className="w-64 p-1.5"
        side={trigger === 'row' ? 'top' : 'bottom'}
      >
        <DropdownMenuLabel className="px-2 py-2">
          <span className="block truncate text-ui font-semibold text-fg">{name}</span>
          <span className="block truncate text-small font-normal text-fg-3">
            {auth.user?.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings aria-hidden="true" className="size-4 text-fg-3" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings/preferences">
            <BellRing aria-hidden="true" className="size-4 text-fg-3" />
            Notification preferences
          </Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link to="/admin/users">
              <Shield aria-hidden="true" className="size-4 text-fg-3" />
              Admin
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-2 pt-1 pb-0.5 text-small font-medium text-fg-3">
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
                key={preference}
                onSelect={(event) => event.preventDefault()}
                value={preference}
              >
                <Icon aria-hidden="true" className="mr-2 size-4 text-fg-3" />
                {label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-late focus:bg-late-tint focus:text-late"
          onClick={() => void signOut()}
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
