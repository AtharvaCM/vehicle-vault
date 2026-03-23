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
            {
              name: 'City (Type 2)',
              yearStart: 1999,
              yearEnd: 2003,
              isCurrent: false,
              variants: [
                { name: '1.3 LXI', offerings: [{ fuelTypes: ['petrol'], yearStart: 1999, yearEnd: 2003 }] },
                { name: '1.5 EXI', offerings: [{ fuelTypes: ['petrol'], yearStart: 1999, yearEnd: 2003 }] },
              ],
            },
            {
              name: 'City (Dolphin)',
              yearStart: 2003,
              yearEnd: 2008,
              isCurrent: false,
              variants: [
                { name: 'GXi', offerings: [{ fuelTypes: ['petrol'], yearStart: 2003, yearEnd: 2008 }] },
                { name: 'ZX', offerings: [{ fuelTypes: ['petrol'], yearStart: 2005, yearEnd: 2008 }] },
              ],
            },
          ],
        },
        {
          name: 'Civic',
          generations: [
            {
              name: 'Civic (8th Gen)',
              yearStart: 2006,
              yearEnd: 2013,
              isCurrent: false,
              variants: [
                { name: '1.8 V MT', offerings: [{ fuelTypes: ['petrol'], yearStart: 2006, yearEnd: 2013 }] },
                { name: '1.8 V AT', offerings: [{ fuelTypes: ['petrol'], yearStart: 2006, yearEnd: 2013 }] },
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
