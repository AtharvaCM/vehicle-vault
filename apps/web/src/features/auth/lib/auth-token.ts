const JWT_EXPIRY_SKEW_MS = 30_000;

type JwtPayload = {
  exp?: number;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(padded);
  }

  throw new Error('Base64 decoding is not available in this runtime.');
}

export function getAccessTokenPayload(token: string): JwtPayload | null {
  const segments = token.split('.');
  const payloadSegment = segments[1];

  if (segments.length < 2 || !payloadSegment) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(payloadSegment)) as JwtPayload;
  } catch {
    return null;
  }
}

export function getAccessTokenExpiryEpochMs(token: string) {
  const payload = getAccessTokenPayload(token);

  if (typeof payload?.exp !== 'number') {
    return null;
  }

  return payload.exp * 1000;
}

export function hasAccessTokenExpiry(token: string) {
  return getAccessTokenExpiryEpochMs(token) !== null;
}

export function isAccessTokenExpired(token: string, now = Date.now()) {
  const expiryEpochMs = getAccessTokenExpiryEpochMs(token);

  if (!expiryEpochMs) {
    return false;
  }

  return expiryEpochMs - JWT_EXPIRY_SKEW_MS <= now;
}
