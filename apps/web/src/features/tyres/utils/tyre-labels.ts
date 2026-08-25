import { TyrePosition, type TyreConditionLevel } from '@vehicle-vault/shared';

export const POSITION_LABEL: Record<TyrePosition, string> = {
  [TyrePosition.FrontLeft]: 'Front left',
  [TyrePosition.FrontRight]: 'Front right',
  [TyrePosition.RearLeft]: 'Rear left',
  [TyrePosition.RearRight]: 'Rear right',
  [TyrePosition.Spare]: 'Spare',
};

export const CONDITION_LABEL: Record<TyreConditionLevel, string> = {
  illegal: 'Not roadworthy',
  replace: 'Replace',
  warn: 'Wearing',
  healthy: 'Healthy',
  unknown: 'Not measured',
};
