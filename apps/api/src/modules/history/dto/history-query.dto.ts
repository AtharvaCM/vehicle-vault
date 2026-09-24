import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { HISTORY_KINDS, HISTORY_PAGE_MAX_LIMIT, type HistoryKind } from '@vehicle-vault/shared';

export class HistoryQueryDto {
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsIn(HISTORY_KINDS)
  kind?: HistoryKind;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(HISTORY_PAGE_MAX_LIMIT)
  limit?: number;
}
