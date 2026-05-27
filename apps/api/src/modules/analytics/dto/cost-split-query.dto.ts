import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CostSplitQueryDto {
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
