import type { CatalogImportSource } from '../types';

export const bmwMotorradIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'bmw-motorrad-india',
  sourceUrl: 'https://www.bmw-motorrad.in/',
  capturedAt: '2026-07-02',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'BMW Motorrad',
      sourceUrl: 'https://www.bmw-motorrad.in/',
      models: [
        {
          name: 'G 310 R',
          generations: [
            {
              name: 'G 310 R (BS6)',
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
          name: 'G 310 GS',
          generations: [
            {
              name: 'G 310 GS (BS6)',
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
          name: 'G 310 RR',
          generations: [
            {
              name: 'G 310 RR (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'Style Sport',
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
