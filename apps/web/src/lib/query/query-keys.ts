export const queryKeys = {
  dashboard: {
    all: () => ['dashboard'] as const,
    summary: () => [...queryKeys.dashboard.all(), 'summary'] as const,
  },
  vehicles: {
    all: () => ['vehicles'] as const,
    list: () => [...queryKeys.vehicles.all(), 'list'] as const,
    detail: (vehicleId: string) => [...queryKeys.vehicles.all(), 'detail', vehicleId] as const,
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
};
