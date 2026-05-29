export const queryKeys = {
  dashboard: {
    all: () => ['dashboard'] as const,
    summary: () => [...queryKeys.dashboard.all(), 'summary'] as const,
  },
  vehicles: {
    all: () => ['vehicles'] as const,
    list: () => [...queryKeys.vehicles.all(), 'list'] as const,
    detail: (vehicleId: string) => [...queryKeys.vehicles.all(), 'detail', vehicleId] as const,
    fuelLogs: (vehicleId: string) =>
      [...queryKeys.vehicles.detail(vehicleId), 'fuel-logs'] as const,
  },
  vehicleCatalog: {
    all: () => ['vehicleCatalog'] as const,
    importRuns: () => [...queryKeys.vehicleCatalog.all(), 'importRuns'] as const,
    importRunDetail: (runId: string) =>
      [...queryKeys.vehicleCatalog.all(), 'importRunDetail', runId] as const,
    makes: (marketCode: string, vehicleType: string, year?: number) =>
      [...queryKeys.vehicleCatalog.all(), 'makes', marketCode, vehicleType, year ?? 'any'] as const,
    models: (marketCode: string, vehicleType: string, make: string, year?: number) =>
      [
        ...queryKeys.vehicleCatalog.all(),
        'models',
        marketCode,
        vehicleType,
        make,
        year ?? 'any',
      ] as const,
    variants: (
      marketCode: string,
      vehicleType: string,
      make: string,
      model: string,
      year?: number,
    ) =>
      [
        ...queryKeys.vehicleCatalog.all(),
        'variants',
        marketCode,
        vehicleType,
        make,
        model,
        year ?? 'any',
      ] as const,
    variantSpecs: (make: string, model: string, variant: string) =>
      [...queryKeys.vehicleCatalog.all(), 'variantSpecs', make, model, variant] as const,
  },
  maintenance: {
    all: () => ['maintenance'] as const,
    global: () => [...queryKeys.maintenance.all(), 'global'] as const,
    list: (vehicleId: string) => [...queryKeys.maintenance.all(), 'list', vehicleId] as const,
    detail: (recordId: string) => [...queryKeys.maintenance.all(), 'detail', recordId] as const,
  },
  attachments: {
    all: () => ['attachments'] as const,
    extractionStatus: () => [...queryKeys.attachments.all(), 'extraction-status'] as const,
    byRecord: (recordId: string) => [...queryKeys.attachments.all(), 'record', recordId] as const,
    detail: (attachmentId: string) =>
      [...queryKeys.attachments.all(), 'detail', attachmentId] as const,
  },
  reminders: {
    all: () => ['reminders'] as const,
    list: () => [...queryKeys.reminders.all(), 'list'] as const,
    byVehicle: (vehicleId: string) => [...queryKeys.reminders.all(), 'vehicle', vehicleId] as const,
    detail: (reminderId: string) => [...queryKeys.reminders.all(), 'detail', reminderId] as const,
  },
  vehicleDocuments: {
    all: () => ['vehicleDocuments'] as const,
    byVehicle: (vehicleId: string, kind?: string) => [...queryKeys.vehicleDocuments.all(), 'vehicle', vehicleId, kind ?? 'all'] as const,
  },
  analytics: {
    all: () => ['analytics'] as const,
    costSplit: (params: { vehicleId?: string; from?: string; to?: string }) =>
      [
        ...queryKeys.analytics.all(),
        'cost-split',
        params.vehicleId ?? 'all',
        params.from ?? 'default',
        params.to ?? 'default',
      ] as const,
    costTrend: (params: { vehicleId?: string; from?: string; to?: string }) =>
      [
        ...queryKeys.analytics.all(),
        'cost-trend',
        params.vehicleId ?? 'all',
        params.from ?? 'default',
        params.to ?? 'default',
      ] as const,
    tco: (vehicleId: string) => [...queryKeys.analytics.all(), 'tco', vehicleId] as const,
  },
  claims: {
    all: () => ['claims'] as const,
    byVehicle: (vehicleId: string) => [...queryKeys.claims.all(), 'vehicle', vehicleId] as const,
  },
  audit: {
    all: () => ['audit'] as const,
    me: (resourceType?: string) =>
      [...queryKeys.audit.all(), 'me', resourceType ?? 'all'] as const,
    byVehicle: (vehicleId: string) => [...queryKeys.audit.all(), 'vehicle', vehicleId] as const,
  },
};
