import { MaintenanceCategory, ReminderType } from '@vehicle-vault/shared';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMaintenanceRecordDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  serviceDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  odometer!: number;

  @IsEnum(MaintenanceCategory)
  category!: MaintenanceCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  workshopName!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalCost!: number;

  @IsOptional()
  @IsEnum(ReminderType)
  reminderType?: ReminderType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
