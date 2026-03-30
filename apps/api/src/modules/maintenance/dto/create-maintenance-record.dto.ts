import {
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordStatus,
  MaintenanceSource,
} from '@vehicle-vault/shared';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateMaintenanceLineItemDto {
  @IsEnum(MaintenanceLineItemKind)
  kind!: MaintenanceLineItemKind;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsEnum(MaintenanceCategory)
  normalizedCategory?: MaintenanceCategory;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  lineTotal?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  partNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  position?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateMaintenanceRecordDto {
  @IsDateString()
  serviceDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  odometer!: number;

  @IsEnum(MaintenanceCategory)
  category!: MaintenanceCategory;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workshopName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @IsOptional()
  @IsEnum(MaintenanceSource)
  source?: MaintenanceSource;

  @IsOptional()
  @IsEnum(MaintenanceRecordStatus)
  status?: MaintenanceRecordStatus;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalCost!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  laborCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  partsCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fluidsCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  nextDueOdometer?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMaintenanceLineItemDto)
  lineItems?: CreateMaintenanceLineItemDto[];
}
