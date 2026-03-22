import type { CatalogImportSource } from '../types';

export const bajajIndiaSnapshot: CatalogImportSource = {
  marketCode: 'IN',
  sourceKey: 'bajaj-india',
  sourceUrl: 'https://www.bajajauto.com/',
  capturedAt: '2026-03-22',
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      name: 'Bajaj',
      sourceUrl: 'https://www.bajajauto.com/bikes',
      models: [
        {
          name: 'Pulsar N160',
          sourceUrl: 'https://www.bajajauto.com/bikes/pulsar/pulsar-n160',
          generations: [
            {
              name: 'Pulsar N160 (2022 launch)',
              yearStart: 2022,
              isCurrent: true,
              variants: [
                { name: 'Single Channel ABS', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
                { name: 'Dual Channel ABS', offerings: [{ fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true }] },
                { name: 'USD Fork', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Pulsar NS200',
          sourceUrl: 'https://www.bajajauto.com/bikes/pulsar/pulsar-ns200',
          generations: [
            {
              name: 'Pulsar NS200 (2024 refresh)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                { name: 'Dual Channel ABS', offerings: [{ fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true }] },
              ],
            },
            {
              name: 'Pulsar NS200 (2012 launch)',
              yearStart: 2012,
              yearEnd: 2023,
              isCurrent: false,
              variants: [
                { name: 'Standard', offerings: [{ fuelTypes: ['petrol'], yearStart: 2012, yearEnd: 2023 }] },
              ],
            },
          ],
        },
        {
          name: 'Dominar 400',
          sourceUrl: 'https://www.bajajauto.com/bikes/dominar/dominar-400',
          generations: [
            {
              name: 'Dominar 400 (2019 touring update)',
              yearStart: 2019,
              isCurrent: true,
              variants: [
                { name: 'Standard', offerings: [{ fuelTypes: ['petrol'], yearStart: 2019, isCurrent: true }] },
              ],
            },
          ],
        },
        {
          name: 'Avenger Cruise 220',
          sourceUrl: 'https://www.bajajauto.com/bikes/avenger/avenger-cruise-220',
          generations: [
            {
              name: 'Avenger Cruise 220 (2020 lineup)',
              yearStart: 2020,
              isCurrent: true,
              variants: [
                { name: 'Cruise 220', offerings: [{ fuelTypes: ['petrol'], yearStart: 2020, isCurrent: true }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};
