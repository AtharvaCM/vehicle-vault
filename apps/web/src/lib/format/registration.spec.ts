import { isValidRegistrationNumber } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import {
  formatRegistrationInput,
  parseRegistration,
  registration,
  spokenRegistration,
} from './registration';

describe('registration', () => {
  it('prints state · district · series · number', () => {
    expect(registration('MH12DM0002')).toBe('MH 12 DM 0002');
    expect(registration('KA 01 EV 2024')).toBe('KA 01 EV 2024');
  });

  it('reads unformatted input: lower case, no spaces, dashes, stray spaces', () => {
    expect(registration('mh12dm0002')).toBe('MH 12 DM 0002');
    expect(registration('MH-12-DM-0002')).toBe('MH 12 DM 0002');
    expect(registration('  mh 12dm   0002 ')).toBe('MH 12 DM 0002');
  });

  it('spaces a Bharat series plate as year · BH · number · series', () => {
    expect(registration('22BH1234AA')).toBe('22 BH 1234 AA');
    expect(registration('22 bh 1234 a')).toBe('22 BH 1234 A');
    expect(parseRegistration('22BH1234AA').kind).toBe('bh');
  });

  it('handles one-digit districts, three-letter series and no series', () => {
    expect(registration('DL3CAB1234')).toBe('DL 3 CAB 1234');
    expect(registration('MH121234')).toBe('MH 12 1234');
    expect(registration('GJ1A9')).toBe('GJ 1 A 9');
  });

  it('keeps anything that is not a plate as typed, upper-cased and tidied', () => {
    expect(registration('temp  reg 42')).toBe('TEMP REG 42');
    expect(parseRegistration('TEMP REG 42')).toEqual({ kind: 'unknown', groups: ['TEMP REG 42'] });
  });

  it('spaces a temporary registration as T · month+year · state · number · series', () => {
    expect(registration('T0724HR6123A')).toBe('T 0724 HR 6123 A');
    expect(registration('t0724hr6123ab')).toBe('T 0724 HR 6123 AB');
    expect(parseRegistration('T0724HR6123A').kind).toBe('temporary');
  });

  it('does not read a malformed temporary registration as one', () => {
    // Three digits for month+year, not four: no format recognises it.
    expect(parseRegistration('T072HR6123A')).toEqual({
      kind: 'unknown',
      groups: ['T072HR6123A'],
    });
  });

  it('shows a dash when there is no registration', () => {
    expect(registration('')).toBe('—');
    expect(registration(null)).toBe('—');
    expect(parseRegistration(undefined).groups).toEqual([]);
  });
});

describe('formatRegistrationInput', () => {
  it('groups a standard plate the instant the string typed so far completes it', () => {
    expect(formatRegistrationInput('mh12dm0002')).toBe('MH 12 DM 0002');
    expect(formatRegistrationInput('MH12DM0')).toBe('MH 12 DM 0');
    // No number digit yet: not a complete plate, so left ungrouped.
    expect(formatRegistrationInput('MH12DM')).toBe('MH12DM');
  });

  it('groups a Bharat series plate as year · BH · number · series', () => {
    expect(formatRegistrationInput('22bh1234aa')).toBe('22 BH 1234 AA');
    expect(formatRegistrationInput('22Bh1234A')).toBe('22 BH 1234 A');
  });

  it('groups a temporary registration as T · month+year · state · number · series', () => {
    expect(formatRegistrationInput('t0724hr6123a')).toBe('T 0724 HR 6123 A');
    // Not yet four digits after the T: left ungrouped, not read as standard.
    expect(formatRegistrationInput('t072')).toBe('T072');
  });

  it('upper-cases and strips punctuation while typing, whatever was typed', () => {
    expect(formatRegistrationInput('mh-12 dm/0002')).toBe('MH 12 DM 0002');
    expect(formatRegistrationInput('mh')).toBe('MH');
  });

  it('leaves unrecognisable input upper-cased and compact, not grouped', () => {
    expect(formatRegistrationInput('temp reg 42')).toBe('TEMPREG42');
    expect(formatRegistrationInput('')).toBe('');
  });

  it('stops taking characters past the longest recognised plate', () => {
    expect(formatRegistrationInput('ABCDEFGHIJKLMNOPQ')).toBe('ABCDEFGHIJKLM');
  });
});

describe('isValidRegistrationNumber (@vehicle-vault/shared)', () => {
  it('accepts a standard plate', () => {
    expect(isValidRegistrationNumber('MH12AB1234')).toBe(true);
  });

  it('accepts a Bharat series plate', () => {
    expect(isValidRegistrationNumber('22BH1234AA')).toBe(true);
  });

  it('accepts a temporary registration, a brand-new vehicle before its permanent plate', () => {
    expect(isValidRegistrationNumber('T0724HR6123A')).toBe(true);
    expect(isValidRegistrationNumber('t0724hr6123a')).toBe(true);
    expect(isValidRegistrationNumber('T0724HR6123AB')).toBe(true);
  });

  it('rejects a malformed temporary registration', () => {
    // Three digits for month+year, not four.
    expect(isValidRegistrationNumber('T072HR6123A')).toBe(false);
    // Three letters for the series, the format allows at most two.
    expect(isValidRegistrationNumber('T0724HR6123ABC')).toBe(false);
  });

  it('rejects anything that is not one of the three recognised formats', () => {
    expect(isValidRegistrationNumber('not a plate')).toBe(false);
    expect(isValidRegistrationNumber('')).toBe(false);
  });
});

describe('spokenRegistration', () => {
  it('spells each group, with a pause between groups', () => {
    expect(spokenRegistration('mh12dm0002')).toBe('M H, 1 2, D M, 0 0 0 2');
    expect(spokenRegistration('22BH1234AA')).toBe('2 2, B H, 1 2 3 4, A A');
  });

  it('reads an unrecognised number as typed', () => {
    expect(spokenRegistration('temp reg 42')).toBe('TEMP REG 42');
  });
});
