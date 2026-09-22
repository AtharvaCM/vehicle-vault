import type { VehicleDetailTab } from '@/features/vehicles/types/vehicle-detail-search';

import type { DashboardAttentionKind } from '../types/dashboard';

/**
 * The vehicle tab that fixes each kind of attention row — the same tab its
 * alert links to. A reminder has a page of its own instead.
 */
export const ATTENTION_KIND_TABS: Record<
  Exclude<DashboardAttentionKind, 'reminder'>,
  VehicleDetailTab
> = {
  document: 'protection',
  loan_emi: 'loans',
  tyre: 'tyres',
  service_baseline: 'maintenance',
  accessory: 'accessories',
};
