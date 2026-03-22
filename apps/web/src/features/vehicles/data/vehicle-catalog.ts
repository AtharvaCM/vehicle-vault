import { VehicleType } from '@vehicle-vault/shared';

type VehicleCatalogModel = {
  name: string;
  variants: string[];
};

type VehicleCatalogMake = {
  name: string;
  vehicleType: VehicleType;
  models: VehicleCatalogModel[];
};

const vehicleCatalog: VehicleCatalogMake[] = [
  {
    name: 'Hyundai',
    vehicleType: VehicleType.Car,
    models: [
      { name: 'Grand i10 Nios', variants: ['Era', 'Magna', 'Sportz', 'Asta'] },
      { name: 'i20', variants: ['Magna', 'Sportz', 'Asta', 'Asta (O)'] },
      { name: 'Verna', variants: ['EX', 'S', 'SX', 'SX (O)'] },
    ],
  },
  {
    name: 'Hyundai',
    vehicleType: VehicleType.SUV,
    models: [
      { name: 'Venue', variants: ['E', 'S', 'SX', 'SX (O)'] },
      { name: 'Creta', variants: ['E', 'EX', 'S', 'SX', 'SX (O)'] },
      { name: 'Alcazar', variants: ['Prestige', 'Platinum', 'Signature'] },
    ],
  },
  {
    name: 'Maruti Suzuki',
    vehicleType: VehicleType.Car,
    models: [
      { name: 'Swift', variants: ['LXi', 'VXi', 'ZXi', 'ZXi Plus'] },
      { name: 'Baleno', variants: ['Sigma', 'Delta', 'Zeta', 'Alpha'] },
      { name: 'Dzire', variants: ['LXi', 'VXi', 'ZXi', 'ZXi Plus'] },
      { name: 'WagonR', variants: ['LXi', 'VXi', 'ZXi', 'ZXi Plus'] },
    ],
  },
  {
    name: 'Maruti Suzuki',
    vehicleType: VehicleType.SUV,
    models: [
      { name: 'Brezza', variants: ['LXi', 'VXi', 'ZXi', 'ZXi Plus'] },
      { name: 'Fronx', variants: ['Sigma', 'Delta', 'Zeta', 'Alpha'] },
      { name: 'Grand Vitara', variants: ['Sigma', 'Delta', 'Zeta', 'Alpha'] },
    ],
  },
  {
    name: 'Tata',
    vehicleType: VehicleType.Car,
    models: [
      { name: 'Altroz', variants: ['XE', 'XM', 'XT', 'XZ', 'XZ Plus'] },
      { name: 'Tiago', variants: ['XE', 'XM', 'XT', 'XZ', 'XZ Plus'] },
      { name: 'Tigor', variants: ['XE', 'XM', 'XZ', 'XZ Plus'] },
    ],
  },
  {
    name: 'Tata',
    vehicleType: VehicleType.SUV,
    models: [
      { name: 'Punch', variants: ['Pure', 'Adventure', 'Accomplished', 'Creative'] },
      { name: 'Nexon', variants: ['Smart', 'Pure', 'Creative', 'Fearless'] },
      { name: 'Harrier', variants: ['Smart', 'Pure', 'Adventure', 'Fearless'] },
      { name: 'Safari', variants: ['Smart', 'Pure', 'Adventure', 'Fearless'] },
    ],
  },
  {
    name: 'Mahindra',
    vehicleType: VehicleType.SUV,
    models: [
      { name: 'XUV 3XO', variants: ['MX1', 'MX2', 'AX5', 'AX7'] },
      { name: 'Scorpio N', variants: ['Z2', 'Z4', 'Z6', 'Z8', 'Z8L'] },
      { name: 'Thar', variants: ['AX Opt', 'LX', 'Earth Edition'] },
      { name: 'XUV700', variants: ['MX', 'AX3', 'AX5', 'AX7', 'AX7L'] },
    ],
  },
  {
    name: 'Honda',
    vehicleType: VehicleType.Car,
    models: [
      { name: 'Amaze', variants: ['V', 'VX', 'ZX'] },
      { name: 'City', variants: ['SV', 'V', 'VX', 'ZX'] },
    ],
  },
  {
    name: 'Honda',
    vehicleType: VehicleType.SUV,
    models: [{ name: 'Elevate', variants: ['SV', 'V', 'VX', 'ZX'] }],
  },
  {
    name: 'Toyota',
    vehicleType: VehicleType.Car,
    models: [{ name: 'Glanza', variants: ['E', 'S', 'G', 'V'] }],
  },
  {
    name: 'Toyota',
    vehicleType: VehicleType.SUV,
    models: [
      { name: 'Urban Cruiser Hyryder', variants: ['E', 'S', 'G', 'V'] },
      { name: 'Fortuner', variants: ['4x2', '4x4', 'Legender'] },
      { name: 'Innova Hycross', variants: ['GX', 'VX', 'ZX', 'ZX (O)'] },
    ],
  },
  {
    name: 'Kia',
    vehicleType: VehicleType.SUV,
    models: [
      { name: 'Sonet', variants: ['HTE', 'HTK', 'HTK Plus', 'HTX', 'GTX Plus'] },
      { name: 'Seltos', variants: ['HTE', 'HTK', 'HTK Plus', 'HTX', 'GTX Plus'] },
      { name: 'Carens', variants: ['Premium', 'Prestige', 'Luxury', 'X-Line'] },
    ],
  },
  {
    name: 'Volkswagen',
    vehicleType: VehicleType.Car,
    models: [{ name: 'Virtus', variants: ['Comfortline', 'Highline', 'GT Line', 'GT Plus'] }],
  },
  {
    name: 'Volkswagen',
    vehicleType: VehicleType.SUV,
    models: [{ name: 'Taigun', variants: ['Comfortline', 'Highline', 'GT Line', 'GT Plus'] }],
  },
  {
    name: 'Skoda',
    vehicleType: VehicleType.Car,
    models: [{ name: 'Slavia', variants: ['Classic', 'Signature', 'Sportline', 'Prestige'] }],
  },
  {
    name: 'Skoda',
    vehicleType: VehicleType.SUV,
    models: [{ name: 'Kushaq', variants: ['Classic', 'Signature', 'Sportline', 'Prestige'] }],
  },
  {
    name: 'Royal Enfield',
    vehicleType: VehicleType.Motorcycle,
    models: [
      { name: 'Classic 350', variants: ['Redditch', 'Halcyon', 'Signals', 'Dark', 'Chrome'] },
      { name: 'Hunter 350', variants: ['Retro', 'Metro', 'Metro Rebel'] },
      { name: 'Meteor 350', variants: ['Fireball', 'Stellar', 'Supernova'] },
    ],
  },
  {
    name: 'Honda',
    vehicleType: VehicleType.Motorcycle,
    models: [
      { name: 'Shine 125', variants: ['Drum', 'Disc'] },
      { name: 'Unicorn', variants: ['Standard'] },
      { name: 'Activa 6G', variants: ['Standard', 'Deluxe', 'H-Smart'] },
    ],
  },
  {
    name: 'Hero',
    vehicleType: VehicleType.Motorcycle,
    models: [
      { name: 'Splendor Plus', variants: ['Drum', 'i3S', 'XTEC'] },
      { name: 'HF Deluxe', variants: ['Kick Start', 'Self Start', 'All Black'] },
      { name: 'Xtreme 125R', variants: ['IBS', 'Single Channel ABS'] },
    ],
  },
  {
    name: 'TVS',
    vehicleType: VehicleType.Motorcycle,
    models: [
      { name: 'Apache RTR 160', variants: ['Drum', 'Disc', 'Special Edition'] },
      { name: 'Jupiter', variants: ['Drum', 'ZX', 'SmartXonnect'] },
      { name: 'Ntorq 125', variants: ['Race Edition', 'Super Squad Edition', 'XT'] },
    ],
  },
  {
    name: 'Bajaj',
    vehicleType: VehicleType.Motorcycle,
    models: [
      { name: 'Pulsar 150', variants: ['Single Disc', 'Twin Disc'] },
      { name: 'Pulsar N160', variants: ['Single Channel ABS', 'Dual Channel ABS'] },
      { name: 'Chetak', variants: ['2903', 'Premium', 'Urbane'] },
    ],
  },
  {
    name: 'Yamaha',
    vehicleType: VehicleType.Motorcycle,
    models: [
      { name: 'FZ-S Fi', variants: ['Standard', 'Deluxe'] },
      { name: 'R15 V4', variants: ['Metallic Red', 'Dark Knight', 'M'] },
      { name: 'RayZR 125', variants: ['Drum', 'Disc', 'Street Rally'] },
    ],
  },
  {
    name: 'Suzuki',
    vehicleType: VehicleType.Motorcycle,
    models: [
      { name: 'Access 125', variants: ['Standard', 'Special Edition', 'Ride Connect'] },
      { name: 'Burgman Street', variants: ['EX', 'Ride Connect'] },
      { name: 'Gixxer', variants: ['Single Tone', 'Dual Tone'] },
    ],
  },
];

const supportedCatalogTypes = new Set<VehicleType>([
  VehicleType.Car,
  VehicleType.SUV,
  VehicleType.Motorcycle,
]);

export function supportsVehicleCatalog(vehicleType: VehicleType) {
  return supportedCatalogTypes.has(vehicleType);
}

export function getCatalogMakes(vehicleType: VehicleType) {
  return vehicleCatalog
    .filter((entry) => entry.vehicleType === vehicleType)
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
}

export function getCatalogModels(vehicleType: VehicleType, make: string) {
  return (
    vehicleCatalog.find(
      (entry) => entry.vehicleType === vehicleType && entry.name === make,
    )?.models ?? []
  )
    .map((model) => model.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
}

export function getCatalogVariants(vehicleType: VehicleType, make: string, model: string) {
  return (
    vehicleCatalog
      .find((entry) => entry.vehicleType === vehicleType && entry.name === make)
      ?.models.find((catalogModel) => catalogModel.name === model)?.variants ?? []
  ).slice();
}
