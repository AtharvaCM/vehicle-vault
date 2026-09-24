import { CheckCircle2, LogOut, Mail, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useAuth } from '../hooks/use-auth';
import { useResendVerification } from '../hooks/use-resend-verification';

export function EmailVerificationScreen() {
  const { user, logout } = useAuth();
  const { resend, isResending, hasSent } = useResendVerification(user?.email);

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-line bg-surface p-8 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-page ring-8 ring-page/50">
            <Mail className="h-10 w-10 text-fg" />
          </div>

          <h2 className="text-title font-extrabold tracking-tight text-fg">Verify your email</h2>
          <p className="mt-3 text-fg-3">
            We&apos;ve sent a verification link to{' '}
            <span className="break-all font-semibold text-fg">{user?.email}</span>. Open it to keep
            using Vehicle Vault — everything you have added is still here.
          </p>
        </div>

        <div className="space-y-4">
          <Button
            className="w-full flex h-11 items-center justify-center gap-2 rounded-xl transition-colors"
            disabled={isResending || hasSent}
            onClick={() => void resend()}
          >
            {isResending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : hasSent ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : null}
            {isResending
              ? 'Sending...'
              : hasSent
                ? 'Check your email'
                : 'Resend verification email'}
          </Button>

          <Button
            className="w-full flex h-11 items-center justify-center gap-2 rounded-xl border-line text-fg-2 transition-colors hover:bg-page hover:text-fg"
            variant="outline"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>

        <div className="mt-8 border-t border-line-subtle pt-6 text-center text-ui text-fg-3">
          <p>
            Need help?{' '}
            <a
              href="mailto:support@middle-earth.in"
              className="font-medium text-fg hover:underline"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
