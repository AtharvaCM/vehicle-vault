import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TyrePosition } from '@vehicle-vault/shared';

export class CreateTyreDto {
  @IsEnum(TyrePosition)
  position!: TyrePosition;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  size?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  dotWeek?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1980)
  @Max(2100)
  dotYear?: number | null;

  @IsDateString()
  fittedDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  fittedOdometer!: number;

  @IsOptional()
  @IsDateString()
  removedDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  removedOdometer?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedLifeKm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
