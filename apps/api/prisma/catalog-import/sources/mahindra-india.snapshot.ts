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
        {
          name: 'Scorpio Classic',
          sourceUrl: 'https://auto.mahindra.com/suv/scorpio-classic',
          generations: [
            {
              name: 'Scorpio Classic (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                { name: 'S', offerings: [{ fuelTypes: ['diesel'], yearStart: 2022, isCurrent: true }] },
                { name: 'S11', offerings: [{ fuelTypes: ['diesel'], yearStart: 2022, isCurrent: true }] },
              ],
            },
            {
              name: 'Scorpio (2014 facelift)',
              yearStart: 2014,
              yearEnd: 2022,
              isCurrent: false,
              variants: [
                { name: 'S2', offerings: [{ fuelTypes: ['diesel'], yearStart: 2014, yearEnd: 2022 }] },
                { name: 'S4', offerings: [{ fuelTypes: ['diesel'], yearStart: 2014, yearEnd: 2022 }] },
                { name: 'S10', offerings: [{ fuelTypes: ['diesel'], yearStart: 2014, yearEnd: 2022 }] },
              ],
            },
          ],
        },
        {
          name: 'Thar',
          sourceUrl: 'https://auto.mahindra.com/suv/thar',
          generations: [
            {
              name: 'Thar (2020 launch)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                { name: 'AX Opt', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2020, isCurrent: true }] },
                { name: 'LX', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2020, isCurrent: true }] },
              ],
            },
            {
              name: 'Thar (2010 launch)',
              yearStart: 2010,
              yearEnd: 2020,
              isCurrent: false,
              variants: [
                { name: 'DI', offerings: [{ fuelTypes: ['diesel'], yearStart: 2010, yearEnd: 2020 }] },
                { name: 'CRDe', offerings: [{ fuelTypes: ['diesel'], yearStart: 2010, yearEnd: 2020 }] },
              ],
            },
          ],
        },
        {
          name: 'Bolero',
          sourceUrl: 'https://auto.mahindra.com/suv/bolero',
          generations: [
            {
              name: 'Bolero (2011 BS4)',
              yearStart: 2011,
              isCurrent: true,
              variants: [
                { name: 'B4', offerings: [{ fuelTypes: ['diesel'], yearStart: 2011, isCurrent: true }] },
                { name: 'B6', offerings: [{ fuelTypes: ['diesel'], yearStart: 2011, isCurrent: true }] },
                { name: 'B6 Opt', offerings: [{ fuelTypes: ['diesel'], yearStart: 2011, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'XUV300',
          sourceUrl: 'https://auto.mahindra.com/suv/xuv300',
          generations: [
            {
              name: 'XUV300 (2019 launch)',
              yearStart: 2019,
              yearEnd: 2024,
              isCurrent: false,
              variants: [
                { name: 'W4', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2019, yearEnd: 2024 }] },
                { name: 'W6', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2019, yearEnd: 2024 }] },
                { name: 'W8', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2019, yearEnd: 2024 }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};
