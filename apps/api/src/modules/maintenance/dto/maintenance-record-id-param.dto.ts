import { IsString, MinLength } from 'class-validator';

export class MaintenanceRecordIdParamDto {
  @IsString()
  @MinLength(1)
  recordId!: string;
}
