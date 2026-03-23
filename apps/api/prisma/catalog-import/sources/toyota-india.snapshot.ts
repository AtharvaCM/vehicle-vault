import type { CatalogImportSource } from '../types';

export const toyotaIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'toyota-india',
  sourceUrl: 'https://www.toyotabharat.com/',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'car',
      name: 'Toyota',
      sourceUrl: 'https://www.toyotabharat.com/showroom/',
      models: [
        {
          name: 'Glanza',
          sourceUrl: 'https://www.toyotabharat.com/showroom/glanza/',
          generations: [
            {
              name: 'Glanza (2022 update)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                { name: 'E', offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true }] },
                { name: 'S', offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true }] },
                { name: 'G', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
                { name: 'V', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Camry',
          generations: [
            {
              name: 'Camry (2019 launch)',
              yearStart: 2019,
              isCurrent: true,
              variants: [
                { name: 'Hybrid', offerings: [{ fuelTypes: ['hybrid'], yearStart: 2019, isCurrent: true }] },
              ],
            },
          ],
        },
      ],
    },
    {
      marketCode: 'IN',
      vehicleType: 'suv',
      name: 'Toyota',
      sourceUrl: 'https://www.toyotabharat.com/showroom/',
      models: [
        {
          name: 'Urban Cruiser Hyryder',
          sourceUrl: 'https://www.toyotabharat.com/showroom/urbancruiserhyryder/',
          generations: [
            {
              name: 'Urban Cruiser Hyryder (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                { name: 'E', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
                { name: 'S', offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true }] },
                { name: 'G', offerings: [{ fuelTypes: ['petrol', 'hybrid'], yearStart: 2022, isCurrent: true }] },
                { name: 'V', offerings: [{ fuelTypes: ['petrol', 'hybrid'], yearStart: 2022, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Fortuner',
          sourceUrl: 'https://www.toyotabharat.com/showroom/fortuner/',
          generations: [
            {
              name: 'Fortuner (2021 facelift)',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                { name: '4x2', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2021, isCurrent: true }] },
                { name: '4x4', offerings: [{ fuelTypes: ['diesel'], yearStart: 2021, isCurrent: true }] },
                { name: 'Legender', offerings: [{ fuelTypes: ['diesel'], yearStart: 2021, isCurrent: true }] },
              ],
            },
            {
              name: 'Fortuner (2016 launch)',
              yearStart: 2016,
              yearEnd: 2020,
              isCurrent: false,
              variants: [
                { name: '4x2 AT', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2016, yearEnd: 2020 }] },
                { name: '4x2 MT', offerings: [{ fuelTypes: ['diesel'], yearStart: 2016, yearEnd: 2020 }] },
                { name: '4x4 AT', offerings: [{ fuelTypes: ['diesel'], yearStart: 2016, yearEnd: 2020 }] },
              ],
            },
          ],
        },
        {
          name: 'Innova Crysta',
          sourceUrl: 'https://www.toyotabharat.com/showroom/innova-crysta/',
          generations: [
            {
              name: 'Innova Crysta (2023 relaunch)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                { name: 'GX', offerings: [{ fuelTypes: ['diesel'], yearStart: 2023, isCurrent: true }] },
                { name: 'VX', offerings: [{ fuelTypes: ['diesel'], yearStart: 2023, isCurrent: true }] },
                { name: 'ZX', offerings: [{ fuelTypes: ['diesel'], yearStart: 2023, isCurrent: true }] },
              ],
            },
            {
              name: 'Innova Crysta (2016 launch)',
              yearStart: 2016,
              yearEnd: 2022,
              isCurrent: false,
              variants: [
                { name: '2.4 G', offerings: [{ fuelTypes: ['diesel'], yearStart: 2016, yearEnd: 2022 }] },
                { name: '2.4 VX', offerings: [{ fuelTypes: ['diesel'], yearStart: 2016, yearEnd: 2022 }] },
                { name: '2.4 ZX', offerings: [{ fuelTypes: ['diesel'], yearStart: 2016, yearEnd: 2022 }] },
              ],
            },
          ],
        },
        {
          name: 'Innova Hycross',
          sourceUrl: 'https://www.toyotabharat.com/showroom/innova-hycross/',
          generations: [
            {
              name: 'Innova Hycross (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                { name: 'GX', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
                { name: 'VX', offerings: [{ fuelTypes: ['petrol', 'hybrid'], yearStart: 2022, isCurrent: true }] },
                { name: 'ZX', offerings: [{ fuelTypes: ['hybrid'], yearStart: 2022, isCurrent: true }] },
                { name: 'ZX (O)', offerings: [{ fuelTypes: ['hybrid'], yearStart: 2022, isCurrent: true }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};
