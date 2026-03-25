import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  registrationNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  make!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  variant!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year!: number;

  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @IsEnum(FuelType)
  fuelType!: FuelType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nickname?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometer!: number;

  @IsOptional()
  @IsString()
  catalogVariantId?: string;
}
