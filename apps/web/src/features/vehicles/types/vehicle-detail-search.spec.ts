import { describe, expect, it } from 'vitest';

import {
  legacyVehicleDetailRedirect,
  legacyVehicleDetailTabs,
  normalizeVehicleDetailSearch,
} from './vehicle-detail-search';

describe('normalizeVehicleDetailSearch', () => {
  it('keeps each of the five tabs, leaving the default out of the URL', () => {
    expect(normalizeVehicleDetailSearch({ tab: 'overview' })).toEqual({});
    expect(normalizeVehicleDetailSearch({ tab: 'history' })).toEqual({ tab: 'history' });
    expect(normalizeVehicleDetailSearch({ tab: 'reminders' })).toEqual({ tab: 'reminders' });
    expect(normalizeVehicleDetailSearch({ tab: 'papers' })).toEqual({ tab: 'papers' });
    expect(normalizeVehicleDetailSearch({ tab: 'more' })).toEqual({ tab: 'more' });
  });

  it("keeps History's fuel view and drops the default service view", () => {
    expect(normalizeVehicleDetailSearch({ tab: 'history', view: 'fuel' })).toEqual({
      tab: 'history',
      view: 'fuel',
    });
    expect(normalizeVehicleDetailSearch({ tab: 'history', view: 'service' })).toEqual({
      tab: 'history',
    });
  });

  it('keeps a search on the service log only, and drops it on every other tab or view', () => {
    expect(normalizeVehicleDetailSearch({ tab: 'history', search: ' oil ' })).toEqual({
      tab: 'history',
      search: 'oil',
    });
    expect(normalizeVehicleDetailSearch({ tab: 'history', view: 'fuel', search: 'oil' })).toEqual({
      tab: 'history',
      view: 'fuel',
    });
    expect(normalizeVehicleDetailSearch({ tab: 'reminders', search: 'oil' })).toEqual({
      tab: 'reminders',
    });
    expect(normalizeVehicleDetailSearch({ tab: 'history', search: '  ' })).toEqual({
      tab: 'history',
    });
  });

  it('keeps a More section so a deep link survives a reload', () => {
    expect(normalizeVehicleDetailSearch({ tab: 'more', section: 'accessories' })).toEqual({
      tab: 'more',
      section: 'accessories',
    });
  });

  it('drops a view or section that belongs to another tab', () => {
    expect(normalizeVehicleDetailSearch({ tab: 'papers', view: 'fuel' })).toEqual({
      tab: 'papers',
    });
    expect(normalizeVehicleDetailSearch({ tab: 'history', section: 'tyres' })).toEqual({
      tab: 'history',
    });
    expect(normalizeVehicleDetailSearch({ view: 'fuel', section: 'tyres' })).toEqual({});
  });

  it('drops unsupported values', () => {
    expect(normalizeVehicleDetailSearch({ tab: 'unknown' })).toEqual({});
    expect(normalizeVehicleDetailSearch({ tab: 'history', view: 'odometer' })).toEqual({
      tab: 'history',
    });
    expect(normalizeVehicleDetailSearch({ tab: 'more', section: 'papers' })).toEqual({
      tab: 'more',
    });
    expect(normalizeVehicleDetailSearch({ tab: 'toString' })).toEqual({});
  });
});

describe('the eleven old tab values', () => {
  const cases = [
    ['overview', {}],
    ['maintenance', { tab: 'history' }],
    ['fuel', { tab: 'history', view: 'fuel' }],
    ['reminders', { tab: 'reminders' }],
    ['protection', { tab: 'papers' }],
    ['specs', { tab: 'more', section: 'specs' }],
    ['tyres', { tab: 'more', section: 'tyres' }],
    ['accessories', { tab: 'more', section: 'accessories' }],
    ['loans', { tab: 'more', section: 'loans' }],
    ['members', { tab: 'more', section: 'members' }],
    ['activity', { tab: 'more', section: 'activity' }],
  ] as const;

  it('covers every old value', () => {
    expect(cases.map(([tab]) => tab).sort()).toEqual(Object.keys(legacyVehicleDetailTabs).sort());
  });

  it.each(cases)('?tab=%s opens %j', (tab, expected) => {
    expect(normalizeVehicleDetailSearch({ tab })).toEqual(expected);
  });

  it.each(cases.filter(([tab]) => tab !== 'overview' && tab !== 'reminders'))(
    '?tab=%s redirects to its new address',
    (tab, expected) => {
      expect(legacyVehicleDetailRedirect({ tab })).toEqual(expected);
    },
  );

  it('does not redirect values that kept their name', () => {
    expect(legacyVehicleDetailRedirect({ tab: 'overview' })).toBeNull();
    expect(legacyVehicleDetailRedirect({ tab: 'reminders' })).toBeNull();
    expect(legacyVehicleDetailRedirect({ tab: 'history', view: 'fuel' })).toBeNull();
    expect(legacyVehicleDetailRedirect({})).toBeNull();
    expect(legacyVehicleDetailRedirect({ tab: 'unknown' })).toBeNull();
  });
});
