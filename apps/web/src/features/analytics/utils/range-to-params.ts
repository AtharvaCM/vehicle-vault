export type CostRangePreset = '30d' | '90d' | '6m' | '1y' | '2y' | 'all';

export type CostRangeParams = {
  from?: string;
  to?: string;
};

const MS_PER_DAY = 86_400_000;

function startOfUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Converts a range preset into `from`/`to` ISO strings. Both bounds are
 * normalised to a start-of-day UTC instant so the query key is identical for
 * every render within the same day. `to` is the last millisecond of today (UTC):
 * the API filters with `lte`, so today's entries stay in, and staying inside today
 * keeps the API's month bucketing from seeding an empty next-month point on the
 * last day of a month.
 */
export function rangeToParams(range: CostRangePreset, now = new Date()): CostRangeParams {
  if (range === 'all') {
    return {};
  }

  const today = startOfUtcDay(now);
  const to = new Date(today + MS_PER_DAY - 1);
  const from = new Date(today);

  switch (range) {
    case '30d':
      from.setUTCDate(from.getUTCDate() - 30);
      break;
    case '90d':
      from.setUTCDate(from.getUTCDate() - 90);
      break;
    case '6m':
      from.setUTCMonth(from.getUTCMonth() - 6);
      break;
    case '1y':
      from.setUTCFullYear(from.getUTCFullYear() - 1);
      break;
    case '2y':
      from.setUTCFullYear(from.getUTCFullYear() - 2);
      break;
  }

  return { from: from.toISOString(), to: to.toISOString() };
}
