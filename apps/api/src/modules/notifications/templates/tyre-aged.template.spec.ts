import { TyrePosition } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import type { TyreAgedPayload } from '../types';
import { TyreAgedTemplate } from './tyre-aged.template';

const template = new TyreAgedTemplate();

const payload: TyreAgedPayload = {
  vehicleId: 'vehicle-1',
  tyreId: 'tyre-1',
  position: TyrePosition.Spare,
  level: 'replace',
  summary: '6.4 years old — rubber degrades with age regardless of tread left.',
  ageYears: 6.4,
};

describe('TyreAgedTemplate', () => {
  it('holds one alert per grade as the tyre keeps ageing', () => {
    expect(template.dedupKey({ ...payload, ageYears: 7.1 })).toBe('tyre-aged:tyre-1:replace');
  });

  it('separates the first warning from the replacement grade', () => {
    expect(template.dedupKey({ ...payload, level: 'warn' })).not.toBe(template.dedupKey(payload));
  });

  it('says age alone is the trigger, since tread may look fine', () => {
    const rendered = template.render(payload);

    expect(rendered.title).toBe('Tyre Aged Out: Spare');
    expect(rendered.message).toContain('rubber degrades with age');
    expect(rendered.message).toContain('however much tread is left');
    expect(rendered.type).toBe('warning');
    expect(rendered.link).toBe('/vehicles/vehicle-1?tab=tyres');
  });

  it('asks for a sidewall check at the earlier grade', () => {
    const rendered = template.render({
      ...payload,
      level: 'warn',
      summary: '5.2 years old — inspect for cracking; most makers advise replacing by 6 years.',
      ageYears: 5.2,
    });

    expect(rendered.title).toBe('Tyre Ageing: Spare');
    expect(rendered.message).toContain('Check the sidewalls');
    expect(rendered.type).toBe('info');
  });
});
