type CatalogSeedVariant = {
  name: string;
  fuelTypes: Array<'petrol' | 'diesel' | 'electric' | 'hybrid' | 'cng' | 'lpg' | 'other'>;
  yearStart?: number;
  yearEnd?: number;
  isCurrent?: boolean;
  sourceUrl?: string;
};

type CatalogSeedModel = {
  name: string;
  variants: CatalogSeedVariant[];
  sourceUrl?: string;
};

type CatalogSeedMake = {
  marketCode: 'IN';
  vehicleType: 'car' | 'motorcycle' | 'suv' | 'truck' | 'van' | 'other';
  name: string;
  models: CatalogSeedModel[];
  sourceUrl?: string;
};

export const vehicleCatalogSeedData: CatalogSeedMake[] = [
  {
    marketCode: 'IN',
    vehicleType: 'car',
    name: 'Hyundai',
    sourceUrl: 'https://www.hyundai.com/in/en/find-a-car',
    models: [
      {
        name: 'Grand i10 Nios',
        variants: [
          { name: 'Era', fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'Magna', fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'Sportz', fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'Asta', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
        ],
      },
      {
        name: 'i20',
        variants: [
          { name: 'Magna', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'Sportz', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'Asta', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'Asta (O)', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
        ],
      },
      {
        name: 'Verna',
        variants: [
          { name: 'EX', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'S', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'SX', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'SX (O)', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
        ],
      },
    ],
  },
  {
    marketCode: 'IN',
    vehicleType: 'suv',
    name: 'Hyundai',
    sourceUrl: 'https://www.hyundai.com/in/en/find-a-car',
    models: [
      {
        name: 'Venue',
        variants: [
          { name: 'E', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'S', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'SX', fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true },
          { name: 'SX (O)', fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true },
        ],
      },
      {
        name: 'Creta',
        variants: [
          { name: 'E', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'EX', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'S', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'SX', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'SX (O)', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'SX Executive', fuelTypes: ['petrol', 'diesel'], yearStart: 2020, yearEnd: 2023 },
        ],
      },
      {
        name: 'Alcazar',
        variants: [
          { name: 'Prestige', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'Platinum', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'Signature', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
        ],
      },
    ],
  },
  {
    marketCode: 'IN',
    vehicleType: 'car',
    name: 'Maruti Suzuki',
    sourceUrl: 'https://www.marutisuzuki.com/channels/arena/all-cars',
    models: [
      {
        name: 'Swift',
        variants: [
          { name: 'LXi', fuelTypes: ['petrol', 'cng'], yearStart: 2024, isCurrent: true },
          { name: 'VXi', fuelTypes: ['petrol', 'cng'], yearStart: 2024, isCurrent: true },
          { name: 'ZXi', fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true },
          { name: 'ZXi Plus', fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true },
        ],
      },
      {
        name: 'Baleno',
        variants: [
          { name: 'Sigma', fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true },
          { name: 'Delta', fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true },
          { name: 'Zeta', fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true },
          { name: 'Alpha', fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true },
        ],
      },
      {
        name: 'Dzire',
        variants: [
          { name: 'LXi', fuelTypes: ['petrol', 'cng'], yearStart: 2024, isCurrent: true },
          { name: 'VXi', fuelTypes: ['petrol', 'cng'], yearStart: 2024, isCurrent: true },
          { name: 'ZXi', fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true },
          { name: 'ZXi Plus', fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true },
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
        variants: [
          { name: 'LXi', fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true },
          { name: 'VXi', fuelTypes: ['petrol', 'cng'], yearStart: 2022, isCurrent: true },
          { name: 'ZXi', fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true },
          { name: 'ZXi Plus', fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true },
        ],
      },
      {
        name: 'Fronx',
        variants: [
          { name: 'Sigma', fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'Delta', fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'Zeta', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'Alpha', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
        ],
      },
      {
        name: 'Grand Vitara',
        variants: [
          { name: 'Sigma', fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true },
          { name: 'Delta', fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true },
          { name: 'Zeta', fuelTypes: ['petrol', 'hybrid'], yearStart: 2022, isCurrent: true },
          { name: 'Alpha', fuelTypes: ['petrol', 'hybrid'], yearStart: 2022, isCurrent: true },
        ],
      },
    ],
  },
  {
    marketCode: 'IN',
    vehicleType: 'car',
    name: 'Tata',
    sourceUrl: 'https://cars.tatamotors.com/',
    models: [
      {
        name: 'Altroz',
        variants: [
          { name: 'XE', fuelTypes: ['petrol', 'diesel', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'XM', fuelTypes: ['petrol', 'diesel', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'XT', fuelTypes: ['petrol', 'diesel', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'XZ', fuelTypes: ['petrol', 'diesel', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'XZ Plus', fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true },
        ],
      },
      {
        name: 'Tiago',
        variants: [
          { name: 'XE', fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'XM', fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'XT', fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'XZ', fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'XZ Plus', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
        ],
      },
    ],
  },
  {
    marketCode: 'IN',
    vehicleType: 'suv',
    name: 'Tata',
    sourceUrl: 'https://cars.tatamotors.com/',
    models: [
      {
        name: 'Punch',
        variants: [
          { name: 'Pure', fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'Adventure', fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'Accomplished', fuelTypes: ['petrol', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'Creative', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
        ],
      },
      {
        name: 'Nexon',
        variants: [
          { name: 'Smart', fuelTypes: ['petrol', 'diesel', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'Pure', fuelTypes: ['petrol', 'diesel', 'cng'], yearStart: 2023, isCurrent: true },
          { name: 'Creative', fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true },
          { name: 'Fearless', fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true },
        ],
      },
    ],
  },
  {
    marketCode: 'IN',
    vehicleType: 'suv',
    name: 'Mahindra',
    sourceUrl: 'https://auto.mahindra.com/suv',
    models: [
      {
        name: 'XUV 3XO',
        variants: [
          { name: 'MX1', fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true },
          { name: 'MX2', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'AX5', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'AX7', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
        ],
      },
      {
        name: 'Scorpio N',
        variants: [
          { name: 'Z2', fuelTypes: ['petrol', 'diesel'], yearStart: 2022, isCurrent: true },
          { name: 'Z4', fuelTypes: ['petrol', 'diesel'], yearStart: 2022, isCurrent: true },
          { name: 'Z6', fuelTypes: ['diesel'], yearStart: 2022, isCurrent: true },
          { name: 'Z8', fuelTypes: ['petrol', 'diesel'], yearStart: 2022, isCurrent: true },
          { name: 'Z8L', fuelTypes: ['petrol', 'diesel'], yearStart: 2022, isCurrent: true },
        ],
      },
      {
        name: 'XUV700',
        variants: [
          { name: 'MX', fuelTypes: ['petrol', 'diesel'], yearStart: 2021, isCurrent: true },
          { name: 'AX3', fuelTypes: ['petrol', 'diesel'], yearStart: 2021, isCurrent: true },
          { name: 'AX5', fuelTypes: ['petrol', 'diesel'], yearStart: 2021, isCurrent: true },
          { name: 'AX7', fuelTypes: ['petrol', 'diesel'], yearStart: 2021, isCurrent: true },
          { name: 'AX7L', fuelTypes: ['petrol', 'diesel'], yearStart: 2021, isCurrent: true },
        ],
      },
    ],
  },
  {
    marketCode: 'IN',
    vehicleType: 'car',
    name: 'Honda',
    sourceUrl: 'https://www.hondacarindia.com/',
    models: [
      {
        name: 'Amaze',
        variants: [
          { name: 'V', fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true },
          { name: 'VX', fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true },
          { name: 'ZX', fuelTypes: ['petrol'], yearStart: 2024, isCurrent: true },
        ],
      },
      {
        name: 'City',
        variants: [
          { name: 'SV', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'V', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'VX', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'ZX', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: '4th Gen V', fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2023 },
          { name: '4th Gen VX', fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2023 },
        ],
      },
    ],
  },
  {
    marketCode: 'IN',
    vehicleType: 'suv',
    name: 'Honda',
    sourceUrl: 'https://www.hondacarindia.com/',
    models: [
      {
        name: 'Elevate',
        variants: [
          { name: 'SV', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'V', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'VX', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'ZX', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
        ],
      },
    ],
  },
  {
    marketCode: 'IN',
    vehicleType: 'suv',
    name: 'Toyota',
    sourceUrl: 'https://www.toyotabharat.com/showroom',
    models: [
      {
        name: 'Urban Cruiser Hyryder',
        variants: [
          { name: 'E', fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true },
          { name: 'S', fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true },
          { name: 'G', fuelTypes: ['petrol', 'hybrid'], yearStart: 2022, isCurrent: true },
          { name: 'V', fuelTypes: ['petrol', 'hybrid'], yearStart: 2022, isCurrent: true },
        ],
      },
      {
        name: 'Fortuner',
        variants: [
          { name: '4x2', fuelTypes: ['diesel'], yearStart: 2021, isCurrent: true },
          { name: '4x4', fuelTypes: ['diesel'], yearStart: 2021, isCurrent: true },
          { name: 'Legender', fuelTypes: ['diesel'], yearStart: 2021, isCurrent: true },
        ],
      },
    ],
  },
  {
    marketCode: 'IN',
    vehicleType: 'suv',
    name: 'Kia',
    sourceUrl: 'https://www.kia.com/in/home.html',
    models: [
      {
        name: 'Sonet',
        variants: [
          { name: 'HTE', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'HTK', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'HTK Plus', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'HTX', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
          { name: 'GTX Plus', fuelTypes: ['petrol', 'diesel'], yearStart: 2024, isCurrent: true },
        ],
      },
      {
        name: 'Seltos',
        variants: [
          { name: 'HTE', fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true },
          { name: 'HTK', fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true },
          { name: 'HTK Plus', fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true },
          { name: 'HTX', fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true },
          { name: 'GTX Plus', fuelTypes: ['petrol', 'diesel'], yearStart: 2023, isCurrent: true },
        ],
      },
    ],
  },
  {
    marketCode: 'IN',
    vehicleType: 'motorcycle',
    name: 'Royal Enfield',
    sourceUrl: 'https://www.royalenfield.com/in/en/motorcycles/',
    models: [
      {
        name: 'Classic 350',
        variants: [
          { name: 'Redditch', fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true },
          { name: 'Halcyon', fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true },
          { name: 'Signals', fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true },
          { name: 'Dark', fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true },
          { name: 'Chrome', fuelTypes: ['petrol'], yearStart: 2021, isCurrent: true },
        ],
      },
      {
        name: 'Hunter 350',
        variants: [
          { name: 'Retro', fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true },
          { name: 'Metro', fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true },
          { name: 'Metro Rebel', fuelTypes: ['petrol'], yearStart: 2022, isCurrent: true },
        ],
      },
    ],
  },
  {
    marketCode: 'IN',
    vehicleType: 'motorcycle',
    name: 'Honda',
    sourceUrl: 'https://www.honda2wheelersindia.com/',
    models: [
      {
        name: 'Shine 125',
        variants: [
          { name: 'Drum', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'Disc', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
        ],
      },
      {
        name: 'Activa 6G',
        variants: [
          { name: 'Standard', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'Deluxe', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'H-Smart', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
        ],
      },
    ],
  },
  {
    marketCode: 'IN',
    vehicleType: 'motorcycle',
    name: 'TVS',
    sourceUrl: 'https://www.tvsmotor.com/',
    models: [
      {
        name: 'Apache RTR 160',
        variants: [
          { name: 'Drum', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'Disc', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'Special Edition', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
        ],
      },
      {
        name: 'Jupiter',
        variants: [
          { name: 'Drum', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'ZX', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
          { name: 'SmartXonnect', fuelTypes: ['petrol'], yearStart: 2023, isCurrent: true },
        ],
      },
    ],
  },
];
