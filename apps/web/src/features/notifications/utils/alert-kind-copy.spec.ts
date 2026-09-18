import { ALERT_KINDS } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { ALERT_KIND_COPY, ALERT_KIND_GROUPS } from './alert-kind-copy';

describe('alert kind copy', () => {
  it('puts every kind in exactly one group, so none is missing from the page', () => {
    const grouped = ALERT_KIND_GROUPS.flatMap((group) => group.kinds);

    expect([...grouped].sort()).toEqual([...ALERT_KINDS].sort());
  });

  it('gives every kind a distinct label', () => {
    const labels = ALERT_KINDS.map((kind) => ALERT_KIND_COPY[kind].label);

    expect(new Set(labels).size).toBe(labels.length);
  });
});
