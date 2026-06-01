import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
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
import { LoanStatus } from '@vehicle-vault/shared';

export class UpdateVehicleLoanDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  accountNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  principal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(600)
  tenureMonths?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @IsOptional()
  @IsDateString()
  closedAt?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;
}
