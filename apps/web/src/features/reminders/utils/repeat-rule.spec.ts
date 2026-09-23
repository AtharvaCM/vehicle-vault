import { describe, expect, it } from 'vitest';

import { describeRepeatRule, toRepeatChoice, toRepeatRule } from './repeat-rule';

describe('repeat rule', () => {
  it('reads a stored rule back as the choice that made it', () => {
    expect(toRepeatChoice({})).toBe('none');
    expect(toRepeatChoice({ repeatEveryMonths: 6 })).toBe('six-months');
    expect(toRepeatChoice({ repeatEveryMonths: 12 })).toBe('yearly');
    expect(toRepeatChoice({ repeatEveryKm: 5000 })).toBe('distance');
    expect(toRepeatChoice({ repeatEveryMonths: 3 })).toBe('custom');
    expect(toRepeatChoice({ repeatEveryMonths: 12, repeatEveryKm: 10000 })).toBe('custom');
  });

  it('turns a choice into the rule, ignoring numbers a choice does not use', () => {
    const typed = { repeatEveryMonths: 3, repeatEveryKm: 8000 };

    expect(toRepeatRule('none', typed)).toEqual({ repeatEveryMonths: null, repeatEveryKm: null });
    expect(toRepeatRule('yearly', typed)).toEqual({ repeatEveryMonths: 12, repeatEveryKm: null });
    expect(toRepeatRule('distance', typed)).toEqual({
      repeatEveryMonths: null,
      repeatEveryKm: 8000,
    });
    expect(toRepeatRule('custom', typed)).toEqual(typed);
  });

  it('describes a rule in words', () => {
    expect(describeRepeatRule({})).toBe('Doesn’t repeat');
    expect(describeRepeatRule({ repeatEveryMonths: 12 })).toBe('Repeats every year');
    expect(describeRepeatRule({ repeatEveryMonths: 6 })).toBe('Repeats every 6 months');
    expect(describeRepeatRule({ repeatEveryMonths: 24 })).toBe('Repeats every 2 years');
    expect(describeRepeatRule({ repeatEveryKm: 500 })).toBe('Repeats every 500 km');
    expect(describeRepeatRule({ repeatEveryKm: 10000, repeatEveryMonths: 12 })).toBe(
      'Repeats every 10,000 km or 12 months, whichever comes first',
    );
  });
});
