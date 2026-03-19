import { ReminderType } from '@vehicle-vault/shared';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
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
}
