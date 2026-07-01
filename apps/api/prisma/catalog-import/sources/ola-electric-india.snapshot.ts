import type { CatalogImportSource } from '../types';

export const olaElectricIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'ola-electric-india',
  sourceUrl: 'https://www.olaelectric.com/',
  capturedAt: '2026-07-01',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'Ola Electric',
      sourceUrl: 'https://www.olaelectric.com/',
      models: [
        {
          name: 'S1 X',
          generations: [
            {
              name: 'S1 X (Gen 2)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                {
                  name: '2 kWh',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: '3 kWh',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: '4 kWh',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2024, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'S1 Air',
          generations: [
            {
              name: 'S1 Air (Gen 2)',
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
          name: 'S1 Pro',
          generations: [
            {
              name: 'S1 Pro (Gen 2)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Plus',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2025, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Roadster X',
          generations: [
            {
              name: 'Roadster X (2025 launch)',
              yearStart: 2025,
              isCurrent: true,
              variants: [
                {
                  name: '2.5 kWh',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2025, isCurrent: true }],
                },
                {
                  name: '3.5 kWh',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2025, isCurrent: true }],
                },
                {
                  name: '4.5 kWh',
                  offerings: [{ fuelTypes: ['electric'], yearStart: 2025, isCurrent: true }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
