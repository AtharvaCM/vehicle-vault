import type { CatalogImportSource } from '../types';

export const kiaIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'kia-india',
  sourceUrl: 'https://www.kia.com/in/home.html',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'car',
      name: 'Kia',
      sourceUrl: 'https://www.kia.com/in/our-vehicles.html',
      models: [
        {
          name: 'Carens',
          sourceUrl: 'https://www.kia.com/in/our-vehicles/carens/showroom.html',
          generations: [
            {
              name: 'Carens (2025 lineup)',
              yearStart: 2025,
              isCurrent: true,
              variants: [
                { name: 'Premium', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2025, isCurrent: true }] },
                { name: 'Prestige', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2025, isCurrent: true }] },
                { name: 'Prestige Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2025, isCurrent: true }] },
                { name: 'Luxury Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2025, isCurrent: true }] },
                { name: 'X-Line', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2025, isCurrent: true }] },
              ],
            },
            {
              name: 'Carens (2022 launch)',
              yearStart: 2022,
              yearEnd: 2024,
              isCurrent: false,
              variants: [
                { name: 'Premium', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2022, yearEnd: 2024 }] },
                { name: 'Prestige', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2022, yearEnd: 2024 }] },
                { name: 'Luxury', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2022, yearEnd: 2024 }] },
              ],
            },
          ],
        },
      ],
    },
    {
      marketCode: 'IN',
      vehicleType: 'suv',
      name: 'Kia',
      sourceUrl: 'https://www.kia.com/in/our-vehicles.html',
      models: [
        {
          name: 'Seltos',
          sourceUrl: 'https://www.kia.com/in/our-vehicles/seltos/showroom.html',
          generations: [
            {
              name: 'Seltos (2023 facelift)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                { name: 'HTE', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true }] },
                { name: 'HTK', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true }] },
                { name: 'HTK Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true }] },
                { name: 'HTX', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true }] },
                { name: 'HTX Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true }] },
                { name: 'X-Line', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true }] },
              ],
            },
            {
              name: 'Seltos (2019 launch)',
              yearStart: 2019,
              yearEnd: 2022,
              isCurrent: false,
              variants: [
                { name: 'HTE', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2019, yearEnd: 2022 }] },
                { name: 'HTK Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2019, yearEnd: 2022 }] },
                { name: 'HTX Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2019, yearEnd: 2022 }] },
                { name: 'GTX Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2019, yearEnd: 2022 }] },
              ],
            },
          ],
        },
        {
          name: 'Sonet',
          sourceUrl: 'https://www.kia.com/in/our-vehicles/sonet/showroom.html',
          generations: [
            {
              name: 'Sonet (2024 facelift)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                { name: 'HTE', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true }] },
                { name: 'HTK', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true }] },
                { name: 'HTK Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true }] },
                { name: 'HTX', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true }] },
                { name: 'GTX Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true }] },
                { name: 'X-Line', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true }] },
              ],
            },
            {
              name: 'Sonet (2020 launch)',
              yearStart: 2020,
              yearEnd: 2023,
              isCurrent: false,
              variants: [
                { name: 'HTK Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2020, yearEnd: 2023 }] },
                { name: 'HTX', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2020, yearEnd: 2023 }] },
                { name: 'GTX Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2020, yearEnd: 2023 }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};
