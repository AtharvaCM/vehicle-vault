import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Mirrors AccessoryCreateSchema field for field. The global ValidationPipe runs
 * `forbidNonWhitelisted`, so a field missing here is rejected before the service
 * sees it; a field here but absent from the zod schema is silently dropped. The
 * two definitions have to move together.
 */
export class CreateAccessoryDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string | null;

  @IsDateString()
  purchaseDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @IsOptional()
  @IsDateString()
  fittedDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fittedOdometer?: number | null;

  @IsOptional()
  @IsDateString()
  removedDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  removedOdometer?: number | null;

  @IsOptional()
  @IsDateString()
  warrantyExpiresAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
