import { MaintenanceCategory } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import {
  normalizeMaintenanceCreateSearch,
  normalizeMaintenanceEditSearch,
} from './maintenance-create-search';

const reminderId = '6f1c2b8e-3d4a-4b5c-9d6e-7f8091a2b3c4';

describe('normalizeMaintenanceCreateSearch', () => {
  it('keeps a known category and a reminder id', () => {
    expect(normalizeMaintenanceCreateSearch({ category: 'engine_oil', reminderId })).toEqual({
      category: MaintenanceCategory.EngineOil,
      reminderId,
    });
  });

  it('drops what is not one, and anything else', () => {
    expect(
      normalizeMaintenanceCreateSearch({
        category: 'Oil change',
        reminderId: 'not-an-id',
        tab: 'history',
      }),
    ).toEqual({});
    expect(normalizeMaintenanceCreateSearch({ category: 42 })).toEqual({});
  });
});

describe('normalizeMaintenanceEditSearch', () => {
  it('keeps a reminder id and nothing else', () => {
    expect(normalizeMaintenanceEditSearch({ reminderId, category: 'engine_oil' })).toEqual({
      reminderId,
    });
  });

  it('drops a malformed one', () => {
    expect(normalizeMaintenanceEditSearch({ reminderId: 'not-an-id' })).toEqual({});
  });
});
