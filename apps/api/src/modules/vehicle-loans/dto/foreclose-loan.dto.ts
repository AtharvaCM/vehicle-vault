import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ForecloseLoanDto {
  @IsOptional()
  @IsDateString()
  closedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
