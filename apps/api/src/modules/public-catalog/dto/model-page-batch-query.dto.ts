import { PUBLIC_CATALOG_MODEL_PAGE_BATCH_MAX } from '@vehicle-vault/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ModelPageBatchQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PUBLIC_CATALOG_MODEL_PAGE_BATCH_MAX)
  pageSize?: number;
}
