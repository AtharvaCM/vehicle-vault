import type { CatalogImportSource } from '../types';

export const suzukiIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'suzuki-india',
  sourceUrl: 'https://www.suzukimotorcycle.co.in/',
  capturedAt: '2026-07-01',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'Suzuki',
      sourceUrl: 'https://www.suzukimotorcycle.co.in/',
      models: [
        {
          name: 'Access 125',
          sourceUrl: 'https://www.suzukimotorcycle.co.in/product-details/access-125',
          generations: [
            {
              name: 'Access 125 (BS6)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'Special Edition',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'Ride Connect',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Avenis 125',
          sourceUrl: 'https://www.suzukimotorcycle.co.in/product-details/avenis',
          generations: [
            {
              name: 'Avenis 125 (2021 launch)',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
                {
                  name: 'Race Edition',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Burgman Street',
          sourceUrl: 'https://www.suzukimotorcycle.co.in/product-details/burgman-street',
          generations: [
            {
              name: 'Burgman Street (BS6)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'EX',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Gixxer',
          sourceUrl: 'https://www.suzukimotorcycle.co.in/product-details/gixxer',
          generations: [
            {
              name: 'Gixxer 155 (BS6)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'Ride Connect',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Gixxer SF',
          sourceUrl: 'https://www.suzukimotorcycle.co.in/product-details/gixxer-sf',
          generations: [
            {
              name: 'Gixxer SF 155 (BS6)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'Ride Connect',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Gixxer 250',
          generations: [
            {
              name: 'Gixxer 250 (BS6)',
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
        {
          name: 'V-Strom SX',
          sourceUrl: 'https://www.suzukimotorcycle.co.in/product-details/v-strom-sx',
          generations: [
            {
              name: 'V-Strom SX (2022 launch)',
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
