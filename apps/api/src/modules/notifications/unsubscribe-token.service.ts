import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';

/**
 * The only thing this token may ever do. Mixed into both the key derivation and
 * the signed message, so a token minted here cannot be replayed against some
 * future signed-link feature and a token from one cannot be replayed here.
 */
const TOKEN_PURPOSE = 'alert-email-unsubscribe:v1';

/**
 * Proof that whoever holds this link controls the mailbox we sent it to —
 * nothing more. It is not a session, it names no scope beyond muting alert
 * email, and it cannot be exchanged for one: `AuthService` never sees it and
 * the endpoint that accepts it issues no cookie and returns no user data.
 *
 * Stateless HMAC rather than a row like the password-reset token, because an
 * unsubscribe link must keep working in a year-old email sitting in an archive.
 * A stored token would have to either never expire (a permanent credential on
 * the user row, which is worse) or break the promise the header makes to the
 * mail client. There is nothing to revoke: the token only ever reduces what we
 * send, so a leaked one can silence a user's alert email and do nothing else,
 * and the user can turn it back on from Settings.
 */
@Injectable()
export class UnsubscribeTokenService {
  constructor(private readonly appConfigService: AppConfigService) {}

  /** `<userId>.<signature>` — URL-safe, no padding, safe in a query string. */
  issue(userId: string): string {
    return `${encode(userId)}.${this.sign(userId)}`;
  }

  /**
   * The user the token names, or null when it is malformed, truncated, or
   * signed with anything but our key. Never throws: the caller renders a page
   * for a human who clicked a link, not a stack trace.
   */
  verify(token: string): string | null {
    const separator = token.lastIndexOf('.');
    if (separator <= 0 || separator === token.length - 1) return null;

    let userId: string;
    try {
      userId = decode(token.slice(0, separator));
    } catch {
      return null;
    }
    if (!userId) return null;

    return equalsConstantTime(token.slice(separator + 1), this.sign(userId)) ? userId : null;
  }

  private sign(userId: string): string {
    return createHmac('sha256', this.key())
      .update(`${TOKEN_PURPOSE}:${userId}`)
      .digest('base64url');
  }

  /**
   * Derived from the JWT secret rather than read from an env var of its own:
   * one fewer secret to rotate and to forget in a deployment, and HMAC with a
   * fixed label is a standard key separation — the derived key cannot be used
   * to mint a JWT and a JWT secret leak is already total.
   */
  private key(): Buffer {
    return createHmac('sha256', this.appConfigService.jwtSecret).update(TOKEN_PURPOSE).digest();
  }
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  // base64url is not self-validating — Buffer silently drops anything outside
  // the alphabet — so the round trip is what actually rejects a mangled id.
  const decoded = Buffer.from(value, 'base64url').toString('utf8');
  return encode(decoded) === value ? decoded : '';
}

function equalsConstantTime(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
