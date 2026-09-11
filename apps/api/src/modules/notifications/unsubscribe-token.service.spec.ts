import { describe, expect, it } from 'vitest';

import { UnsubscribeTokenService } from './unsubscribe-token.service';

const service = (jwtSecret = 'secret-a') => new UnsubscribeTokenService({ jwtSecret } as never);

describe('UnsubscribeTokenService', () => {
  it('round-trips the user it was issued for', () => {
    const tokens = service();
    const userId = '7f3c0b4e-1d2a-4c5b-9e8f-0a1b2c3d4e5f';

    expect(tokens.verify(tokens.issue(userId))).toBe(userId);
  });

  it('produces a token that is safe to carry in a query string', () => {
    const token = service().issue('7f3c0b4e-1d2a-4c5b-9e8f-0a1b2c3d4e5f');

    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(token)).toBe(token);
  });

  it('rejects a token whose signature has been altered', () => {
    const tokens = service();
    const token = tokens.issue('user-1');
    const [payload, signature] = token.split('.');
    const tampered = `${payload}.${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;

    expect(tokens.verify(tampered)).toBeNull();
  });

  it('rejects a token whose user id has been swapped for someone else’s', () => {
    // The attack the signature exists to stop: keep a valid signature, point it
    // at a different account, and silence that account's email.
    const tokens = service();
    const [, signature] = tokens.issue('user-1').split('.');
    const swapped = `${Buffer.from('user-2', 'utf8').toString('base64url')}.${signature}`;

    expect(tokens.verify(swapped)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    expect(service('secret-b').verify(service('secret-a').issue('user-1'))).toBeNull();
  });

  it('rejects malformed input instead of throwing at a person who clicked a link', () => {
    const tokens = service();

    for (const bad of ['', '.', 'nodot', 'a.', '.b', '!!!.???', 'x'.repeat(500)]) {
      expect(tokens.verify(bad)).toBeNull();
    }
  });

  it('does not treat a mangled payload as a valid user id', () => {
    // base64url decoding silently drops characters outside its alphabet, so a
    // truncated link must fail the signature rather than name a shorter id.
    const tokens = service();
    const token = tokens.issue('user-1');

    expect(tokens.verify(token.slice(1))).toBeNull();
  });
});
