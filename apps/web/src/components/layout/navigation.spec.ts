import { describe, expect, it } from 'vitest';

import { primaryNavigation, sectionForPath } from './navigation';
import { initialsOf } from './use-sign-out';

describe('primaryNavigation', () => {
  it('is Home · Garage · Upcoming · History · Costs, with no account items', () => {
    expect(primaryNavigation.map((item) => [item.label, item.to])).toEqual([
      ['Home', '/home'],
      ['Garage', '/garage'],
      ['Upcoming', '/upcoming'],
      ['History', '/history'],
      ['Costs', '/costs'],
    ]);
  });
});

describe('sectionForPath', () => {
  it.each([
    ['/home', 'home'],
    ['/garage', 'garage'],
    ['/vehicles/new', 'garage'],
    ['/vehicles/v1', 'garage'],
    ['/vehicles/v1/edit', 'garage'],
    ['/vehicles/v1/documents/insurance/d1', 'garage'],
    ['/maintenance-records/r1', 'garage'],
    ['/reminders/r1/edit', 'garage'],
    ['/upcoming', 'upcoming'],
    ['/history', 'history'],
    ['/costs', 'costs'],
    ['/settings', null],
    ['/settings/preferences', null],
    ['/admin/users', null],
  ])('puts %s under %s', (pathname, section) => {
    expect(sectionForPath(pathname)).toBe(section);
  });
});

describe('initialsOf', () => {
  it.each([
    ['Asha Kulkarni', 'AK'],
    ['Asha Rao Kulkarni', 'AK'],
    ['asha', 'A'],
    ['  ', '?'],
    [undefined, '?'],
  ])('%s → %s', (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});
