import { NotFoundException } from '@nestjs/common';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';

import { IS_PUBLIC_KEY } from '../../common/auth/decorators/public.decorator';
import { RATE_LIMIT_BUCKET } from '../../common/rate-limit/rate-limit.types';
import { ModelPageBatchQueryDto } from './dto/model-page-batch-query.dto';
import { VariantPageBatchQueryDto } from './dto/variant-page-batch-query.dto';
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

  it('covers the index and the bulk variant pages', () => {
    expect(handlers).toEqual(
      expect.arrayContaining(['getIndex', 'getVariantPageBatch', 'getVariantPage']),
    );
  });

  it('wraps the index in the success envelope', async () => {
    const service = { getIndex: vi.fn().mockResolvedValue({ variants: [] }) };
    const controller = new PublicCatalogController(service as never);

    await expect(controller.getIndex()).resolves.toEqual({
      success: true,
      data: { variants: [] },
    });
  });

  it('reads the first full batch of variant pages when no page is asked for', async () => {
    const batch = { items: [], page: 1, pageSize: 200, total: 0, hasMore: false };
    const service = { getVariantPageBatch: vi.fn().mockResolvedValue(batch) };
    const controller = new PublicCatalogController(service as never);

    await expect(controller.getVariantPageBatch({})).resolves.toEqual({
      success: true,
      data: batch,
    });
    expect(service.getVariantPageBatch).toHaveBeenCalledWith({ page: 1, pageSize: 200 });

    await controller.getVariantPageBatch({ page: 3, pageSize: 50 });
    expect(service.getVariantPageBatch).toHaveBeenLastCalledWith({ page: 3, pageSize: 50 });
  });

  it('refuses a batch larger than the cap or a page below one', async () => {
    const errorsFor = async (query: Record<string, string>) =>
      (await validate(plainToInstance(VariantPageBatchQueryDto, query))).map(
        (error) => error.property,
      );

    expect(await errorsFor({ page: '2', pageSize: '200' })).toEqual([]);
    expect(await errorsFor({ pageSize: '201' })).toEqual(['pageSize']);
    expect(await errorsFor({ page: '0' })).toEqual(['page']);
    expect(await errorsFor({ page: 'two' })).toEqual(['page']);
  });

  it('covers the model page and the bulk model pages', () => {
    expect(handlers).toEqual(expect.arrayContaining(['getModelPageBatch', 'getModelPage']));
  });

  it('is not found for a model outside cars or bikes, without a lookup', async () => {
    const service = { getModelPage: vi.fn() };
    const controller = new PublicCatalogController(service as never);

    await expect(controller.getModelPage('trucks', 'tata', 'ace')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(service.getModelPage).not.toHaveBeenCalled();
  });

  it('wraps a model page in the success envelope', async () => {
    const service = { getModelPage: vi.fn().mockResolvedValue({ model: { slug: 'i20' } }) };
    const controller = new PublicCatalogController(service as never);

    await expect(controller.getModelPage('cars', 'hyundai', 'i20')).resolves.toEqual({
      success: true,
      data: { model: { slug: 'i20' } },
    });
    expect(service.getModelPage).toHaveBeenCalledWith({
      segment: 'cars',
      make: 'hyundai',
      model: 'i20',
    });
  });

  it('reads the first full batch of model pages when no page is asked for', async () => {
    const batch = { items: [], page: 1, pageSize: 100, total: 0, hasMore: false };
    const service = { getModelPageBatch: vi.fn().mockResolvedValue(batch) };
    const controller = new PublicCatalogController(service as never);

    await expect(controller.getModelPageBatch({})).resolves.toEqual({
      success: true,
      data: batch,
    });
    expect(service.getModelPageBatch).toHaveBeenCalledWith({ page: 1, pageSize: 100 });

    await controller.getModelPageBatch({ page: 2, pageSize: 25 });
    expect(service.getModelPageBatch).toHaveBeenLastCalledWith({ page: 2, pageSize: 25 });
  });

  it('refuses a model batch larger than its cap or a page below one', async () => {
    const errorsFor = async (query: Record<string, string>) =>
      (await validate(plainToInstance(ModelPageBatchQueryDto, query))).map(
        (error) => error.property,
      );

    expect(await errorsFor({ page: '2', pageSize: '100' })).toEqual([]);
    expect(await errorsFor({ pageSize: '101' })).toEqual(['pageSize']);
    expect(await errorsFor({ page: '0' })).toEqual(['page']);
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
