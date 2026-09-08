import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MaintenanceCategory, ServiceBaselineStatus } from '@vehicle-vault/shared';

/**
 * Structural validation only. The rule tying `status` to whether a figure is
 * present lives in `ServiceBaselineUpsertSchema`, which the service applies.
 *
 * The class-validator decorators are not decoration: the global pipe runs with
 * `whitelist` and `forbidNonWhitelisted`, so a property with no decorator is
 * rejected as unknown before the request ever reaches the service.
 */
export class ServiceBaselineEntryDto {
  @ApiProperty({ enum: MaintenanceCategory })
  @IsEnum(MaintenanceCategory)
  category!: MaintenanceCategory;

  @ApiProperty({
    enum: ServiceBaselineStatus,
    description: '`known` requires lastDoneOdometer or lastDoneDate; `unknown` requires neither.',
  })
  @IsEnum(ServiceBaselineStatus)
  status!: ServiceBaselineStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lastDoneOdometer?: number | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  lastDoneDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpsertServiceBaselineDto {
  @ApiProperty({
    type: [ServiceBaselineEntryDto],
    description: 'Categories not listed are left untouched.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ServiceBaselineEntryDto)
  entries!: ServiceBaselineEntryDto[];
}
