import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFuelLogDto {
  @IsDateString()
  date!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometer!: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price!: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  totalCost!: number;

  @IsOptional()
  @IsBoolean()
  isFullTank?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
