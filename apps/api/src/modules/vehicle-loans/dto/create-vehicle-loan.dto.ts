import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVehicleLoanDto {
  @IsString()
  @MaxLength(120)
  lender!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  accountNumber?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  principal!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(600)
  tenureMonths!: number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
