import { Mail, LogOut, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '../hooks/use-auth';
import { resendVerification } from '../api/resend-verification';

export function EmailVerificationScreen() {
  const { user, logout } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [hasSent, setHasSent] = useState(false);

  const handleResend = async () => {
    if (!user?.email) return;

    setIsResending(true);
    try {
      await resendVerification({ email: user.email });
      setHasSent(true);
      toast.success('Verification email sent!', {
        description: 'Please check your inbox (and spam folder).',
      });
      // Reset "Sent" state after 60 seconds to allow another resend
      setTimeout(() => setHasSent(false), 60000);
    } catch (error) {
      toast.error('Failed to resend email', {
        description: 'Please try again later or contact support.',
      });
    } finally {
      setIsResending(false);
    }
  };

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
            We've sent a verification link to <span className="font-semibold text-slate-900">{user?.email}</span>. 
            Please check your inbox to activate your account.
          </p>
        </div>

        <div className="space-y-4">
          <Button
            className="w-full flex h-11 items-center justify-center gap-2 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            disabled={isResending || hasSent}
            onClick={handleResend}
          >
            {isResending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : hasSent ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : null}
            {isResending ? 'Sending...' : hasSent ? 'Check your email' : 'Resend verification email'}
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
          <p>Need help? <a href="mailto:support@vehiclevault.com" className="font-medium text-slate-900 hover:underline">Contact support</a></p>
        </div>
      </div>
    </div>
  );
}
