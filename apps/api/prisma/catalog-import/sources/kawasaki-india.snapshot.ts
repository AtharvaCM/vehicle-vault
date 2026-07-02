import type { CatalogImportSource } from '../types';

export const kawasakiIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'kawasaki-india',
  sourceUrl: 'https://www.kawasaki-india.com/',
  capturedAt: '2026-07-02',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'Kawasaki',
      sourceUrl: 'https://www.kawasaki-india.com/',
      models: [
        {
          name: 'Ninja 300',
          generations: [
            {
              name: 'Ninja 300 (BS6)',
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
          name: 'Ninja 500',
          generations: [
            {
              name: 'Ninja 500 (2024 launch)',
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
          name: 'Ninja 650',
          generations: [
            {
              name: 'Ninja 650 (BS6)',
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
          name: 'Z650',
          generations: [
            {
              name: 'Z650 (BS6)',
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
          name: 'Z900',
          generations: [
            {
              name: 'Z900 (BS6)',
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
          name: 'Versys 650',
          generations: [
            {
              name: 'Versys 650 (BS6)',
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
          name: 'Eliminator',
          generations: [
            {
              name: 'Eliminator 500 (2024 launch)',
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
          name: 'KLX230',
          generations: [
            {
              name: 'KLX230 (2025 launch)',
              yearStart: 2025,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2025, isCurrent: true }],
                },
                {
                  name: 'S',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2026, isCurrent: true }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
