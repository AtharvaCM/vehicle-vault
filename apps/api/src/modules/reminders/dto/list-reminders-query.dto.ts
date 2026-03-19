import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListRemindersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @Type(() => String)
  @IsIn(['due-soon', 'overdue'])
  status?: 'due-soon' | 'overdue';
}
