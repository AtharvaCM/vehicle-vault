import { normalizeHistorySearchText } from '@/features/history/types/history-search';

export const vehicleDetailTabs = ['overview', 'history', 'reminders', 'papers', 'more'] as const;

export type VehicleDetailTab = (typeof vehicleDetailTabs)[number];

/** History shows one log at a time: services, fuel, or accessories (#336). */
export const vehicleHistoryViews = ['service', 'fuel', 'accessory'] as const;

export type VehicleHistoryView = (typeof vehicleHistoryViews)[number];

/** The sections the More tab lists, each opened on its own. */
export const vehicleMoreSections = ['about', 'tyres', 'loans', 'members', 'activity'] as const;

export type VehicleMoreSection = (typeof vehicleMoreSections)[number];

export type VehicleDetailSearch = {
  tab?: VehicleDetailTab;
  /** Only with `tab: 'history'`; the service log when absent. */
  view?: VehicleHistoryView;
  /** Only on the service and accessory logs: words to find, as on the History page. */
  search?: string;
  /** Only with `tab: 'more'`; the list of sections when absent. */
  section?: VehicleMoreSection;
};

export const defaultVehicleDetailTab: VehicleDetailTab = 'overview';
export const defaultVehicleHistoryView: VehicleHistoryView = 'service';

/**
 * The eleven tabs the vehicle page had before it was cut to five, and where
 * each one lives now. Links written before the change (alerts already sent,
 * bookmarks, the API's notification templates) still carry these.
 */
export const legacyVehicleDetailTabs = {
  overview: {},
  maintenance: { tab: 'history' },
  fuel: { tab: 'history', view: 'fuel' },
  reminders: { tab: 'reminders' },
  protection: { tab: 'papers' },
  specs: { tab: 'more', section: 'about' },
  tyres: { tab: 'more', section: 'tyres' },
  accessories: { tab: 'history', view: 'accessory' },
  loans: { tab: 'more', section: 'loans' },
  members: { tab: 'more', section: 'members' },
  activity: { tab: 'more', section: 'activity' },
} as const satisfies Record<string, VehicleDetailSearch>;

export type LegacyVehicleDetailTab = keyof typeof legacyVehicleDetailTabs;

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/**
 * Where an old `?tab=` value now lives, or null when the search is already in
 * the current shape. `reminders` and `overview` are both, so they are not
 * legacy: only values that changed meaning are.
 */
export function legacyVehicleDetailRedirect(
  search: Record<string, unknown>,
): VehicleDetailSearch | null {
  const { tab } = search;
  if (typeof tab !== 'string' || isOneOf(vehicleDetailTabs, tab)) return null;
  if (!Object.hasOwn(legacyVehicleDetailTabs, tab)) return null;

  return legacyVehicleDetailTabs[tab as LegacyVehicleDetailTab];
}

export function normalizeVehicleDetailSearch(search: Record<string, unknown>): VehicleDetailSearch {
  const legacy = legacyVehicleDetailRedirect(search);
  const source: Record<string, unknown> = legacy ?? search;
  const tab = isOneOf(vehicleDetailTabs, source.tab) ? source.tab : undefined;

  if (tab === 'history') {
    const view = isOneOf(vehicleHistoryViews, source.view) ? source.view : undefined;
    const search =
      (view ?? defaultVehicleHistoryView) === 'fuel'
        ? undefined
        : normalizeHistorySearchText(source.search);
    return {
      tab,
      ...(view && view !== defaultVehicleHistoryView ? { view } : {}),
      ...(search ? { search } : {}),
    };
  }

  if (tab === 'more' && source.section === 'accessories') {
    // Accessories left More for History (#336); links to the old section follow.
    return { tab: 'history', view: 'accessory' };
  }

  if (tab === 'more') {
    // Tech specs became About this vehicle (#319); links to the old section
    // still open it.
    const requested = source.section === 'specs' ? 'about' : source.section;
    const section = isOneOf(vehicleMoreSections, requested) ? requested : undefined;
    return { tab, ...(section ? { section } : {}) };
  }

  return tab && tab !== defaultVehicleDetailTab ? { tab } : {};
}
