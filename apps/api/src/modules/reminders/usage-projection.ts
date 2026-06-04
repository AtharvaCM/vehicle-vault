/**
 * Estimates how fast a vehicle is being driven from its fuel-log
 * odometer history, then projects when a future km-based reminder
 * (`dueOdometer`) will be reached.
 *
 * Strategy:
 * - Look at fuel logs within the past `windowDays` days (default 180).
 * - km/day = (last odometer − first odometer) / (last date − first date).
 * - Confidence is high when ≥ 6 samples span ≥ 90 days, medium for
 *   ≥ 3 samples / ≥ 30 days, low otherwise. No fuel logs → no projection.
 * - Projection date = now + (dueOdometer − currentOdometer) / kmPerDay.
 *   Already-passed odometers return now (caller treats as overdue).
 */

export interface UsageSample {
  date: Date;
  odometer: number;
}

export type UsageConfidence = 'high' | 'medium' | 'low';

export interface UsageCadence {
  kmPerDay: number;
  sampleCount: number;
  sampleDays: number;
  confidence: UsageConfidence;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeUsageCadence(
  samples: UsageSample[],
  asOf: Date = new Date(),
  windowDays = 180,
): UsageCadence | null {
  if (samples.length < 2) return null;

  const windowStart = asOf.getTime() - windowDays * MS_PER_DAY;
  const recent = samples
    .filter((s) => s.date.getTime() >= windowStart && s.date.getTime() <= asOf.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (recent.length < 2) return null;

  const first = recent[0]!;
  const last = recent[recent.length - 1]!;
  const odometerDelta = last.odometer - first.odometer;
  const dayDelta = (last.date.getTime() - first.date.getTime()) / MS_PER_DAY;

  if (dayDelta <= 0 || odometerDelta <= 0) return null;

  const kmPerDay = odometerDelta / dayDelta;
  const sampleCount = recent.length;
  const sampleDays = Math.round(dayDelta);

  const confidence: UsageConfidence =
    sampleCount >= 6 && sampleDays >= 90
      ? 'high'
      : sampleCount >= 3 && sampleDays >= 30
        ? 'medium'
        : 'low';

  return { kmPerDay, sampleCount, sampleDays, confidence };
}

export function projectDueDate(
  currentOdometer: number,
  dueOdometer: number,
  cadence: UsageCadence,
  asOf: Date = new Date(),
): Date {
  const remaining = dueOdometer - currentOdometer;
  if (remaining <= 0) return asOf;
  const days = remaining / cadence.kmPerDay;
  return new Date(asOf.getTime() + days * MS_PER_DAY);
}
