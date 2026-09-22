import { requiresPuc, type FuelType } from '@vehicle-vault/shared';

import { fmtDate } from './pdf-utils';

/** One line of the resale report's checklist: the document, whether it is in hand, a note. */
export type ChecklistLine = [label: string, ready: boolean, note: string];

type DocumentChecklistInput = {
  fuelType: FuelType;
  /** The insurance policy covering today, if there is one. */
  activePolicy: { endDate: Date } | undefined;
  loanCount: number;
  activeLoanCount: number;
};

/** The papers that change hands with the vehicle, and what is still to be sorted out. */
export function documentChecklist(input: DocumentChecklistInput): ChecklistLine[] {
  const { fuelType, activePolicy, loanCount, activeLoanCount } = input;
  const loanClosed = loanCount > 0 && activeLoanCount === 0;

  return [
    ['Registration certificate (RC)', true, 'Required for transfer'],
    [
      'Active insurance policy',
      !!activePolicy,
      activePolicy ? `Valid until ${fmtDate(activePolicy.endDate)}` : 'Renew before transfer',
    ],
    [
      'Pollution under control (PUC)',
      true,
      // An electric vehicle is exempt, so there is no certificate to hand over.
      requiresPuc(fuelType) ? 'Provide latest certificate' : 'Not applicable — electric vehicle',
    ],
    [
      'Loan NOC',
      loanClosed,
      loanCount === 0
        ? 'Not applicable — no loan on file'
        : loanClosed
          ? 'Available — loan closed'
          : 'Required after loan settlement',
    ],
  ];
}
