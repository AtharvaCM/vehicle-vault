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
import { CreateFuelLogDto } from './create-fuel-log.dto';

export class UpdateFuelLogDto implements Partial<CreateFuelLogDto> {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometer?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  totalCost?: number;

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
