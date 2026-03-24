import type { CatalogImportSource } from '../types';

export const volkswagenIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'volkswagen-india',
  sourceUrl: 'https://www.volkswagen.co.in/',
  capturedAt: '2026-03-24',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'car',
      name: 'Volkswagen',
      sourceUrl: 'https://www.volkswagen.co.in/en/models.html',
      models: [
        {
          name: 'Virtus',
          sourceUrl: 'https://www.volkswagen.co.in/en/models/virtus.html',
          generations: [
            {
              name: 'Virtus (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                { name: 'Comfortline', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
                { name: 'Highline', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
                { name: 'Topline', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
                { name: 'GT Plus', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
                { name: 'GT Edge', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Polo',
          sourceUrl: 'https://www.volkswagen.co.in/en/models/polo.html',
          generations: [
            {
              name: 'Polo (2014 facelift)',
              yearStart: 2014,
              yearEnd: 2022,
              isCurrent: false,
              variants: [
                { name: 'Trendline', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2014, yearEnd: 2022 }] },
                { name: 'Comfortline', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2014, yearEnd: 2022 }] },
                { name: 'Highline Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2016, yearEnd: 2022 }] },
                { name: 'GT TSI', offerings: [{ fuelTypes: ['petrol'], yearStart: 2014, yearEnd: 2022 }] },
              ],
            },
          ],
        },
        {
          name: 'Vento',
          sourceUrl: 'https://www.volkswagen.co.in/en/models/vento.html',
          generations: [
            {
              name: 'Vento (2015 facelift)',
              yearStart: 2015,
              yearEnd: 2022,
              isCurrent: false,
              variants: [
                { name: 'Trendline', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2015, yearEnd: 2022 }] },
                { name: 'Comfortline', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2015, yearEnd: 2022 }] },
                { name: 'Highline Plus', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2016, yearEnd: 2022 }] },
                { name: 'GT', offerings: [{ fuelTypes: ['petrol'], yearStart: 2015, yearEnd: 2022 }] },
              ],
            },
          ],
        },
        {
          name: 'Ameo',
          generations: [
            {
              name: 'Ameo (2016 launch)',
              yearStart: 2016,
              yearEnd: 2020,
              isCurrent: false,
              variants: [
                { name: 'Trendline', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2016, yearEnd: 2020 }] },
                { name: 'Comfortline', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2016, yearEnd: 2020 }] },
                { name: 'Highline', offerings: [{ fuelTypes: ['petrol', 'diesel'], yearStart: 2016, yearEnd: 2020 }] },
              ],
            },
          ],
        },
      ],
    },
    {
      marketCode: 'IN',
      vehicleType: 'suv',
      name: 'Volkswagen',
      sourceUrl: 'https://www.volkswagen.co.in/en/models.html',
      models: [
        {
          name: 'Taigun',
          sourceUrl: 'https://www.volkswagen.co.in/en/models/taigun.html',
          generations: [
            {
              name: 'Taigun (2021 launch)',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                { name: 'Comfortline', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
                { name: 'Highline', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
                { name: 'Topline', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
                { name: 'GT Plus', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
                { name: 'GT Line', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
                { name: 'GT Edge', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'Sport', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Tiguan',
          sourceUrl: 'https://www.volkswagen.co.in/en/models/tiguan.html',
          generations: [
            {
              name: 'Tiguan (2021 refresh)',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                { name: 'Elegance', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
              ],
            },
            {
              name: 'Tiguan (2017 launch)',
              yearStart: 2017,
              yearEnd: 2020,
              isCurrent: false,
              variants: [
                { name: 'Comfortline', offerings: [{ fuelTypes: ['diesel'], yearStart: 2017, yearEnd: 2020 }] },
                { name: 'Highline', offerings: [{ fuelTypes: ['diesel'], yearStart: 2017, yearEnd: 2020 }] },
              ],
            },
          ],
        },
        {
          name: 'Tayron',
          generations: [
            {
              name: 'Tayron (2025 launch)',
              yearStart: 2025,
              isCurrent: true,
              variants: [
                { name: 'Elegance', offerings: [{ fuelTypes: ['petrol'], yearStart: 2025, isCurrent: true }] },
                { name: 'R-Line', offerings: [{ fuelTypes: ['petrol'], yearStart: 2025, isCurrent: true }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};
