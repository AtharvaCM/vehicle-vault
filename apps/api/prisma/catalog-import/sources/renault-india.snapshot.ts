import type { CatalogImportSource } from '../types';

export const renaultIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'renault-india',
  sourceUrl: 'https://www.renault.co.in/',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'car',
      name: 'Renault',
      sourceUrl: 'https://www.renault.co.in/cars.html',
      models: [
        {
          name: 'Kwid',
          sourceUrl: 'https://www.renault.co.in/cars/kwid.html',
          generations: [
            {
              name: 'Kwid (2024 lineup)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                { name: 'RXE', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
                { name: 'RXL', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
                { name: 'RXT', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
                { name: 'Climber', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
              ],
            },
            {
              name: 'Kwid (2015 launch)',
              yearStart: 2015,
              yearEnd: 2023,
              isCurrent: false,
              variants: [
                { name: 'RXL', offerings: [{ fuelTypes: ['petrol'], yearStart: 2015, yearEnd: 2023 }] },
                { name: 'RXT', offerings: [{ fuelTypes: ['petrol'], yearStart: 2015, yearEnd: 2023 }] },
                { name: 'Climber', offerings: [{ fuelTypes: ['petrol'], yearStart: 2016, yearEnd: 2023 }] },
              ],
            },
          ],
        },
        {
          name: 'Triber',
          sourceUrl: 'https://www.renault.co.in/cars/triber.html',
          generations: [
            {
              name: 'Triber (2023 lineup)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                { name: 'RXE', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'RXL', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'RXT', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'RXZ', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
              ],
            },
          ],
        },
      ],
    },
    {
      marketCode: 'IN',
      vehicleType: 'suv',
      name: 'Renault',
      sourceUrl: 'https://www.renault.co.in/cars.html',
      models: [
        {
          name: 'Kiger',
          sourceUrl: 'https://www.renault.co.in/cars/kiger.html',
          generations: [
            {
              name: 'Kiger (2024 lineup)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                { name: 'RXE', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
                { name: 'RXL', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
                { name: 'RXT', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
                { name: 'RXZ', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Duster',
          sourceUrl: 'https://www.renault.co.in/cars/duster.html',
          generations: [
            {
              name: 'Duster (2016 facelift)',
              yearStart: 2016,
              yearEnd: 2022,
              isCurrent: false,
              variants: [
                { name: 'RXL', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2016, yearEnd: 2022 }] },
                { name: 'RXS', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2016, yearEnd: 2022 }] },
                { name: 'RXZ', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2016, yearEnd: 2022 }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};
