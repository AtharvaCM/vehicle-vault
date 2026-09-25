import { REMINDER_SNOOZE_PERIODS, type ReminderSnoozePeriod } from '@vehicle-vault/shared';
import { IsIn, IsOptional, Matches } from 'class-validator';

/**
 * How far to snooze: a `period` (`week` or `month`) or `until` a day
 * (`YYYY-MM-DD`). An empty body snoozes a week, as the endpoint always has.
 * Sending both is refused by the service's schema check.
 */
export class SnoozeReminderDto {
  @IsOptional()
  @IsIn(REMINDER_SNOOZE_PERIODS)
  period?: ReminderSnoozePeriod;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'until must be a YYYY-MM-DD day' })
  until?: string;
}
