import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from './global-exception.filter';

const captureException = vi.hoisted(() => vi.fn());

vi.mock('@sentry/node', () => ({ captureException }));

function hostFor(path = '/api/vehicles/1/documents') {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });

  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: path }),
      }),
    } as unknown as ArgumentsHost,
    json,
    status,
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
});
