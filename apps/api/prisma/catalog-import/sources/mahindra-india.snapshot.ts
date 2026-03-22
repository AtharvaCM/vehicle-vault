import type { CatalogImportSource } from '../types';

export const mahindraIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'mahindra-india',
  sourceUrl: 'https://auto.mahindra.com/suv',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'suv',
      name: 'Mahindra',
      sourceUrl: 'https://auto.mahindra.com/suv',
      models: [
        {
          name: 'XUV 3XO',
          sourceUrl: 'https://auto.mahindra.com/suv/xuv-3xo',
          generations: [
            {
              name: 'XUV 3XO (2024 launch)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                { name: 'MX1', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
                { name: 'MX2', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true }] },
                { name: 'AX5', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true }] },
                { name: 'AX7', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Scorpio N',
          sourceUrl: 'https://auto.mahindra.com/suv/scorpio-n',
          generations: [
            {
              name: 'Scorpio N (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                { name: 'Z2', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2022, isCurrent: true }] },
                { name: 'Z4', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2022, isCurrent: true }] },
                { name: 'Z6', offerings: [{ fuelTypes: ['diesel'], yearStart: 2022, isCurrent: true }] },
                { name: 'Z8', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2022, isCurrent: true }] },
                { name: 'Z8L', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2022, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'XUV700',
          sourceUrl: 'https://auto.mahindra.com/suv/xuv700',
          generations: [
            {
              name: 'XUV700 (2021 launch)',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                { name: 'MX', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2021, isCurrent: true }] },
                { name: 'AX3', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2021, isCurrent: true }] },
                { name: 'AX5', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2021, isCurrent: true }] },
                { name: 'AX7', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2021, isCurrent: true }] },
                { name: 'AX7L', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2021, isCurrent: true }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};
