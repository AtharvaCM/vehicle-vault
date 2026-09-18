import { CheckCircle2, LogOut, Mail, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useAuth } from '../hooks/use-auth';
import { useResendVerification } from '../hooks/use-resend-verification';

export function EmailVerificationScreen() {
  const { user, logout } = useAuth();
  const { resend, isResending, hasSent } = useResendVerification(user?.email);

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 ring-8 ring-slate-50/50">
            <Mail className="h-10 w-10 text-slate-900" />
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Verify your email
          </h2>
          <p className="mt-3 text-slate-500">
            We&apos;ve sent a verification link to{' '}
            <span className="break-all font-semibold text-slate-900">{user?.email}</span>. Open it
            to keep using Vehicle Vault — everything you have added is still here.
          </p>
        </div>

        <div className="space-y-4">
          <Button
            className="w-full flex h-11 items-center justify-center gap-2 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
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
            className="w-full flex h-11 items-center justify-center gap-2 rounded-xl border-slate-200 text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
            variant="outline"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6 text-center text-sm text-slate-400">
          <p>
            Need help?{' '}
            <a
              href="mailto:support@middle-earth.in"
              className="font-medium text-slate-900 hover:underline"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
