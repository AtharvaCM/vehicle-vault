import { Link } from '@tanstack/react-router';
import { MailCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { requestPasswordReset } from '../api/request-password-reset';
import { AuthPageShell } from '../components/auth-page-shell';
import { PasswordResetRequestForm } from '../components/password-reset-request-form';

type PasswordResetPreview = {
  expiresAt?: string;
  token: string;
};

/** How long "Send again" waits after a send; the API also rate-limits mail. */
export const RESET_RESEND_COOLDOWN_SECONDS = 60;

/** Where the page is: asking for an address, sent (for that address), or mail is off. */
type RequestState = { kind: 'form' } | { kind: 'sent'; email: string } | { kind: 'unavailable' };

export function ForgotPasswordPage() {
  const [preview, setPreview] = useState<PasswordResetPreview | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<RequestState>({ kind: 'form' });
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = async (values: Parameters<typeof requestPasswordReset>[0]) => {
    setIsSubmitting(true);
    setPreview(null);
    setSubmitError(null);

    try {
      const response = await requestPasswordReset(values);

      if (response.previewToken) {
        setPreview({
          expiresAt: response.expiresAt,
          token: response.previewToken,
        });
        appToast.success({
          title: 'Reset link ready',
          description: 'This environment shows the reset link here instead of emailing it.',
        });
        return;
      }

      // A panel that stays, in place of the form: a toast that vanishes left
      // the filled form looking unsent, and people sent it again.
      setState({ kind: 'sent', email: values.email.trim() });
      setCooldown(RESET_RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      // No mail transport on this server: say so rather than promise a link.
      if (error instanceof ApiError && error.status === 503) {
        setState({ kind: 'unavailable' });
        return;
      }

      const message = getApiErrorMessage(error, 'We couldn’t start the password reset. Try again.');

      setSubmitError(message);
      appToast.error({
        title: 'Reset request failed',
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell
      alternateAction={
        <p>
          Remembered your password?{' '}
          <Link className="font-semibold text-slate-900 hover:text-slate-700" to="/login">
            Sign in
          </Link>
        </p>
      }
      description="We’ll email you a link to set a new password."
      title="Reset your password"
    >
      <div className="space-y-4">
        {state.kind === 'sent' ? (
          <div className="space-y-4" role="status">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <MailCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div className="space-y-1 text-sm text-emerald-900">
                <p className="font-semibold">Check your email</p>
                <p>
                  If an account exists for {state.email}, we’ve sent it a link to set a new
                  password. The link works for 30 minutes.
                </p>
                <p>Didn’t get it? Check your spam folder.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                disabled={isSubmitting || cooldown > 0}
                onClick={() => void handleSubmit({ email: state.email })}
                type="button"
                variant="outline"
              >
                {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send again'}
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setState({ kind: 'form' });
                  setCooldown(0);
                }}
                type="button"
                variant="ghost"
              >
                Use a different email
              </Button>
            </div>
            {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}
          </div>
        ) : state.kind === 'unavailable' ? (
          <div
            className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            role="status"
          >
            <p className="font-semibold">Password reset by email isn’t available yet</p>
            <p>
              This server can’t send email right now, so no link can reach you. Contact{' '}
              <a className="font-semibold underline" href="mailto:support@middle-earth.in">
                support@middle-earth.in
              </a>{' '}
              to get back into your account.
            </p>
          </div>
        ) : (
          <PasswordResetRequestForm
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            submitError={submitError}
          />
        )}

        {preview ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">Development reset preview</p>
              <p className="text-xs leading-5 text-slate-600">
                This environment shows the reset link here so you can continue without a mailbox.
              </p>
            </div>

            <Input readOnly value={preview.token} />

            <div className="flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {preview.expiresAt ? `Expires ${format.date(preview.expiresAt, 'dateTime')}` : null}
              </span>
              <Button asChild size="sm" variant="secondary">
                <a href={`/reset-password?token=${encodeURIComponent(preview.token)}`}>
                  Continue to reset
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </AuthPageShell>
  );
}
