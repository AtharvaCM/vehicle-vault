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

export function getTokenPayload(token: string): JwtPayload | null {
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

export function getTokenExpiryEpochMs(token: string) {
  const payload = getTokenPayload(token);

  if (typeof payload?.exp !== 'number') {
    return null;
  }

  return payload.exp * 1000;
}

export function hasTokenExpiry(token: string) {
  return getTokenExpiryEpochMs(token) !== null;
}

export function isTokenExpired(token: string, now = Date.now()) {
  const expiryEpochMs = getTokenExpiryEpochMs(token);

  if (!expiryEpochMs) {
    return false;
  }

  return expiryEpochMs - JWT_EXPIRY_SKEW_MS <= now;
}

export const getAccessTokenPayload = getTokenPayload;
export const getAccessTokenExpiryEpochMs = getTokenExpiryEpochMs;
export const hasAccessTokenExpiry = hasTokenExpiry;
export const isAccessTokenExpired = isTokenExpired;
