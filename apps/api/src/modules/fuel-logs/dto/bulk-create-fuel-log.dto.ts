import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateFuelLogDto } from './create-fuel-log.dto';

export class BulkCreateFuelLogDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFuelLogDto)
  logs: CreateFuelLogDto[];
}
