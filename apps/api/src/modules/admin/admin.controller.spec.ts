import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';

import { ROLES_KEY } from '../../common/auth/decorators/roles.decorator';
import { AdminController } from './admin.controller';
import { ProductEventSummaryQueryDto } from './dto/product-event-summary-query.dto';

describe('AdminController product event summary', () => {
  const productEvents = { summary: vi.fn().mockResolvedValue({ days: 30 }) };
  const controller = new AdminController({} as never, productEvents as never);

  it('is admin-only, like every route on this controller', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual(['admin']);
  });

  it('defaults to the last 30 days', async () => {
    await controller.productEventSummary({});

    expect(productEvents.summary).toHaveBeenCalledWith(30);
  });

  it('passes a requested window through', async () => {
    await controller.productEventSummary({ days: 7 });

    expect(productEvents.summary).toHaveBeenLastCalledWith(7);
  });

  describe('day range', () => {
    // As the global ValidationPipe sees it: a query string, converted, then validated.
    const errorsFor = async (days: unknown) =>
      validate(plainToInstance(ProductEventSummaryQueryDto, { days }));

    it('accepts one day through a year', async () => {
      expect(await errorsFor('1')).toHaveLength(0);
      expect(await errorsFor('365')).toHaveLength(0);
    });

    it('rejects zero, more than a year, fractions and non-numbers', async () => {
      for (const days of ['0', '366', '2.5', 'abc', '-3']) {
        expect(await errorsFor(days)).not.toHaveLength(0);
      }
    });
  });
});
