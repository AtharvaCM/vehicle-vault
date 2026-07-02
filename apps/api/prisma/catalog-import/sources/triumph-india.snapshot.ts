import type { CatalogImportSource } from '../types';

export const triumphIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'triumph-india',
  sourceUrl: 'https://www.triumphmotorcycles.in/',
  capturedAt: '2026-07-02',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'Triumph',
      sourceUrl: 'https://www.triumphmotorcycles.in/',
      models: [
        {
          name: 'Speed 400',
          generations: [
            {
              name: 'Speed 400 (2023 launch)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Speed T4',
          generations: [
            {
              name: 'Speed T4 (2024 launch)',
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
          name: 'Scrambler 400 X',
          generations: [
            {
              name: 'Scrambler 400 X (2023 launch)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Scrambler 400 XC',
          generations: [
            {
              name: 'Scrambler 400 XC (2025 launch)',
              yearStart: 2025,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2025, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Thruxton 400',
          generations: [
            {
              name: 'Thruxton 400 (2025 launch)',
              yearStart: 2025,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2025, isCurrent: true }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
