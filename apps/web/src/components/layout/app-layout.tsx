import type { PropsWithChildren } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useRecheckVerificationOnReturn } from '@/features/auth/hooks/use-recheck-verification-on-return';
import { EmailVerificationBanner } from '@/features/auth/components/email-verification-banner';
import { EmailVerificationScreen } from '@/features/auth/components/email-verification-screen';
import { getVerificationStatus } from '@/features/auth/lib/verification-status';
import { BottomNav } from './bottom-nav';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppLayout({ children }: PropsWithChildren) {
  const { user } = useAuth();
  // A new account gets a week in the app before the wall; see verification-status.ts.
  const verification = getVerificationStatus(user);
  useRecheckVerificationOnReturn(verification.kind !== 'none');

  if (verification.kind === 'required') {
    return (
      <div className="min-h-screen bg-page/70 text-foreground" data-clarity-mask="True">
        <EmailVerificationScreen />
      </div>
    );
  }

  // Everything signed-in is masked in Clarity recordings: registration numbers,
  // policy numbers and scanned documents all render in here. See init-clarity.ts.
  return (
    <div className="min-h-screen bg-page/70 text-foreground" data-clarity-mask="True">
      <a
        className="sr-only left-4 top-4 z-50 rounded-lg bg-fg px-3 py-2 text-ui font-medium text-surface focus:not-sr-only focus:absolute focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-fg"
        href="#main-content"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Topbar />
          {/* Below md the bottom bar is fixed over the page: leave its height (64px
              plus a 1px border, rounded up for air) and the iOS home-indicator inset,
              so the last row of a list stays clear of it. */}
          <main
            className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"
            id="main-content"
          >
            {verification.kind === 'grace' ? (
              <EmailVerificationBanner daysLeft={verification.daysLeft} />
            ) : null}
            {children}
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
