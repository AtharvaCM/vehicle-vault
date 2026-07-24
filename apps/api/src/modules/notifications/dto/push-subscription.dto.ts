import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  auth!: string;
}

export class SubscribePushDto {
  @IsUrl({ require_tld: false, protocols: ['https'] })
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  userAgent?: string;
}

export class UnsubscribePushDto {
  @IsUrl({ require_tld: false, protocols: ['https'] })
  endpoint!: string;
}
