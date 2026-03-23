import type { CatalogImportSource } from '../types';

export const marutiSuzukiIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'maruti-suzuki-india',
  sourceUrl: 'https://www.marutisuzuki.com/',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'car',
      name: 'Maruti Suzuki',
      sourceUrl: 'https://www.marutisuzuki.com/channels/arena/all-cars',
      models: [
        {
          name: 'Swift',
          sourceUrl: 'https://www.marutisuzuki.com/swift',
          generations: [
            {
              name: 'Swift (2024 update)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                {
                  name: 'LXi',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: 'VXi',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: 'ZXi',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: 'ZXi Plus',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }],
                },
              ],
            },
            {
              name: 'Swift (2018 generation)',
              yearStart: 2018,
              yearEnd: 2023,
              isCurrent: false,
              variants: [
                {
                  name: 'LXi',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2018, yearEnd: 2023 }],
                },
                {
                  name: 'VXi',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2018, yearEnd: 2023 }],
                },
                {
                  name: 'ZXi',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2018, yearEnd: 2023 }],
                },
                {
                  name: 'ZXi Plus',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2018, yearEnd: 2023 }],
                },
              ],
            },
          ],
        },
        {
          name: 'Dzire',
          sourceUrl: 'https://www.marutisuzuki.com/dzire',
          generations: [
            {
              name: 'Dzire (2024 update)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                {
                  name: 'LXi',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: 'VXi',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: 'ZXi',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }],
                },
                {
                  name: 'ZXi Plus',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Baleno',
          sourceUrl: 'https://www.nexaexperience.com/baleno',
          generations: [
            {
              name: 'Baleno (2022 update)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: 'Sigma',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'Delta',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'Zeta',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'Alpha',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'WagonR',
          sourceUrl: 'https://www.marutisuzuki.com/wagonr',
          generations: [
            {
              name: 'WagonR (2022 update)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: 'LXi',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'VXi',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'ZXi',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: '800',
          generations: [
            {
              name: '800 (1983 launch)',
              yearStart: 1983,
              yearEnd: 2014,
              isCurrent: false,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 1983, yearEnd: 2014 }],
                },
                {
                  name: 'AC',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 1983, yearEnd: 2014 }],
                },
              ],
            },
          ],
        },
        {
          name: 'Zen',
          generations: [
            {
              name: 'Zen (1993 launch)',
              yearStart: 1993,
              yearEnd: 2006,
              isCurrent: false,
              variants: [
                {
                  name: 'LX',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 1993, yearEnd: 2006 }],
                },
                {
                  name: 'LXi',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 1993, yearEnd: 2006 }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      marketCode: 'IN',
      vehicleType: 'suv',
      name: 'Maruti Suzuki',
      sourceUrl: 'https://www.marutisuzuki.com/channels/nexa/all-cars',
      models: [
        {
          name: 'Brezza',
          sourceUrl: 'https://www.marutisuzuki.com/brezza',
          generations: [
            {
              name: 'Brezza (2022 update)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: 'LXi',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'VXi',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'ZXi',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'ZXi Plus',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Fronx',
          sourceUrl: 'https://www.nexaexperience.com/fronx',
          generations: [
            {
              name: 'Fronx (2023 launch)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'Sigma',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Delta',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Zeta',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Alpha',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Grand Vitara',
          sourceUrl: 'https://www.nexaexperience.com/grand-vitara',
          generations: [
            {
              name: 'Grand Vitara (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: 'Sigma',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'Delta',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'Zeta',
                  offerings: [{ fuelTypes: ['petrol', 'hybrid'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'Alpha',
                  offerings: [{ fuelTypes: ['petrol', 'hybrid'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Ertiga',
          sourceUrl: 'https://www.marutisuzuki.com/ertiga',
          generations: [
            {
              name: 'Ertiga (2022 update)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: 'LXi',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'VXi',
                  offerings: [{ fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'ZXi',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'ZXi Plus',
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
