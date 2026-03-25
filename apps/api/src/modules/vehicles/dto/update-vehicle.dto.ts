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

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  make?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  variant?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsEnum(FuelType)
  fuelType?: FuelType;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nickname?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometer?: number;

  @IsOptional()
  @IsString()
  catalogVariantId?: string;
}
