import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
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

export function ForgotPasswordPage() {
  const [preview, setPreview] = useState<PasswordResetPreview | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          title: 'Reset token generated',
          description: 'Use the preview token below to set a new password in this environment.',
        });
        return;
      }

      appToast.success({
        title: 'Reset requested',
        description: 'If the email matches an account, a password reset link has been sent.',
      });
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        'Unable to start the password reset flow right now.',
      );

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
      description="Request a one-time link to recover access to your Vehicle Vault account."
      title="Reset your password"
    >
      <div className="space-y-4">
        <PasswordResetRequestForm
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          submitError={submitError}
        />

        {preview ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">Development reset preview</p>
              <p className="text-xs leading-5 text-slate-600">
                This environment returns the token directly so you can continue the reset flow
                without relying on mailbox delivery.
              </p>
            </div>

            <Input readOnly value={preview.token} />

            <div className="flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {preview.expiresAt
                  ? `Expires ${new Date(preview.expiresAt).toLocaleString()}`
                  : null}
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
