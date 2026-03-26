import type { CatalogImportSource } from '../types';

export const tvsIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'tvs-india',
  sourceUrl: 'https://www.tvsmotor.com/',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'TVS',
      sourceUrl: 'https://www.tvsmotor.com/our-products',
      models: [
        {
          name: 'Jupiter',
          generations: [
            {
              name: 'Jupiter 110 (BS6)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                {
                  name: 'Sheet Metal Wheel',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'ZX',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'Classic',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
              ],
            },
            {
              name: 'Jupiter 125',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                {
                  name: 'Drum',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
                {
                  name: 'Disc',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
                {
                  name: 'SmartXonnect',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'NTORQ 125',
          generations: [
            {
              name: 'NTORQ 125 (BS6)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                {
                  name: 'Drum',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'Disc',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'Race Edition',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'Super Squad',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'Race XP',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
                {
                  name: 'XT',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Raider 125',
          sourceUrl: 'https://www.tvsmotor.com/tvs-raider',
          generations: [
            {
              name: 'Raider 125 (2021 launch)',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                {
                  name: 'Drum',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
                {
                  name: 'Disc',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
                {
                  name: 'SmartXonnect',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
                {
                  name: 'Super Squad',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Apache RTR 160 4V',
          sourceUrl: 'https://www.tvsmotor.com/tvs-apache/apache-rtr-160-4v',
          generations: [
            {
              name: 'Apache RTR 160 4V (2024 update)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                {
                  name: 'Dual Disc',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: 'Special Edition',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }],
                },
              ],
            },
            {
              name: 'Apache RTR 160 4V (2018 launch)',
              yearStart: 2018,
              yearEnd: 2023,
              isCurrent: false,
              variants: [
                {
                  name: 'Carb',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2018, yearEnd: 2020 }],
                },
                {
                  name: 'FI',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2023 }],
                },
              ],
            },
          ],
        },
        {
          name: 'Apache RR 310',
          sourceUrl: 'https://www.tvsmotor.com/tvs-apache/super-premium/rr-310',
          generations: [
            {
              name: 'Apache RR 310 (2024 update)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                {
                  name: 'Red',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: 'Bomber Grey',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }],
                },
              ],
            },
            {
              name: 'Apache RR 310 (2018 launch)',
              yearStart: 2018,
              yearEnd: 2023,
              isCurrent: false,
              variants: [
                {
                  name: 'Race Replica',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2018, yearEnd: 2021 }],
                },
                {
                  name: 'BTO',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, yearEnd: 2023 }],
                },
              ],
            },
          ],
        },
        {
          name: 'Ronin',
          sourceUrl: 'https://www.tvsmotor.com/tvs-ronin',
          generations: [
            {
              name: 'Ronin (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: 'SS',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'DS',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'TD',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
