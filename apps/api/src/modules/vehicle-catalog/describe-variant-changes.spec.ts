import { describe, expect, it } from 'vitest';

import { describeVariantChanges } from './describe-variant-changes';

describe('describeVariantChanges', () => {
  it('lists each changed field with its old and new value', () => {
    expect(
      describeVariantChanges(
        [{ fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2023 }],
        [
          { fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2023 },
          { fuelTypes: ['cng', 'petrol'], yearStart: 2024, isCurrent: true },
        ],
      ),
    ).toEqual([
      { field: 'Fuel types', before: 'Petrol', after: 'Cng / Petrol' },
      { field: 'Years', before: '2020 to 2023', after: '2020 to current' },
      { field: 'Offerings', before: '1', after: '2' },
    ]);
  });

  it('leaves out the fields that did not change', () => {
    expect(
      describeVariantChanges(
        [{ fuelTypes: ['diesel'], yearStart: 2019, yearEnd: 2022 }],
        [{ fuelTypes: ['diesel'], yearStart: 2018, yearEnd: 2022 }],
      ),
    ).toEqual([{ field: 'Years', before: '2019 to 2022', after: '2018 to 2022' }]);
  });

  it('lists the offerings when only how they are split changed', () => {
    expect(
      describeVariantChanges(
        [
          { fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2021 },
          { fuelTypes: ['petrol'], yearStart: 2022, yearEnd: 2023 },
        ],
        [
          { fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2022 },
          { fuelTypes: ['petrol'], yearStart: 2023, yearEnd: 2023 },
        ],
      ),
    ).toEqual([
      {
        field: 'Offerings',
        before: 'Petrol, 2020 to 2021; Petrol, 2022 to 2023',
        after: 'Petrol, 2020 to 2022; Petrol, 2023 to 2023',
      },
    ]);
  });
});
