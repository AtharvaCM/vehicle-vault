import { ValidationPipe } from '@nestjs/common';
import { MaintenanceCategory, ServiceBaselineStatus } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { UpsertServiceBaselineDto } from './upsert-service-baseline.dto';

/**
 * Mirrors the global pipe configured in `main.ts`.
 *
 * The service spec calls the service directly and so never meets this pipe —
 * which is how a DTO carrying only Swagger decorators shipped and rejected
 * every request with "property entries should not exist". `whitelist` plus
 * `forbidNonWhitelisted` means an undecorated property is not merely ignored,
 * it fails the request.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

const metadata = { type: 'body' as const, metatype: UpsertServiceBaselineDto };

const transform = (body: unknown) => pipe.transform(body, metadata);

describe('UpsertServiceBaselineDto', () => {
  it('accepts a known reading', async () => {
    await expect(
      transform({
        entries: [
          {
            category: MaintenanceCategory.BrakePads,
            status: ServiceBaselineStatus.Known,
            lastDoneOdometer: 5_000,
          },
        ],
      }),
    ).resolves.toMatchObject({
      entries: [expect.objectContaining({ lastDoneOdometer: 5_000 })],
    });
  });

  it('accepts an explicit unknown carrying nothing else', async () => {
    await expect(
      transform({
        entries: [{ category: MaintenanceCategory.Coolant, status: ServiceBaselineStatus.Unknown }],
      }),
    ).resolves.toMatchObject({ entries: [expect.objectContaining({ status: 'unknown' })] });
  });

  it('rejects an empty batch', async () => {
    await expect(transform({ entries: [] })).rejects.toThrow();
  });

  it('rejects a category outside the enum', async () => {
    await expect(
      transform({
        entries: [{ category: 'sunroof_lubrication', status: ServiceBaselineStatus.Unknown }],
      }),
    ).rejects.toThrow();
  });

  it('rejects a negative odometer', async () => {
    await expect(
      transform({
        entries: [
          {
            category: MaintenanceCategory.BrakePads,
            status: ServiceBaselineStatus.Known,
            lastDoneOdometer: -1,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects an unknown property inside an entry', async () => {
    await expect(
      transform({
        entries: [
          {
            category: MaintenanceCategory.BrakePads,
            status: ServiceBaselineStatus.Unknown,
            lastDoneKm: 5_000,
          },
        ],
      }),
    ).rejects.toThrow();
  });
});
