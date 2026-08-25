import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTyreInspectionDto {
  @IsUUID()
  tyreId!: string;

  @IsDateString()
  inspectedAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometer!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(30)
  treadDepthMm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(120)
  pressurePsi?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
