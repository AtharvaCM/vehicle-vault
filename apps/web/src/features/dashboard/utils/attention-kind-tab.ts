import type { VehicleDetailSearch } from '@/features/vehicles/types/vehicle-detail-search';

import type { DashboardAttentionKind } from '../types/dashboard';

/**
 * The vehicle tab search that fixes each kind of attention row — the same
 * place its alert links to. A reminder has a page of its own instead.
 */
export const ATTENTION_KIND_SEARCH: Record<
  Exclude<DashboardAttentionKind, 'reminder'>,
  VehicleDetailSearch
> = {
  document: { tab: 'papers' },
  loan_emi: { tab: 'more', section: 'loans' },
  tyre: { tab: 'more', section: 'tyres' },
  service_baseline: { tab: 'history' },
  accessory: { tab: 'more', section: 'accessories' },
};
