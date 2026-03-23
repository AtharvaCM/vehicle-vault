import type { CatalogImportSource } from '../types';

export const yamahaIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'yamaha-india',
  sourceUrl: 'https://www.yamaha-motor-india.com/',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'Yamaha',
      sourceUrl: 'https://www.yamaha-motor-india.com/motorcycles.html',
      models: [
        {
          name: 'FZ-S Fi',
          sourceUrl: 'https://www.yamaha-motor-india.com/yamaha-fzsfi-v4.html',
          generations: [
            {
              name: 'FZ-S Fi (V4 lineup)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                { name: 'Standard', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
                { name: 'Deluxe', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
              ],
            },
            {
              name: 'FZ-S Fi (V3 lineup)',
              yearStart: 2019,
              yearEnd: 2022,
              isCurrent: false,
              variants: [
                { name: 'Standard', offerings: [{ fuelTypes: ['petrol'], yearStart: 2019, yearEnd: 2022 }] },
              ],
            },
            {
              name: 'FZ-S Fi (V2 lineup)',
              yearStart: 2014,
              yearEnd: 2018,
              isCurrent: false,
              variants: [
                { name: 'Standard', offerings: [{ fuelTypes: ['petrol'], yearStart: 2014, yearEnd: 2018 }] },
              ],
            },
          ],
        },
        {
          name: 'MT-15',
          sourceUrl: 'https://www.yamaha-motor-india.com/yamaha-mt15-v2.html',
          generations: [
            {
              name: 'MT-15 V2 (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                { name: 'Standard', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
                { name: 'Deluxe', offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'R15',
          sourceUrl: 'https://www.yamaha-motor-india.com/yamaha-yzf-r15v4.html',
          generations: [
            {
              name: 'R15 V4 (2021 launch)',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                { name: 'Metallic Red', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
                { name: 'Dark Knight', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
                { name: 'M', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
              ],
            },
            {
              name: 'R15 V3 (2018 launch)',
              yearStart: 2018,
              yearEnd: 2021,
              isCurrent: false,
              variants: [
                { name: 'Standard', offerings: [{ fuelTypes: ['petrol'], yearStart: 2018, yearEnd: 2021 }] },
                { name: 'M', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2021 }] },
              ],
            },
          ],
        },
        {
          name: 'FZ-X',
          sourceUrl: 'https://www.yamaha-motor-india.com/yamaha-fzx.html',
          generations: [
            {
              name: 'FZ-X (2021 launch)',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                { name: 'Standard', offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }] },
                { name: 'Chrome', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'RayZR',
          sourceUrl: 'https://www.yamaha-motor-india.com/yamaha-rayzr125-fi.html',
          generations: [
            {
              name: 'RayZR 125 Fi Hybrid (2021 launch)',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                { name: 'Drum', offerings: [{ fuelTypes: ['petrol', 'hybrid'], yearStart: 2021, isCurrent: true }] },
                { name: 'Disc', offerings: [{ fuelTypes: ['petrol', 'hybrid'], yearStart: 2021, isCurrent: true }] },
              ],
            },
            {
              name: 'RayZR 125 Fi (2020 launch)',
              yearStart: 2020,
              yearEnd: 2021,
              isCurrent: false,
              variants: [
                { name: 'Standard', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2021 }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};
