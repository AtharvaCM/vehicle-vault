import { NotFoundException } from '@nestjs/common';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { IS_PUBLIC_KEY } from '../../common/auth/decorators/public.decorator';
import { RATE_LIMIT_BUCKET } from '../../common/rate-limit/rate-limit.types';
import { PUBLIC_CATALOG_CACHE_CONTROL, PublicCatalogController } from './public-catalog.controller';

const handlers = Object.getOwnPropertyNames(PublicCatalogController.prototype).filter(
  (name) => name !== 'constructor',
);

describe('PublicCatalogController', () => {
  const reflector = new Reflector();

  it('needs no bearer token on any route', () => {
    for (const name of handlers) {
      const handler = PublicCatalogController.prototype[name as keyof PublicCatalogController];
      expect(
        reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, PublicCatalogController]),
      ).toBe(true);
    }
  });

  it('rate-limits every route under the catalog bucket', () => {
    for (const name of handlers) {
      const handler = PublicCatalogController.prototype[name as keyof PublicCatalogController];
      expect(reflector.get(RATE_LIMIT_BUCKET, handler)).toBe('catalog');
    }
  });

  it('sends public cache headers on every route', () => {
    for (const name of handlers) {
      const handler = PublicCatalogController.prototype[name as keyof PublicCatalogController];
      expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({
        name: 'Cache-Control',
        value: PUBLIC_CATALOG_CACHE_CONTROL,
      });
    }
    expect(PUBLIC_CATALOG_CACHE_CONTROL).toMatch(/^public, max-age=\d+$/);
  });

  it('is not found for a segment other than cars or bikes, without a lookup', async () => {
    const service = { getVariantPage: vi.fn() };
    const controller = new PublicCatalogController(service as never);

    await expect(
      controller.getVariantPage('trucks', 'tata', 'ace', 'ace-lineup', 'base'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(service.getVariantPage).not.toHaveBeenCalled();
  });

  it('wraps the page in the success envelope', async () => {
    const service = { getVariantPage: vi.fn().mockResolvedValue({ variant: { slug: 'asta' } }) };
    const controller = new PublicCatalogController(service as never);

    await expect(
      controller.getVariantPage('cars', 'hyundai', 'i20', 'i20-lineup', 'asta'),
    ).resolves.toEqual({ success: true, data: { variant: { slug: 'asta' } } });
    expect(service.getVariantPage).toHaveBeenCalledWith({
      segment: 'cars',
      make: 'hyundai',
      model: 'i20',
      generation: 'i20-lineup',
      variant: 'asta',
    });
  });
});
