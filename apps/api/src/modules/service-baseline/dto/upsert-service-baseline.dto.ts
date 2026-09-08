import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceCategory, ServiceBaselineStatus } from '@vehicle-vault/shared';

/**
 * Swagger shape only — `ServiceBaselineUpsertSchema` is what actually validates,
 * including the rule tying `status` to whether a figure is present.
 */
export class ServiceBaselineEntryDto {
  @ApiProperty({ enum: MaintenanceCategory })
  category!: MaintenanceCategory;

  @ApiProperty({
    enum: ServiceBaselineStatus,
    description:
      '`known` requires lastDoneOdometer or lastDoneDate; `unknown` requires neither.',
  })
  status!: ServiceBaselineStatus;

  @ApiPropertyOptional({ nullable: true })
  lastDoneOdometer?: number | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  lastDoneDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;
}

export class UpsertServiceBaselineDto {
  @ApiProperty({
    type: [ServiceBaselineEntryDto],
    description: 'Categories not listed are left untouched.',
  })
  entries!: ServiceBaselineEntryDto[];
}
