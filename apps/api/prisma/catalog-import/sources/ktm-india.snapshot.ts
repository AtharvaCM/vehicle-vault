import type { CatalogImportSource } from '../types';

export const ktmIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'ktm-india',
  sourceUrl: 'https://www.ktm.com/en-in.html',
  capturedAt: '2026-07-01',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'KTM',
      sourceUrl: 'https://www.ktm.com/en-in.html',
      models: [
        {
          name: '125 Duke',
          generations: [
            {
              name: '125 Duke (BS6)',
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
          name: '200 Duke',
          generations: [
            {
              name: '200 Duke (BS6)',
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
          name: '250 Duke',
          generations: [
            {
              name: '250 Duke (Gen 3)',
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
          name: '390 Duke',
          generations: [
            {
              name: '390 Duke (Gen 3)',
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
          name: 'RC 200',
          generations: [
            {
              name: 'RC 200 (BS6)',
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
          name: 'RC 390',
          generations: [
            {
              name: 'RC 390 (BS6)',
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
          name: '390 Adventure',
          generations: [
            {
              name: '390 Adventure (2025 lineup)',
              yearStart: 2025,
              isCurrent: true,
              variants: [
                {
                  name: 'X',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2025, isCurrent: true }],
                },
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
