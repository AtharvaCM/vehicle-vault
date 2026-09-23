import { EMPTY } from './empty';
import { dayMonthInContext, daysUntil, toValidDate, type DateInput } from './date';

function dayCount(days: number) {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export type RelativeDueOptions = {
  /**
   * `due`: something to do by the date ("3 days late", "Today", "In 4 days").
   * `ends`: something valid until the date ("153 days left", "Ends today", "Ended 20 Sep").
   */
  mode?: 'due' | 'ends';
  now?: Date;
  /**
   * Days already counted elsewhere (the API's attention queue counts UTC days),
   * so the words cannot disagree with the bucket the row sits in.
   */
  days?: number | null;
};

/** When something is due or runs out, in words that give the time. "—" when there is no date. */
export function relativeDue(
  target: DateInput,
  { mode = 'due', now = new Date(), days }: RelativeDueOptions = {},
) {
  const parsed = toValidDate(target);
  const count = days ?? daysUntil(parsed, now);

  if (count === null) return EMPTY;

  if (mode === 'ends') {
    if (count > 0) return `${dayCount(count)} left`;
    if (count === 0) return 'Ends today';

    return parsed ? `Ended ${dayMonthInContext(parsed, now)}` : `Ended ${dayCount(-count)} ago`;
  }

  if (count < 0) return `${dayCount(-count)} late`;
  if (count === 0) return 'Today';
  if (count === 1) return 'Tomorrow';

  return `In ${dayCount(count)}`;
}
