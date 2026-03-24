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
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Maruti Suzuki', modelName: '800', aliases: ['Maruti 800', 'M800'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Maruti Suzuki', modelName: 'Zen', aliases: ['Maruti Zen', 'Old Zen'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Honda', modelName: 'Civic', aliases: ['Honda Civic', 'Old Civic'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Tata', modelName: 'Indica', aliases: ['Tata Indica', 'Indica V2'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Tata', modelName: 'Safari', aliases: ['Tata Safari', 'Safari Storme', 'Safari Dicor'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Hyundai', modelName: 'Verna', aliases: ['Hyundai Verna', 'Fluidic Verna'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Hyundai', modelName: 'Venue', aliases: ['Hyundai Venue'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Hyundai', modelName: 'Santro', aliases: ['Hyundai Santro', 'New Santro'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Mahindra', modelName: 'Scorpio Classic', aliases: ['Scorpio', 'Old Scorpio'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Mahindra', modelName: 'Thar', aliases: ['Mahindra Thar', 'Old Thar'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Mahindra', modelName: 'Bolero', aliases: ['Mahindra Bolero'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Toyota', modelName: 'Innova Hycross', aliases: ['Hycross', 'Innova Hybrid'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Toyota', modelName: 'Urban Cruiser Hyryder', aliases: ['Hyryder', 'Toyota Hyryder'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Hero', modelName: 'HF Deluxe', aliases: ['HF Dawn'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Hero', modelName: 'Passion Pro', aliases: ['Hero Passion'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Hero', modelName: 'Glamour', aliases: ['Hero Glamour'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Bajaj', modelName: 'Pulsar 150', aliases: ['Pulsar 150'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Bajaj', modelName: 'Pulsar 220F', aliases: ['Pulsar 220'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Bajaj', modelName: 'Platina', aliases: ['Bajaj Platina'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Royal Enfield', modelName: 'Bullet 350', aliases: ['Bullet', 'Standard 350'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Royal Enfield', modelName: 'Continental GT 650', aliases: ['Continental GT', 'CGT 650'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Royal Enfield', modelName: 'Interceptor 650', aliases: ['Interceptor', 'INT 650'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'TVS', modelName: 'Jupiter', aliases: ['TVS Jupiter'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'TVS', modelName: 'NTORQ 125', aliases: ['Ntorq'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Yamaha', modelName: 'RayZR', aliases: ['Ray ZR'] },
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
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Honda', modelName: 'City', generationName: 'City (Type 2)', aliases: ['Type 2 City', 'Old City'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Honda', modelName: 'City', generationName: 'City (Dolphin)', aliases: ['Dolphin City'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Maruti Suzuki', modelName: '800', generationName: '800 (1983 launch)', aliases: ['M800'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Maruti Suzuki', modelName: 'Zen', generationName: 'Zen (1993 launch)', aliases: ['Zen 1993'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Tata', modelName: 'Indica', generationName: 'Indica (V2)', aliases: ['Indica V2'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Tata', modelName: 'Safari', generationName: 'Safari Storme', aliases: ['Safari Storme'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Tata', modelName: 'Safari', generationName: 'Safari Dicor', aliases: ['Safari Dicor'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Hyundai', modelName: 'Santro', generationName: 'Santro (2018 revival)', aliases: ['New Santro'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Mahindra', modelName: 'Scorpio Classic', generationName: 'Scorpio (2014 facelift)', aliases: ['Old Scorpio'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Mahindra', modelName: 'Thar', generationName: 'Thar (2010 launch)', aliases: ['Old Thar', 'Thar CRDe'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Toyota', modelName: 'Innova Crysta', generationName: 'Innova Crysta (2016 launch)', aliases: ['Old Innova Crysta'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Bajaj', modelName: 'Pulsar 220F', generationName: 'Pulsar 220F (BS6)', aliases: ['Pulsar 220 BS6'] },
  ],
  variants: [
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Hyundai', modelName: 'i20', generationName: 'i20 (2023 lineup)', variantName: 'Sportz', aliases: ['i20 Sportz'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Maruti Suzuki', modelName: 'Swift', generationName: 'Swift (2018 generation)', variantName: 'ZXi', aliases: ['Old Swift ZXI'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Volkswagen', modelName: 'Polo', generationName: 'Polo (2014 facelift)', variantName: 'GT TSI', aliases: ['Polo GT TSI', 'GT TSI'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Yamaha', modelName: 'R15', generationName: 'R15 V3 (2018 launch)', variantName: 'Standard', aliases: ['R15 V3'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Toyota', modelName: 'Fortuner', generationName: 'Fortuner (2016 launch)', variantName: '4x2 AT', aliases: ['Old Fortuner 4x2'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Renault', modelName: 'Duster', generationName: 'Duster (2016 facelift)', variantName: 'RXZ', aliases: ['Duster RXZ'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Tata', modelName: 'Nexon', generationName: 'Nexon (2020 facelift)', variantName: 'XZ Plus', aliases: ['Old Nexon XZ Plus'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Maruti Suzuki', modelName: 'Zen', generationName: 'Zen (1993 launch)', variantName: 'LX', aliases: ['Zen LX'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Maruti Suzuki', modelName: 'Zen', generationName: 'Zen (1993 launch)', variantName: 'LXi', aliases: ['Zen LXi'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Tata', modelName: 'Indica', generationName: 'Indica (V2)', variantName: 'DLS', aliases: ['Indica V2 DLS'] },
    { marketCode: 'IN', vehicleType: 'car', makeName: 'Tata', modelName: 'Indica', generationName: 'Indica (V2)', variantName: 'DLE', aliases: ['Indica V2 DLE'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Mahindra', modelName: 'Scorpio Classic', generationName: 'Scorpio Classic (2022 launch)', variantName: 'S11', aliases: ['Scorpio S11'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Bajaj', modelName: 'Pulsar 220F', generationName: 'Pulsar 220F (BS6)', variantName: 'Standard', aliases: ['Pulsar 220'] },
    { marketCode: 'IN', vehicleType: 'motorcycle', makeName: 'Royal Enfield', modelName: 'Bullet 350', generationName: 'Bullet 350 (J-platform)', variantName: 'Base', aliases: ['Bullet Standard'] },
    { marketCode: 'IN', vehicleType: 'suv', makeName: 'Skoda', modelName: 'Kushaq', generationName: 'Kushaq (2021 launch)', variantName: 'Monte Carlo', aliases: ['Kushaq Monte Carlo'] },
  ],
};
