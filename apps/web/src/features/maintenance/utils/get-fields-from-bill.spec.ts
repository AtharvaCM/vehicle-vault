import { MaintenanceCategory } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import type { Attachment, AttachmentExtraction } from '@/features/attachments/types/attachment';

import {
  getBillValues,
  getFieldsFromBill,
  hasBillValues,
  pickBillExtraction,
} from './get-fields-from-bill';

function read(fields: Partial<AttachmentExtraction> = {}): AttachmentExtraction {
  return {
    id: 'extraction-1',
    attachmentId: 'attachment-1',
    status: 'completed',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    ...fields,
  } as AttachmentExtraction;
}

describe('getBillValues', () => {
  it('falls back the way applying does: document date, vendor, the items total and category', () => {
    expect(
      getBillValues(
        read({
          documentDate: '2026-09-18T00:00:00.000Z',
          vendorName: 'Torque Garage',
          lineItems: [
            { kind: 'labor', name: 'Labour', lineTotal: 400 },
            {
              kind: 'fluid',
              name: 'Engine oil',
              normalizedCategory: MaintenanceCategory.EngineOil,
              lineTotal: 1_100,
            },
          ],
        } as Partial<AttachmentExtraction>),
      ),
    ).toEqual({
      serviceDate: '2026-09-18',
      workshopName: 'Torque Garage',
      totalCost: 1_500,
      category: MaintenanceCategory.EngineOil,
    });
  });

  it('prefers what the bill names outright', () => {
    expect(
      getBillValues(
        read({
          serviceDate: '2026-09-19T00:00:00.000Z',
          documentDate: '2026-09-18T00:00:00.000Z',
          workshopName: 'Workshop',
          vendorName: 'Vendor',
          totalCost: 1_520,
          odometer: 32_150,
        }),
      ),
    ).toEqual({
      serviceDate: '2026-09-19',
      workshopName: 'Workshop',
      totalCost: 1_520,
      odometer: 32_150,
    });
  });
});

describe('hasBillValues', () => {
  it('tells an empty read from one with something in it', () => {
    expect(hasBillValues(read())).toBe(false);
    expect(hasBillValues(read({ odometer: 32_150 }))).toBe(true);
  });
});

describe('getFieldsFromBill', () => {
  it('marks only the fields whose value is still what the bill says', () => {
    const fields = getFieldsFromBill(
      read({ odometer: 32_150, totalCost: 1_520, workshopName: 'Torque Garage' }),
      { odometer: 32_150, totalCost: 1_600, workshopName: 'Torque Garage', notes: '' },
    );

    expect([...fields].sort()).toEqual(['odometer', 'workshopName']);
  });
});

describe('pickBillExtraction', () => {
  const attachment = (id: string, extraction?: Partial<AttachmentExtraction>) =>
    ({ id, extraction: extraction ? read(extraction) : undefined }) as Attachment;

  it('takes the latest completed read and ignores failed or missing ones', () => {
    const picked = pickBillExtraction([
      attachment('a', { id: 'old', updatedAt: '2026-09-20T10:00:00.000Z' }),
      attachment('b', {
        id: 'failed',
        status: 'failed',
        updatedAt: '2026-09-21T10:00:00.000Z',
      } as Partial<AttachmentExtraction>),
      attachment('c', { id: 'new', updatedAt: '2026-09-20T11:00:00.000Z' }),
      attachment('d'),
    ]);

    expect(picked?.id).toBe('new');
    expect(pickBillExtraction([attachment('d')])).toBeUndefined();
  });
});
