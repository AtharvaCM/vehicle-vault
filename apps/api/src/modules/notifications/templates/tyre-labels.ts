import { TyrePosition } from '@vehicle-vault/shared';

/**
 * Sentence-leading form, matching the wording the vehicle detail page uses, so a
 * notification and the tyre tab name the same corner the same way.
 */
const POSITION_LABELS: Record<TyrePosition, string> = {
  [TyrePosition.FrontLeft]: 'Front left',
  [TyrePosition.FrontRight]: 'Front right',
  [TyrePosition.RearLeft]: 'Rear left',
  [TyrePosition.RearRight]: 'Rear right',
  [TyrePosition.Spare]: 'Spare',
  [TyrePosition.Front]: 'Front',
  [TyrePosition.Rear]: 'Rear',
};

export function positionLabel(position: TyrePosition): string {
  return POSITION_LABELS[position] ?? 'Tyre';
}
