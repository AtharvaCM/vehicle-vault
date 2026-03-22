import type { VehicleType } from '@prisma/client';

type MakeAliasSeed = {
  aliases: string[];
  makeName: string;
  marketCode: string;
  vehicleType: VehicleType;
};

type ModelAliasSeed = {
  aliases: string[];
  makeName: string;
  marketCode: string;
  modelName: string;
  vehicleType: VehicleType;
};

type GenerationAliasSeed = {
  aliases: string[];
  generationName: string;
  makeName: string;
  marketCode: string;
  modelName: string;
  vehicleType: VehicleType;
};

type VariantAliasSeed = {
  aliases: string[];
  generationName: string;
  makeName: string;
  marketCode: string;
  modelName: string;
  variantName: string;
  vehicleType: VehicleType;
};

export const indiaCatalogAliases: {
  generations: GenerationAliasSeed[];
  makes: MakeAliasSeed[];
  models: ModelAliasSeed[];
  variants: VariantAliasSeed[];
} = {
  makes: [
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Maruti Suzuki', aliases: ['Maruti', 'MSIL', 'Maruti Suzuki India'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Maruti Suzuki', aliases: ['Maruti', 'MSIL', 'Maruti Suzuki India'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Volkswagen', aliases: ['VW', 'Volkswagen India'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Volkswagen', aliases: ['VW', 'Volkswagen India'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Skoda', aliases: ['Skoda Auto'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Skoda', aliases: ['Skoda Auto'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Royal Enfield', aliases: ['RE', 'Royal Enfield India'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Hero', aliases: ['Hero MotoCorp'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'TVS', aliases: ['TVS Motor'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Bajaj', aliases: ['Bajaj Auto'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Yamaha', aliases: ['Yamaha India'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Honda', aliases: ['Honda Cars'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Honda', aliases: ['Honda Cars'] },
  ],
  models: [
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Hyundai', modelName: 'i20', aliases: ['Hyundai i20', 'i20 Sportz', 'i20 Asta', 'Elite i20'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Hyundai', modelName: 'Creta', aliases: ['Hyundai Creta', 'Old Creta'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Maruti Suzuki', modelName: 'Swift', aliases: ['Maruti Swift', 'Old Swift', 'Old Swift ZXI'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Maruti Suzuki', modelName: 'WagonR', aliases: ['Wagon R', 'New WagonR'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Volkswagen', modelName: 'Polo', aliases: ['VW Polo', 'Polo GT TSI', 'Polo GT'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Toyota', modelName: 'Fortuner', aliases: ['Toyota Fortuner', 'Old Fortuner'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Toyota', modelName: 'Innova Crysta', aliases: ['Toyota Innova Crysta', 'Old Innova Crysta'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Renault', modelName: 'Duster', aliases: ['Renault Duster', 'Old Duster'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Yamaha', modelName: 'FZ-S Fi', aliases: ['FZ', 'FZ V3', 'FZS V3'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Yamaha', modelName: 'R15', aliases: ['YZF R15', 'R15 V3', 'R15 V4'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Hero', modelName: 'Splendor Plus', aliases: ['Splendor', 'Hero Splendor'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'TVS', modelName: 'Apache RTR 160 4V', aliases: ['Apache 160 4V', 'RTR 160 4V'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Bajaj', modelName: 'Pulsar NS200', aliases: ['NS200', 'Pulsar NS'] },
  ],
  generations: [
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Hyundai', modelName: 'i20', generationName: 'i20 (2020 launch)', aliases: ['New i20', 'i20 2020'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Hyundai', modelName: 'Creta', generationName: 'Creta (2020 launch)', aliases: ['Old Creta', 'Creta 2020'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Maruti Suzuki', modelName: 'Swift', generationName: 'Swift (2018 generation)', aliases: ['Old Swift', 'Swift 2018', 'Third Gen Swift'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Volkswagen', modelName: 'Polo', generationName: 'Polo (2014 facelift)', aliases: ['Old Polo', 'Polo GT TSI era', 'Polo 1.2 TSI'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Yamaha', modelName: 'FZ-S Fi', generationName: 'FZ-S Fi (V3 lineup)', aliases: ['FZ V3', 'FZS V3'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Yamaha', modelName: 'R15', generationName: 'R15 V3 (2018 launch)', aliases: ['R15 V3', 'R15 3.0'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Renault', modelName: 'Duster', generationName: 'Duster (2016 facelift)', aliases: ['Old Duster', 'Duster AWD era'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Toyota', modelName: 'Fortuner', generationName: 'Fortuner (2016 launch)', aliases: ['Old Fortuner', 'Fortuner pre-facelift'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Tata', modelName: 'Nexon', generationName: 'Nexon (2020 facelift)', aliases: ['Old Nexon', 'Nexon 2020'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Bajaj', modelName: 'Pulsar NS200', generationName: 'Pulsar NS200 (2012 launch)', aliases: ['Old NS200'] },
  ],
  variants: [
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Hyundai', modelName: 'i20', generationName: 'i20 (2023 lineup)', variantName: 'Sportz', aliases: ['i20 Sportz'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Maruti Suzuki', modelName: 'Swift', generationName: 'Swift (2018 generation)', variantName: 'ZXi', aliases: ['Old Swift ZXI'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Volkswagen', modelName: 'Polo', generationName: 'Polo (2014 facelift)', variantName: 'GT TSI', aliases: ['Polo GT TSI', 'GT TSI'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Yamaha', modelName: 'R15', generationName: 'R15 V3 (2018 launch)', variantName: 'Standard', aliases: ['R15 V3'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Toyota', modelName: 'Fortuner', generationName: 'Fortuner (2016 launch)', variantName: '4x2 AT', aliases: ['Old Fortuner 4x2'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Renault', modelName: 'Duster', generationName: 'Duster (2016 facelift)', variantName: 'RXZ', aliases: ['Duster RXZ'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Tata', modelName: 'Nexon', generationName: 'Nexon (2020 facelift)', variantName: 'XZ Plus', aliases: ['Old Nexon XZ Plus'] },
  ],
};
