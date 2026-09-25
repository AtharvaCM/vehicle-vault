import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  HISTORY_KINDS,
  HISTORY_PAGE_MAX_LIMIT,
  HISTORY_SEARCH_MAX_LENGTH,
  type HistoryKind,
} from '@vehicle-vault/shared';

export class HistoryQueryDto {
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsIn(HISTORY_KINDS)
  kind?: HistoryKind;

  /** Blank is no search: the box sends what is typed, spaces and all. */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : (value as unknown),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(HISTORY_SEARCH_MAX_LENGTH)
  search?: string;

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
