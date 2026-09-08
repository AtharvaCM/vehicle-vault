import { describe, expect, it } from 'vitest';

import { ALERT_TEMPLATE_PROVIDERS } from './notifications.module';
import { ALERT_KINDS, type AlertKind } from './types';

/**
 * The registration gap this guards is invisible until it matters: an unregistered
 * kind throws inside `NotifyService.raise`, the cron catches it per vehicle and
 * logs, and the only symptom is an alert that never arrives.
 *
 * Every template takes no constructor arguments, so they can be instantiated
 * here without standing up the Nest container.
 */
const registered = ALERT_TEMPLATE_PROVIDERS.map((Template) => new Template().kind);

describe('alert template registration', () => {
  it.each(ALERT_KINDS)('has a template registered for %s', (kind: AlertKind) => {
    expect(registered).toContain(kind);
  });

  it('registers no template for a kind that does not exist', () => {
    expect([...registered].sort()).toEqual([...ALERT_KINDS].sort());
  });

  it('registers each kind exactly once', () => {
    // Two templates claiming one kind is a silent override: the Map in
    // NotifyService keeps whichever was constructed last.
    expect(new Set(registered).size).toBe(registered.length);
  });
});
