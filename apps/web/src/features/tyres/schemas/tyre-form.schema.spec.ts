import { describe, expect, it } from 'vitest';

import {
  formatDotCode,
  hasReading,
  parseDotCode,
  tyreInspectionFormSchema,
} from './tyre-form.schema';

const NOW = new Date('2026-08-25T00:00:00.000Z');

describe('parseDotCode', () => {
  it('reads week and year from the four digits printed on the sidewall', () => {
    expect(parseDotCode('3624', NOW)).toEqual({ week: 36, year: 2024 });
  });

  it('resolves a two-digit year that would otherwise land in the future', () => {
    // "99" in 2026 is 1999, not 2099 — a tyre cannot be made after today.
    expect(parseDotCode('0199', NOW)).toEqual({ week: 1, year: 1999 });
  });

  it('accepts the last week of a year', () => {
    expect(parseDotCode('5321', NOW)).toEqual({ week: 53, year: 2021 });
  });

  it('rejects an impossible week', () => {
    expect(parseDotCode('0024', NOW)).toBeNull();
    expect(parseDotCode('5424', NOW)).toBeNull();
  });

  it('rejects anything that is not four digits', () => {
    expect(parseDotCode('362', NOW)).toBeNull();
    expect(parseDotCode('36244', NOW)).toBeNull();
    expect(parseDotCode('ab24', NOW)).toBeNull();
    expect(parseDotCode('', NOW)).toBeNull();
    expect(parseDotCode(undefined, NOW)).toBeNull();
  });

  it('round-trips through formatDotCode', () => {
    expect(formatDotCode(36, 2024)).toBe('3624');
    // Single-digit weeks keep their leading zero, as stamped.
    expect(formatDotCode(1, 2021)).toBe('0121');
    expect(formatDotCode(null, 2024)).toBe('');
  });
});

describe('tyreInspectionFormSchema', () => {
  const base = {
    inspectedAt: '2026-08-25',
    odometer: 41_000,
    notes: '',
  };

  it('rejects a walk-around where nothing was measured', () => {
    const result = tyreInspectionFormSchema.safeParse({
      ...base,
      readings: [
        { tyreId: 'a', treadDepthMm: undefined, pressurePsi: undefined },
        { tyreId: 'b', treadDepthMm: undefined, pressurePsi: undefined },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('accepts a partial walk-around where only one corner was measured', () => {
    const result = tyreInspectionFormSchema.safeParse({
      ...base,
      readings: [
        { tyreId: 'a', treadDepthMm: 6.5, pressurePsi: undefined },
        { tyreId: 'b', treadDepthMm: undefined, pressurePsi: undefined },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts a pressure-only reading', () => {
    const result = tyreInspectionFormSchema.safeParse({
      ...base,
      readings: [{ tyreId: 'a', treadDepthMm: undefined, pressurePsi: 33 }],
    });

    expect(result.success).toBe(true);
  });

  it('treats a zero tread reading as measured, not as blank', () => {
    // 0 mm is a real and alarming measurement; it must not be filtered out.
    expect(hasReading({ tyreId: 'a', treadDepthMm: 0, pressurePsi: undefined })).toBe(true);
    expect(hasReading({ tyreId: 'a', treadDepthMm: undefined, pressurePsi: undefined })).toBe(
      false,
    );
  });

  it('rejects readings outside physically plausible ranges', () => {
    expect(
      tyreInspectionFormSchema.safeParse({
        ...base,
        readings: [{ tyreId: 'a', treadDepthMm: 45, pressurePsi: undefined }],
      }).success,
    ).toBe(false);

    expect(
      tyreInspectionFormSchema.safeParse({
        ...base,
        readings: [{ tyreId: 'a', treadDepthMm: undefined, pressurePsi: 500 }],
      }).success,
    ).toBe(false);
  });
});
