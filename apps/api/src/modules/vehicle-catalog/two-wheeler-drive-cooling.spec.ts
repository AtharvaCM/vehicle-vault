import { describe, expect, it } from 'vitest';

import { curatedDriveCooling, missingDriveCooling } from './two-wheeler-drive-cooling';

const bike = (
  make: string,
  model: string,
  bodyType: string | null = null,
  transmission = '5 Speed Manual',
) => ({
  make,
  model,
  bodyType,
  transmission,
});

describe('curatedDriveCooling', () => {
  it('reads a Royal Enfield Classic 350 as chain-driven and not liquid-cooled', () => {
    expect(curatedDriveCooling(bike('Royal Enfield', 'Classic 350'))).toEqual({
      driveType: 'chain',
    });
  });

  it('never gives a scooter chain drive, by body type, transmission or name', () => {
    expect(curatedDriveCooling(bike('TVS', 'Jupiter', null, 'Automatic')).driveType).toBe('belt');
    expect(curatedDriveCooling(bike('Honda', 'Activa 6G')).driveType).toBe('belt');
    expect(curatedDriveCooling(bike('Suzuki', 'Burgman Street', 'Scooter')).driveType).toBe('belt');
    expect(curatedDriveCooling(bike('Yamaha', 'Fascino 125', null, 'CVT')).driveType).toBe('belt');
  });

  it('marks the common liquid-cooled motorcycles, and only those', () => {
    expect(curatedDriveCooling(bike('KTM', '390 Duke'))).toEqual({
      driveType: 'chain',
      coolingType: 'liquid-cooled',
    });
    expect(curatedDriveCooling(bike('Yamaha', 'R15 V4')).coolingType).toBe('liquid-cooled');
    expect(curatedDriveCooling(bike('Bajaj', 'Pulsar NS200')).coolingType).toBe('liquid-cooled');
    expect(curatedDriveCooling(bike('Honda', 'Shine 125')).coolingType).toBeUndefined();
    expect(
      curatedDriveCooling(bike('Royal Enfield', 'Interceptor 650')).coolingType,
    ).toBeUndefined();
  });

  it('knows the shaft- and belt-driven exceptions', () => {
    expect(curatedDriveCooling(bike('BMW', 'R 1250 GS')).driveType).toBe('shaft');
    expect(curatedDriveCooling(bike('BMW', 'G 310 R')).driveType).toBe('chain');
    expect(curatedDriveCooling(bike('Harley-Davidson', 'Nightster')).driveType).toBe('belt');
    expect(curatedDriveCooling(bike('Harley-Davidson', 'X440')).driveType).toBe('chain');
  });
});

describe('missingDriveCooling', () => {
  it('fills only what the spec row lacks, so the source wins and a rerun is a no-op', () => {
    const curated = { driveType: 'chain', coolingType: 'liquid-cooled' } as const;

    expect(missingDriveCooling(null, curated)).toEqual(curated);
    expect(missingDriveCooling({ driveType: 'belt', coolingType: null }, curated)).toEqual({
      coolingType: 'liquid-cooled',
    });
    expect(
      missingDriveCooling({ driveType: 'chain', coolingType: 'liquid-cooled' }, curated),
    ).toEqual({});
  });
});
