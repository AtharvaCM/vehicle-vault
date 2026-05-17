import {
  MaintenanceCategory,
  MaintenanceRecordStatus,
  MaintenanceSource,
} from '@vehicle-vault/shared';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
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

import { CreateMaintenanceLineItemDto } from './create-maintenance-record.dto';
import { roundMoney } from '../../../common/transforms/round-money.transform';

export class UpdateMaintenanceRecordDto {
  @IsOptional()
  @IsDateString()
  serviceDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  odometer?: number;

  @IsOptional()
  @IsEnum(MaintenanceCategory)
  category?: MaintenanceCategory;

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

  @IsOptional()
  @Transform(({ value }) => roundMoney(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalCost?: number;

  @IsOptional()
  @Transform(({ value }) => roundMoney(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  laborCost?: number;

  @IsOptional()
  @Transform(({ value }) => roundMoney(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  partsCost?: number;

  @IsOptional()
  @Transform(({ value }) => roundMoney(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fluidsCost?: number;

  @IsOptional()
  @Transform(({ value }) => roundMoney(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxCost?: number;

  @IsOptional()
  @Transform(({ value }) => roundMoney(value))
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
