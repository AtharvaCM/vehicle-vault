import type { CatalogImportSource } from '../types';

export const jawaYezdiIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'jawa-yezdi-india',
  sourceUrl: 'https://www.jawamotorcycles.com/',
  capturedAt: '2026-07-02',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'Jawa',
      sourceUrl: 'https://www.jawamotorcycles.com/',
      models: [
        {
          name: 'Jawa 350',
          generations: [
            {
              name: 'Jawa 350 (2024 update)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: '42',
          generations: [
            {
              name: '42 (2024 update)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: 'FJ',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: '42 Bobber',
          generations: [
            {
              name: '42 Bobber (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Perak',
          generations: [
            {
              name: 'Perak (BS6)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'Yezdi',
      sourceUrl: 'https://www.yezdi.com/',
      models: [
        {
          name: 'Roadster',
          generations: [
            {
              name: 'Roadster (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Scrambler',
          generations: [
            {
              name: 'Scrambler (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Adventure',
          generations: [
            {
              name: 'Adventure (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
