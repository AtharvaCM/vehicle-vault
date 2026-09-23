/**
 * A **return path**: where someone was going when the app sent them to sign
 * in. The web app carries it as the `next` search parameter from the route
 * guard through sign-in, registration and Google/GitHub sign-in (inside the
 * signed OAuth state), and goes there once the person is signed in.
 *
 * It is followed after authentication, so it must never lead off this site:
 * only an absolute path on the same origin is kept, and everything else reads
 * as no return path at all.
 */
export const RETURN_PATH_MAX_LENGTH = 512;

/** Signed-out pages: returning to one after signing in would loop or strand the person. */
const AUTH_ENTRY_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

function hasControlCharacter(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }

  return false;
}

/**
 * The value as a same-origin return path (`/vehicles/abc?tab=reminders`), or
 * undefined. Refused:
 * - anything but a string starting with exactly one `/` (`https://…`,
 *   `//host`, `javascript:…`, relative paths);
 * - backslashes, whitespace and control characters anywhere, since browsers
 *   read `\` as `/` and drop tabs and newlines, which rebuilds `//host`;
 * - `//` or a `.`/`..` segment (also percent-encoded) in the path, which
 *   normalise into another path than the one checked;
 * - the sign-in, registration and other signed-out auth pages, and the OAuth
 *   callback.
 */
export function toSafeReturnPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > RETURN_PATH_MAX_LENGTH) {
    return undefined;
  }

  if (!value.startsWith('/') || /[\\\s]/.test(value) || hasControlCharacter(value)) {
    return undefined;
  }

  const pathname = value.split(/[?#]/, 1)[0] ?? '';

  if (pathname.includes('//') || /(^|\/)(\.|%2e){1,2}(\/|$)/i.test(pathname)) {
    return undefined;
  }

  const lowerPath = pathname.toLowerCase().replace(/\/+$/, '');

  if (
    AUTH_ENTRY_PATHS.some((path) => lowerPath === path || lowerPath.startsWith(`${path}/`)) ||
    lowerPath.startsWith('/auth/')
  ) {
    return undefined;
  }

  return value;
}
