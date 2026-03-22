import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DEFAULT_VEHICLE_CATALOG_MARKET, VehicleCatalogMarket, VehicleType } from '@vehicle-vault/shared';

export class ListVehicleCatalogModelsDto {
  @IsOptional()
  @Type(() => String)
  @IsEnum(VehicleCatalogMarket)
  marketCode: VehicleCatalogMarket = DEFAULT_VEHICLE_CATALOG_MARKET;

  @Type(() => String)
  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @IsString()
  make!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  query?: string;
}
