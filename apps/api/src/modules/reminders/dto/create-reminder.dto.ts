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
  ValidateIf,
} from 'class-validator';

export class CreateReminderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsEnum(ReminderType)
  type!: ReminderType;

  @ValidateIf((value: CreateReminderDto) => value.dueOdometer === undefined)
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ValidateIf((value: CreateReminderDto) => value.dueDate === undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  @IsOptional()
  dueOdometer?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

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
