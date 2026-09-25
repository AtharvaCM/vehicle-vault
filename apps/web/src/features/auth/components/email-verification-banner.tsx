import { useRouter } from '@tanstack/react-router';
import { MailWarning, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { useAuth } from '../hooks/use-auth';
import { useResendVerification } from '../hooks/use-resend-verification';

const DISMISSED_STORAGE_KEY = 'vehicle-vault.verification-banner-dismissed';

type EmailVerificationBannerProps = {
  daysLeft: number;
};

/**
 * The reminder an unverified account sees while it can still use the app.
 * Dismissing it lasts for the rest of the day, so the countdown comes back
 * each morning instead of going quiet until the wall.
 */
export function EmailVerificationBanner({ daysLeft }: EmailVerificationBannerProps) {
  const { user } = useAuth();
  const { resend, isResending, hasSent } = useResendVerification(user?.email);
  const [isDismissed, setIsDismissed] = useState(() => (user ? wasDismissedToday(user.id) : false));
  // Home's setup checklist carries the email step while the grace period runs
  // (#346): one reminder there, not a banner above it saying the same.
  const onHome = useRouter({ warn: false })?.state.location.pathname === '/home';

  if (!user || isDismissed || onHome) {
    return null;
  }

  function dismiss() {
    if (!user) return;
    rememberDismissal(user.id);
    setIsDismissed(true);
  }

  return (
    <div className="border-b border-soon/30 bg-soon-tint" role="status">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <MailWarning aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-soon" />
          <p className="min-w-0 text-ui text-soon">
            <span className="font-semibold">
              Verify your email — {daysLeft <= 1 ? 'last day' : `${daysLeft} days left`}.
            </span>{' '}
            We sent a link to <span className="break-all font-medium">{user.email}</span>; open it
            before then to keep using Vehicle Vault.
          </p>
        </div>
        <div className="flex items-center gap-1 pl-8 sm:pl-0">
          <Button
            disabled={isResending || hasSent}
            onClick={() => void resend()}
            size="sm"
            variant="outline"
          >
            {isResending ? 'Sending…' : hasSent ? 'Sent — check your inbox' : 'Resend email'}
          </Button>
          <Button
            aria-label="Dismiss until tomorrow"
            className="text-soon hover:bg-soon-tint"
            onClick={dismiss}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Today in the browser's own calendar, which is the one "until tomorrow" means. */
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function wasDismissedToday(userId: string): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return false;
    const stored = JSON.parse(raw) as { userId?: unknown; day?: unknown };
    return stored.userId === userId && stored.day === today();
  } catch {
    return false;
  }
}

function rememberDismissal(userId: string) {
  try {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify({ userId, day: today() }));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); then the
    // dismissal simply lasts until the next page load.
  }
}
