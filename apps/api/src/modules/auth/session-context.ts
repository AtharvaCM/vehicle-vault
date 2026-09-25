import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';

/** What a new or refreshed session records about the device it is on. */
export type SessionContext = {
  userAgent: string | null;
  location: string | null;
};

export const NO_SESSION_CONTEXT: SessionContext = { userAgent: null, location: null };

const USER_AGENT_MAX = 400;
const LOCATION_MAX = 120;

/** Only the headers are read; a test's stand-in request may carry none. */
type WithHeaders = { headers?: IncomingHttpHeaders };

function header(request: WithHeaders, name: string): string | null {
  const value = request.headers?.[name];
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text ? text : null;
}

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

function countryName(code: string | null): string | null {
  // Cloudflare sends XX for unknown and T1 for Tor: neither is a place.
  if (!code || !/^[A-Z]{2}$/.test(code) || code === 'XX' || code === 'T1') return null;
  try {
    return countryNames.of(code) ?? null;
  } catch {
    return null;
  }
}

/**
 * An approximate place from the edge's visitor-location headers ("Pune,
 * Maharashtra, India"), or null when the request carries none. Cloudflare
 * adds `cf-ipcountry` by default, and the city and region only when its
 * visitor-location transform is on. Nothing is looked up from the IP here.
 * A client that reaches the API around the edge could send its own; the
 * place only ever labels that client's own session.
 */
export function locationFrom(request: WithHeaders): string | null {
  const parts = [
    header(request, 'cf-ipcity'),
    header(request, 'cf-region'),
    countryName(header(request, 'cf-ipcountry')?.toUpperCase() ?? null),
  ].filter((part): part is string => Boolean(part));
  const place = [...new Set(parts)].join(', ');
  return place ? place.slice(0, LOCATION_MAX) : null;
}

export function sessionContextFrom(request: WithHeaders): SessionContext {
  return {
    userAgent: header(request, 'user-agent')?.slice(0, USER_AGENT_MAX) ?? null,
    location: locationFrom(request),
  };
}

/** The request's `SessionContext`, for the handlers that start or refresh a session. */
export const CurrentSessionContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionContext =>
    sessionContextFrom(context.switchToHttp().getRequest<WithHeaders>()),
);

const BROWSERS: Array<[RegExp, string]> = [
  [/EdgA?\/|Edg\//, 'Edge'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/CriOS\/|Chrome\//, 'Chrome'],
  [/Version\/[\d.]+.*Safari\//, 'Safari'],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/iPad/, 'iPad'],
  [/iPhone|iPod/, 'iPhone'],
  [/Android/, 'Android'],
  [/CrOS/, 'ChromeOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

/**
 * A user agent in words: "Chrome on macOS", "Safari on iPhone". Null when
 * there is none (a session carried over from before sessions were recorded);
 * "Unknown browser" parts when there is one we cannot read.
 */
export function describeUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (!browser && !system) return 'Unknown device';
  if (!browser) return `A browser on ${system}`;
  return system ? `${browser} on ${system}` : browser;
}
