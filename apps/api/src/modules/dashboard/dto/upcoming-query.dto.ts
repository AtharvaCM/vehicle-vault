import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { UPCOMING_KIND_FILTERS, type UpcomingKindFilter } from '@vehicle-vault/shared';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** `page` and `limit` page the `later` group only. */
export class UpcomingQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsIn(UPCOMING_KIND_FILTERS)
  kind?: UpcomingKindFilter;
}
