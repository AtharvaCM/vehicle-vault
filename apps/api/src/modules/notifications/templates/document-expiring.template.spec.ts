import type { VehicleDocument } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { DocumentExpiringTemplate, daysBucket } from './document-expiring.template';

const baseInsurance: VehicleDocument = {
  id: 'pol-1',
  vehicleId: 'veh-1',
  kind: 'insurance',
  provider: 'Acme Insurance',
  number: 'POL-001',
  startDate: new Date('2025-06-01T00:00:00.000Z'),
  endDate: new Date('2026-05-23T00:00:00.000Z'),
  notes: null,
  details: { premiumAmount: 12500, insuredValue: 500000 },
  createdAt: new Date('2025-06-01T00:00:00.000Z'),
  updatedAt: new Date('2025-06-01T00:00:00.000Z'),
};

const baseWarranty: VehicleDocument = {
  id: 'wty-1',
  vehicleId: 'veh-1',
  kind: 'warranty',
  provider: 'OEM Manufacturer',
  number: 'WTY-99',
  startDate: new Date('2024-01-01T00:00:00.000Z'),
  endDate: new Date('2026-06-15T00:00:00.000Z'),
  notes: null,
  details: { type: 'manufacturer', endOdometer: 100000 },
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

describe('DocumentExpiringTemplate', () => {
  const template = new DocumentExpiringTemplate();

  describe('daysBucket', () => {
    it('collapses [0, 7] days into the urgent "7d" window', () => {
      expect(daysBucket(0)).toBe('7d');
      expect(daysBucket(1)).toBe('7d');
      expect(daysBucket(7)).toBe('7d');
    });

    it('collapses [8, 30] days into the heads-up "30d" window', () => {
      expect(daysBucket(8)).toBe('30d');
      expect(daysBucket(30)).toBe('30d');
    });

    it('returns "future" beyond 30 days', () => {
      expect(daysBucket(31)).toBe('future');
      expect(daysBucket(60)).toBe('future');
    });
  });

  describe('dedupKey', () => {
    it('locks identity to (document.id, daysBucket) so same-window duplicates collapse', () => {
      const a = template.dedupKey({ document: baseInsurance, daysUntilExpiry: 3 });
      const b = template.dedupKey({ document: baseInsurance, daysUntilExpiry: 7 });
      expect(a).toBe(b);
      expect(a).toBe('document-expiring:pol-1:7d');
    });

    it('produces a fresh key when crossing the 7d → 30d boundary', () => {
      const inUrgent = template.dedupKey({ document: baseInsurance, daysUntilExpiry: 7 });
      const inHeadsUp = template.dedupKey({ document: baseInsurance, daysUntilExpiry: 8 });
      expect(inUrgent).not.toBe(inHeadsUp);
    });

    it('differs across documents even with matching day buckets', () => {
      expect(
        template.dedupKey({ document: baseInsurance, daysUntilExpiry: 5 }),
      ).not.toBe(template.dedupKey({ document: baseWarranty, daysUntilExpiry: 5 }));
    });
  });

  describe('render', () => {
    it('uses an insurance-flavoured title and includes the document number', () => {
      const rendered = template.render({ document: baseInsurance, daysUntilExpiry: 7 });

      expect(rendered.title).toBe('Insurance Expiring Soon: Acme Insurance');
      expect(rendered.message).toContain('Your insurance with Acme Insurance (POL-001)');
      expect(rendered.message).toContain('expiring in 7 days');
      expect(rendered.type).toBe('warning');
      expect(rendered.link).toBe('/vehicles/veh-1?tab=protection');
    });

    it('uses a warranty-flavoured title', () => {
      const rendered = template.render({ document: baseWarranty, daysUntilExpiry: 14 });
      expect(rendered.title).toBe('Warranty Expiring Soon: OEM Manufacturer');
      expect(rendered.message).toContain('Your warranty with OEM Manufacturer (WTY-99)');
    });

    it('drops the parenthetical identifier when the document has no number', () => {
      const rendered = template.render({
        document: { ...baseWarranty, number: null },
        daysUntilExpiry: 3,
      });
      expect(rendered.message).not.toContain('(');
    });

    it('pluralizes "day" correctly at 1 day', () => {
      const rendered = template.render({ document: baseInsurance, daysUntilExpiry: 1 });
      expect(rendered.message).toContain('expiring in 1 day on');
    });
  });
});
