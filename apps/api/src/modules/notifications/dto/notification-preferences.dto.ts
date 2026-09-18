import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { ALERT_KINDS, type AlertKind } from '@vehicle-vault/shared';

class NotificationPreferenceDto {
  @IsIn(ALERT_KINDS)
  kind!: AlertKind;

  @IsBoolean()
  email!: boolean;

  @IsBoolean()
  push!: boolean;
}

export class UpdateNotificationPreferencesDto {
  /** The kinds to change; kinds left out keep their current setting. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ALERT_KINDS.length)
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceDto)
  preferences!: NotificationPreferenceDto[];
}
