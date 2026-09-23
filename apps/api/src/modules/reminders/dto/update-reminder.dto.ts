import {
  REMINDER_REPEAT_MAX_KM,
  REMINDER_REPEAT_MAX_MONTHS,
  ReminderType,
} from '@vehicle-vault/shared';
import { Type } from 'class-transformer';
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

export class UpdateReminderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsEnum(ReminderType)
  type?: ReminderType;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  dueOdometer?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** Null stops it repeating on that dimension. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(REMINDER_REPEAT_MAX_MONTHS)
  repeatEveryMonths?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(REMINDER_REPEAT_MAX_KM)
  repeatEveryKm?: number | null;
}
