import type { CatalogImportSource } from '../types';

export const skodaIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'skoda-india',
  sourceUrl: 'https://www.skoda-auto.co.in/',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'car',
      name: 'Skoda',
      sourceUrl: 'https://www.skoda-auto.co.in/models',
      models: [
        {
          name: 'Slavia',
          sourceUrl: 'https://www.skoda-auto.co.in/models/slavia/slavia',
          generations: [
            {
              name: 'Slavia (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                { name: 'Classic', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
                { name: 'Signature', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
                { name: 'Prestige', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Rapid',
          sourceUrl: 'https://www.skoda-auto.co.in/models/rapid/rapid',
          generations: [
            {
              name: 'Rapid (2016 facelift)',
              yearStart: 2016,
              yearEnd: 2021,
              isCurrent: false,
              variants: [
                { name: 'Rider', offerings: [{ fuelTypes: ['petrol'], yearStart: 2019, yearEnd: 2021 }] },
                { name: 'Ambition', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2016, yearEnd: 2021 }] },
                { name: 'Style', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2016, yearEnd: 2021 }] },
                { name: 'Monte Carlo', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2017, yearEnd: 2021 }] },
              ],
            },
          ],
        },
        {
          name: 'Octavia',
          sourceUrl: 'https://www.skoda-auto.co.in/models/octavia/octavia',
          generations: [
            {
              name: 'Octavia (2021 relaunch)',
              yearStart: 2021,
              yearEnd: 2023,
              isCurrent: false,
              variants: [
                { name: 'Style', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, yearEnd: 2023 }] },
                { name: 'RS 245', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, yearEnd: 2023 }] },
              ],
            },
          ],
        },
      ],
    },
    {
      marketCode: 'IN',
      vehicleType: 'suv',
      name: 'Skoda',
      sourceUrl: 'https://www.skoda-auto.co.in/models',
      models: [
        {
          name: 'Kushaq',
          sourceUrl: 'https://www.skoda-auto.co.in/models/kushaq/kushaq',
          generations: [
            {
              name: 'Kushaq (2021 launch)',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                { name: 'Classic', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
                { name: 'Signature', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
                { name: 'Prestige', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};
