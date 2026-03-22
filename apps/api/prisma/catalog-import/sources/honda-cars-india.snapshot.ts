import type { CatalogImportSource } from '../types';

export const hondaCarsIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'honda-cars-india',
  sourceUrl: 'https://www.hondacarindia.com/',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'car',
      name: 'Honda',
      sourceUrl: 'https://www.hondacarindia.com/models',
      models: [
        {
          name: 'Amaze',
          sourceUrl: 'https://www.hondacarindia.com/Models/Amaze',
          generations: [
            {
              name: 'Amaze (2024 refresh)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                { name: 'V', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
                { name: 'VX', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
                { name: 'ZX', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'City',
          sourceUrl: 'https://www.hondacarindia.com/Models/City',
          generations: [
            {
              name: 'City (5th gen facelift)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                { name: 'SV', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'V', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'VX', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'ZX', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
              ],
            },
            {
              name: 'City (4th gen continuation)',
              yearStart: 2020,
              yearEnd: 2023,
              isCurrent: false,
              variants: [
                { name: '4th Gen V', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2023 }] },
                { name: '4th Gen VX', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2023 }] },
              ],
            },
          ],
        },
      ],
    },
    {
      marketCode: 'IN',
      vehicleType: 'suv',
      name: 'Honda',
      sourceUrl: 'https://www.hondacarindia.com/models',
      models: [
        {
          name: 'Elevate',
          sourceUrl: 'https://www.hondacarindia.com/Models/Elevate',
          generations: [
            {
              name: 'Elevate (2023 launch)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                { name: 'SV', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'V', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'VX', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'ZX', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};
