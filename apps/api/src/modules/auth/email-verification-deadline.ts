/**
 * How long a new account may use the app before its email has to be verified.
 *
 * Verification protects the address, not the data: the only thing that writes
 * to it unasked is alert email, and that already waits for verification. So
 * the wall can wait too, and a new account reaches its garage without an inbox
 * round-trip first.
 */
export const EMAIL_VERIFICATION_GRACE_DAYS = 7;

const GRACE_MS = EMAIL_VERIFICATION_GRACE_DAYS * 24 * 60 * 60 * 1000;

/**
 * An OAuth sign-in that brings no email gets a made-up address on this domain.
 * There is nowhere to send a link, so there is nothing to wait for.
 */
export const OAUTH_PLACEHOLDER_EMAIL_DOMAIN = 'oauth.local';

type VerifiableUser = {
  email: string;
  emailVerified: boolean;
  createdAt: string | Date;
};

/**
 * When the web app starts requiring verification for this account, or null
 * when it never will: the address is verified, or there is no address.
 */
export function getEmailVerificationDueAt(user: VerifiableUser): string | null {
  if (user.emailVerified || isPlaceholderEmail(user.email)) {
    return null;
  }

  return new Date(new Date(user.createdAt).getTime() + GRACE_MS).toISOString();
}

function isPlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${OAUTH_PLACEHOLDER_EMAIL_DOMAIN}`);
}
