import { FuelType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { documentChecklist } from './document-checklist';

describe('resale report document checklist', () => {
  it('lists what a buyer is handed, from what is on file', () => {
    expect(
      documentChecklist({
        fuelType: FuelType.Petrol,
        activePolicy: { endDate: new Date('2027-03-01T00:00:00.000Z') },
        loanCount: 1,
        activeLoanCount: 0,
      }),
    ).toEqual([
      ['Registration certificate (RC)', true, 'Required for transfer'],
      ['Active insurance policy', true, 'Valid until 2027-03-01'],
      ['Pollution under control (PUC)', true, 'Provide latest certificate'],
      ['Loan NOC', true, 'Available — loan closed'],
    ]);
  });

  it('does not ask the seller of an electric vehicle for a PUC certificate', () => {
    const checklist = documentChecklist({
      fuelType: FuelType.Electric,
      activePolicy: undefined,
      loanCount: 0,
      activeLoanCount: 0,
    });

    expect(checklist).toContainEqual([
      'Pollution under control (PUC)',
      true,
      'Not applicable — electric vehicle',
    ]);
  });

  it('still asks for one from a hybrid, which burns fuel', () => {
    const checklist = documentChecklist({
      fuelType: FuelType.Hybrid,
      activePolicy: undefined,
      loanCount: 0,
      activeLoanCount: 0,
    });

    expect(checklist).toContainEqual([
      'Pollution under control (PUC)',
      true,
      'Provide latest certificate',
    ]);
  });
});
