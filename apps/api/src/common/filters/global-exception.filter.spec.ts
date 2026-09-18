import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from './global-exception.filter';
import { RateLimitedException } from '../rate-limit/rate-limited.exception';

const captureException = vi.hoisted(() => vi.fn());

vi.mock('@sentry/node', () => ({ captureException }));

function hostFor(path = '/api/vehicles/1/documents') {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const setHeader = vi.fn();

  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status, setHeader }),
        getRequest: () => ({ url: path }),
      }),
    } as unknown as ArgumentsHost,
    json,
    status,
    setHeader,
  };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    captureException.mockClear();
    filter = new GlobalExceptionFilter();
  });

  it('reports unexpected failures so they cannot go unnoticed', () => {
    const exception = new TypeError("Cannot read properties of undefined (reading 'x')");
    const { host, status } = hostFor();

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(captureException).toHaveBeenCalledWith(
      exception,
      expect.objectContaining({ tags: { path: '/api/vehicles/1/documents' } }),
    );
  });

  it('does not report client errors', () => {
    const { host, status } = hostFor();

    filter.catch(new BadRequestException('Validation failed'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('answers a rate-limited request with 429, RATE_LIMITED, and Retry-After', () => {
    const { host, status, json, setHeader } = hostFor('/api/auth/login');

    filter.catch(new RateLimitedException(42), host);

    expect(status).toHaveBeenCalledWith(429);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '42');
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'RATE_LIMITED' }),
      }),
    );
    // A client being told to slow down is not a fault.
    expect(captureException).not.toHaveBeenCalled();
  });

  it('sets no Retry-After on other errors', () => {
    const { host, setHeader } = hostFor();

    filter.catch(new BadRequestException('Validation failed'), host);

    expect(setHeader).not.toHaveBeenCalled();
  });
});
