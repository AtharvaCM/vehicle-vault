import type { CatalogImportSource } from '../types';

export const atherIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'ather-india',
  sourceUrl: 'https://www.atherenergy.com/',
  capturedAt: '2026-07-01',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'Ather',
      sourceUrl: 'https://www.atherenergy.com/',
      models: [
        {
          name: '450S',
          sourceUrl: 'https://www.atherenergy.com/450S',
          generations: [
            {
              name: '450S (2023 launch)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: '450X',
          sourceUrl: 'https://www.atherenergy.com/450X',
          generations: [
            {
              name: '450X (Gen 3)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: '2.9 kWh',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: '3.7 kWh',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: '450 Apex',
          generations: [
            {
              name: '450 Apex (2024 launch)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2024, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Rizta',
          sourceUrl: 'https://www.atherenergy.com/rizta',
          generations: [
            {
              name: 'Rizta (2024 launch)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                {
                  name: 'S',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: 'Z 2.9 kWh',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: 'Z 3.7 kWh',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2024, isCurrent: true }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
