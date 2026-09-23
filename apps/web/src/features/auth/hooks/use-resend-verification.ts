import { useCallback, useEffect, useRef, useState } from 'react';

import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { resendVerification } from '../api/resend-verification';

/**
 * How long the resend action stays spent after a send. The API rate-limits the
 * endpoint as well; this only stops a double click from sending twice.
 */
export const RESEND_COOLDOWN_MS = 60_000;

/** The resend action the verification wall and banner share, cooldown included. */
export function useResendVerification(email: string | undefined) {
  const [isResending, setIsResending] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    },
    [],
  );

  const resend = useCallback(async () => {
    if (!email) return;

    setIsResending(true);
    try {
      const response = await resendVerification({ email });
      // An API from before `delivered` existed sent the mail or failed loudly.
      if (response.delivered === false) {
        setIsUnavailable(true);
        appToast.info({
          title: 'Email isn’t available yet',
          description: 'No link was sent. Every alert still appears in the app.',
        });
        return;
      }
      setHasSent(true);
      appToast.success({
        title: 'Verification email sent',
        description: 'Check your inbox, and the spam folder if it is not there.',
      });
      cooldownRef.current = setTimeout(() => setHasSent(false), RESEND_COOLDOWN_MS);
    } catch (error) {
      appToast.error({
        title: 'Could not resend the email',
        description: getApiErrorMessage(error, 'Try again later or contact support.'),
      });
    } finally {
      setIsResending(false);
    }
  }, [email]);

  return { resend, isResending, hasSent, isUnavailable };
}
