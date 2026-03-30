import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';

import { CreateMaintenanceRecordDto } from './create-maintenance-record.dto';

export class BulkCreateMaintenanceRecordDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMaintenanceRecordDto)
  records!: CreateMaintenanceRecordDto[];
}
