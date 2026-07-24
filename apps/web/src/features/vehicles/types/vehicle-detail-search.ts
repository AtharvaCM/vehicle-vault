export const vehicleDetailTabs = [
  'overview',
  'maintenance',
  'specs',
  'reminders',
  'fuel',
  'tyres',
  'protection',
  'loans',
  'members',
  'activity',
] as const;

export type VehicleDetailTab = (typeof vehicleDetailTabs)[number];

export type VehicleDetailSearch = {
  tab?: VehicleDetailTab;
};

export const defaultVehicleDetailTab: VehicleDetailTab = 'overview';

export function normalizeVehicleDetailSearch(search: Record<string, unknown>): VehicleDetailSearch {
  const normalizedTab =
    typeof search.tab === 'string' && vehicleDetailTabs.includes(search.tab as VehicleDetailTab)
      ? (search.tab as VehicleDetailTab)
      : undefined;

  return {
    ...(normalizedTab && normalizedTab !== defaultVehicleDetailTab ? { tab: normalizedTab } : {}),
  };
}
