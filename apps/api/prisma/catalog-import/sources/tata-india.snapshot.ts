import type { CatalogImportSource } from '../types';

export const tataIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'tata-india',
  sourceUrl: 'https://cars.tatamotors.com/',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'car',
      name: 'Tata',
      sourceUrl: 'https://cars.tatamotors.com/cars',
      models: [
        {
          name: 'Altroz',
          sourceUrl: 'https://cars.tatamotors.com/cars/altroz',
          generations: [
            {
              name: 'Altroz (2023 lineup)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'XE',
                  offerings: [{ fuelTypes: ['petrol', 'diesel', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'XM',
                  offerings: [{ fuelTypes: ['petrol', 'diesel', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'XT',
                  offerings: [{ fuelTypes: ['petrol', 'diesel', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'XZ',
                  offerings: [{ fuelTypes: ['petrol', 'diesel', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'XZ Plus',
                  offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Tiago',
          sourceUrl: 'https://cars.tatamotors.com/cars/tiago',
          generations: [
            {
              name: 'Tiago (2023 lineup)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'XE',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'XM',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'XT',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'XZ',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'XZ Plus',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      marketCode: 'IN',
      vehicleType: 'suv',
      name: 'Tata',
      sourceUrl: 'https://cars.tatamotors.com/suv',
      models: [
        {
          name: 'Punch',
          sourceUrl: 'https://cars.tatamotors.com/suv/punch',
          generations: [
            {
              name: 'Punch (2023 lineup)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'Pure',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Adventure',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Accomplished',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Creative',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Nexon',
          sourceUrl: 'https://cars.tatamotors.com/suv/nexon',
          generations: [
            {
              name: 'Nexon (2023 refresh)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'Smart',
                  offerings: [{ fuelTypes: ['petrol', 'diesel', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Pure',
                  offerings: [{ fuelTypes: ['petrol', 'diesel', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Creative',
                  offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Fearless',
                  offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
