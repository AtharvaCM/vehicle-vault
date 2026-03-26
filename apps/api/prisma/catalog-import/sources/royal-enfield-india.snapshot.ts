import type { CatalogImportSource } from '../types';

export const royalEnfieldIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'royal-enfield-india',
  sourceUrl: 'https://www.royalenfield.com/in/en/motorcycles/',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'Royal Enfield',
      sourceUrl: 'https://www.royalenfield.com/in/en/motorcycles/',
      models: [
        {
          name: 'Bullet 350',
          generations: [
            {
              name: 'Bullet 350 (J-platform)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'Base',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Mid',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Top',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Classic 350',
          sourceUrl: 'https://www.royalenfield.com/in/en/motorcycles/classic-350/',
          generations: [
            {
              name: 'Classic 350 (J-platform)',
              yearStart: 2021,
              isCurrent: true,
              variants: [
                {
                  name: 'Redditch',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
                {
                  name: 'Halcyon',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
                {
                  name: 'Signals',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
                {
                  name: 'Dark',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
                {
                  name: 'Chrome',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Hunter 350',
          sourceUrl: 'https://www.royalenfield.com/in/en/motorcycles/hunter-350/',
          generations: [
            {
              name: 'Hunter 350 (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                {
                  name: 'Retro',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'Metro',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
                {
                  name: 'Metro Rebel',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Himalayan 450',
          sourceUrl: 'https://www.royalenfield.com/in/en/motorcycles/new-himalayan/',
          generations: [
            {
              name: 'Himalayan 450 (2023 launch)',
              yearStart: 2023,
              isCurrent: true,
              variants: [
                {
                  name: 'Base',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Pass',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
                {
                  name: 'Summit',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Meteor 350',
          sourceUrl: 'https://www.royalenfield.com/in/en/motorcycles/meteor/',
          generations: [
            {
              name: 'Meteor 350 (2020 launch)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                {
                  name: 'Fireball',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'Stellar',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
                {
                  name: 'Supernova',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Interceptor 650',
          generations: [
            {
              name: 'Interceptor 650',
              yearStart: 2018,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2018, isCurrent: true }],
                },
                {
                  name: 'Custom',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2018, isCurrent: true }],
                },
              ],
            },
          ],
        },
        {
          name: 'Continental GT 650',
          generations: [
            {
              name: 'Continental GT 650',
              yearStart: 2018,
              isCurrent: true,
              variants: [
                {
                  name: 'Standard',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2018, isCurrent: true }],
                },
                {
                  name: 'Custom',
                  offerings: [{ fuelTypes: ['petrol'], yearStart: 2018, isCurrent: true }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
