import { describe, expect, it } from 'vitest';

import { parseRegistration, registration, spokenRegistration } from './registration';

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

  it('shows a dash when there is no registration', () => {
    expect(registration('')).toBe('—');
    expect(registration(null)).toBe('—');
    expect(parseRegistration(undefined).groups).toEqual([]);
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
