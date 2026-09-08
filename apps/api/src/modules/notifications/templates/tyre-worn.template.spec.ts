import { TyrePosition } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import type { TyreWornPayload } from '../types';
import { TyreWornTemplate } from './tyre-worn.template';

const template = new TyreWornTemplate();

const payload: TyreWornPayload = {
  vehicleId: 'vehicle-1',
  tyreId: 'tyre-1',
  position: TyrePosition.FrontLeft,
  level: 'replace',
  summary: '2.4 mm tread — wet grip is significantly reduced below 3 mm.',
  treadDepthMm: 2.4,
};

describe('TyreWornTemplate', () => {
  it('collapses repeat measurements at the same grade onto one dedup key', () => {
    // The cron re-grades every morning; without this the same 2.4 mm reading
    // raises a fresh unread alert each day.
    const first = template.dedupKey(payload);
    const second = template.dedupKey({ ...payload, treadDepthMm: 2.2 });

    expect(first).toBe('tyre-worn:tyre-1:replace');
    expect(second).toBe(first);
  });

  it('lets a tyre crossing into the legal limit through as a new alert', () => {
    expect(template.dedupKey({ ...payload, level: 'illegal' })).not.toBe(
      template.dedupKey(payload),
    );
  });

  it('keys per tyre so one bald corner does not mute the others', () => {
    expect(template.dedupKey({ ...payload, tyreId: 'tyre-2' })).not.toBe(
      template.dedupKey(payload),
    );
  });

  it('names the corner and carries the resolver’s own justification', () => {
    const rendered = template.render(payload);

    expect(rendered.title).toBe('Replace Tyre: Front left');
    expect(rendered.message).toContain('Front left tyre:');
    expect(rendered.message).toContain('wet grip is significantly reduced');
    expect(rendered.message).toContain('Book a replacement.');
    expect(rendered.link).toBe('/vehicles/vehicle-1?tab=tyres');
  });

  it('raises an illegal tyre as an error, not another service reminder', () => {
    // Roadworthiness is a different class of statement from "due for service"
    // and must not arrive looking like one.
    const rendered = template.render({
      ...payload,
      level: 'illegal',
      summary: '1.4 mm tread — below the 1.6 mm legal minimum. Not roadworthy.',
      treadDepthMm: 1.4,
    });

    expect(rendered.type).toBe('error');
    expect(rendered.title).toBe('Tyre Not Roadworthy: Front left');
    expect(rendered.message).toContain('Replace it before driving further.');
  });

  it('keeps the earliest warning low-urgency', () => {
    expect(template.render({ ...payload, level: 'warn' }).type).toBe('info');
  });

  it('renders every position and stays inside the 120-char title column', () => {
    for (const position of Object.values(TyrePosition)) {
      const rendered = template.render({ ...payload, position, level: 'illegal' });

      expect(rendered.title.length).toBeLessThanOrEqual(120);
      expect(rendered.title).not.toContain('undefined');
    }
  });
});
