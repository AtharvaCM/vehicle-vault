import { compactRegistrationNumber, FuelType, VehicleType } from '@vehicle-vault/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateVehicleDto {
  @IsOptional()
  // One spelling per plate (MH12DM0002), whatever spacing the client sent.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? compactRegistrationNumber(value) : value,
  )
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
  variant?: string | null;

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
  nickname?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometer?: number;

  @IsOptional()
  @IsString()
  catalogVariantId?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  purchaseOdometer?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  engineOilGrade?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(50)
  engineOilLitres?: number | null;
}
