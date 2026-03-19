import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReminderStatus } from '@vehicle-vault/shared';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListRemindersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @Type(() => String)
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;
}
