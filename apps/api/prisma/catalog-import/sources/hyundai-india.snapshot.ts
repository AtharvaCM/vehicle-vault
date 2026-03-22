import type { CatalogDataset } from '../types';

export const hyundaiIndiaSnapshot = {
  marketCode: 'IN',
  sourceKey: 'hyundai-india',
  sourceUrl: 'https://org1.hyundai.com/in/en',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'car',
      name: 'Hyundai',
      sourceUrl: 'https://org1.hyundai.com/in/en',
      models: [
        {
          name: 'Grand i10 Nios',
          generations: [
            {
              name: 'Grand i10 Nios (2023 refresh)',
              yearStart: 2023,
              isCurrent: true,
              sourceUrl: 'https://org1.hyundai.com/in/en',
              variants: [
                {
                  name: 'Era',
                  offerings: [
                    { fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
                  ],
                },
                {
                  name: 'Magna',
                  offerings: [
                    { fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
                  ],
                },
                {
                  name: 'Sportz',
                  offerings: [
                    { fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
                  ],
                },
                {
                  name: 'Asta',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'i20',
          generations: [
            {
              name: 'i20 (2023 lineup)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'Magna',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Sportz',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Asta',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Asta (O)',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
            {
              name: 'i20 (2020 launch)',
              yearStart: 2020,
              yearEnd: 2022,
              isCurrent: false,
              variants: [
                {
                  name: 'Magna',
                  offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2020, yearEnd: 2022 }],
                },
                {
                  name: 'Sportz',
                  offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2020, yearEnd: 2022 }],
                },
                {
                  name: 'Asta',
                  offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2020, yearEnd: 2022 }],
                },
              ],
            },
          ],
        },
        {
          name: 'Verna',
          generations: [
            {
              name: 'Verna (2023 turbo update)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                { name: 'EX', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'S', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'SX', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'SX (O)', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
              ],
            },
          ],
        },
      ],
    },
    {
      marketCode: 'IN',
      vehicleType: 'suv',
      name: 'Hyundai',
      sourceUrl: 'https://org1.hyundai.com/in/en',
      models: [
        {
          name: 'Creta',
          generations: [
            {
              name: 'Creta (2024 facelift)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                {
                  name: 'E',
                  offerings: [
                    { fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
                  ],
                },
                {
                  name: 'EX',
                  offerings: [
                    { fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
                  ],
                },
                {
                  name: 'SX',
                  offerings: [
                    { fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
                  ],
                },
                {
                  name: 'SX (O)',
                  offerings: [
                    { fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
                  ],
                },
              ],
            },
            {
              name: 'Creta (2020 launch)',
              yearStart: 2020,
              yearEnd: 2023,
              isCurrent: false,
              variants: [
                {
                  name: 'SX Executive',
                  offerings: [
                    { fuelTypes: ['petrol', 'diesel'], yearStart: 2020, yearEnd: 2023 },
                  ],
                },
              ],
            },
          ],
        },
        {
          name: 'Venue',
          generations: [
            {
              name: 'Venue (2023 lineup)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'E',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'S',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'SX',
                  offerings: [
                    { fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true },
                  ],
                },
                {
                  name: 'SX (O)',
                  offerings: [
                    { fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true },
                  ],
                },
              ],
            },
            {
              name: 'Venue (2019 launch)',
              yearStart: 2019,
              yearEnd: 2022,
              isCurrent: false,
              variants: [
                {
                  name: 'S',
                  offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2019, yearEnd: 2022 }],
                },
                {
                  name: 'SX',
                  offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2019, yearEnd: 2022 }],
                },
                {
                  name: 'SX Plus',
                  offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2019, yearEnd: 2022 }],
                },
              ],
            },
          ],
        },
      ],
    },
  ] satisfies CatalogDataset,
};
