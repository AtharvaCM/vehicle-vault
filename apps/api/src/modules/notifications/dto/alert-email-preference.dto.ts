import { IsBoolean } from 'class-validator';

export class UpdateAlertEmailPreferenceDto {
  /** True silences alert email; false turns it back on. */
  @IsBoolean()
  muted!: boolean;
}
