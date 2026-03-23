import type { CatalogImportSource } from '../types';

export const heroIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'hero-india',
  sourceUrl: 'https://www.heromotocorp.com/',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'Hero',
      sourceUrl: 'https://www.heromotocorp.com/en-in/motorcycles/',
      models: [
        {
          name: 'Splendor Plus',
          sourceUrl: 'https://www.heromotocorp.com/en-in/motorcycles/practical/splendor-plus.html',
          generations: [
            {
              name: 'Splendor Plus (i3S lineup)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                { name: 'Drum', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }] },
                { name: 'i3S', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }] },
                { name: 'XTEC', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'HF Deluxe',
          generations: [
            {
              name: 'HF Deluxe (BS6)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                { name: 'Kick Start', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }] },
                { name: 'Self Start', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Passion Pro',
          generations: [
            {
              name: 'Passion Pro (BS6)',
              yearStart: 2020,
              yearEnd: 2023,
              isCurrent: false,
              variants: [
                { name: 'Drum', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2023 }] },
                { name: 'Disc', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2023 }] },
              ],
            },
          ],
        },
        {
          name: 'Glamour',
          generations: [
            {
              name: 'Glamour (BS6)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                { name: 'Drum', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }] },
                { name: 'Disc', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }] },
                { name: 'XTEC', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Xpulse 200 4V',
          sourceUrl: 'https://www.heromotocorp.com/en-in/motorcycles/performance/xpulse-200-4v.html',
          generations: [
            {
              name: 'Xpulse 200 4V (2021 launch)',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                { name: 'Standard', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
                { name: 'Pro', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Karizma XMR',
          sourceUrl: 'https://www.heromotocorp.com/en-in/motorcycles/performance/karizma-xmr.html',
          generations: [
            {
              name: 'Karizma XMR (2023 relaunch)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                { name: 'Standard', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'Combat Edition', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Xtreme 160R 4V',
          sourceUrl: 'https://www.heromotocorp.com/en-in/motorcycles/performance/xtreme-160r-4v.html',
          generations: [
            {
              name: 'Xtreme 160R 4V (2023 launch)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                { name: 'Double Disc', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'Connected', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};
