export const queryKeys = {
  dashboard: {
    all: () => ['dashboard'] as const,
    summary: () => [...queryKeys.dashboard.all(), 'summary'] as const,
    // Under the dashboard: the same classification, so whatever refreshes Home refreshes it.
    upcoming: (filters: { vehicleId?: string; kind?: string }) =>
      [...queryKeys.dashboard.all(), 'upcoming', filters] as const,
  },
  vehicles: {
    all: () => ['vehicles'] as const,
    list: () => [...queryKeys.vehicles.all(), 'list'] as const,
    detail: (vehicleId: string) => [...queryKeys.vehicles.all(), 'detail', vehicleId] as const,
    fuelLogs: (vehicleId: string) =>
      [...queryKeys.vehicles.detail(vehicleId), 'fuel-logs'] as const,
    // Under the fuel logs, so every fill logged, edited or deleted refreshes it.
    fuelEconomy: (vehicleId: string) =>
      [...queryKeys.vehicles.fuelLogs(vehicleId), 'economy'] as const,
    intervals: (vehicleId: string) =>
      [...queryKeys.vehicles.detail(vehicleId), 'intervals'] as const,
  },
  tyres: {
    all: (vehicleId: string) => ['vehicles', 'detail', vehicleId, 'tyres'] as const,
    condition: (vehicleId: string) => [...queryKeys.tyres.all(vehicleId), 'condition'] as const,
    inspections: (vehicleId: string) => [...queryKeys.tyres.all(vehicleId), 'inspections'] as const,
  },
  accessories: {
    all: (vehicleId: string) => ['vehicles', 'detail', vehicleId, 'accessories'] as const,
  },
  serviceBaseline: {
    coverage: (vehicleId: string) => ['vehicles', 'detail', vehicleId, 'service-baseline'] as const,
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
  publicCatalog: {
    all: () => ['publicCatalog'] as const,
    variant: (segment: string, make: string, model: string, generation: string, variant: string) =>
      [
        ...queryKeys.publicCatalog.all(),
        'variant',
        segment,
        make,
        model,
        generation,
        variant,
      ] as const,
    model: (segment: string, make: string, model: string) =>
      [...queryKeys.publicCatalog.all(), 'model', segment, make, model] as const,
    make: (segment: string, make: string) =>
      [...queryKeys.publicCatalog.all(), 'make', segment, make] as const,
    browse: (segment: string) => [...queryKeys.publicCatalog.all(), 'browse', segment] as const,
  },
  maintenance: {
    all: () => ['maintenance'] as const,
    list: (vehicleId: string) => [...queryKeys.maintenance.all(), 'list', vehicleId] as const,
    detail: (recordId: string) => [...queryKeys.maintenance.all(), 'detail', recordId] as const,
    workshops: () => [...queryKeys.maintenance.all(), 'workshops'] as const,
  },
  attachments: {
    all: () => ['attachments'] as const,
    extractionStatus: () => [...queryKeys.attachments.all(), 'extraction-status'] as const,
    byRecord: (recordId: string) => [...queryKeys.attachments.all(), 'record', recordId] as const,
    byDocument: (kind: string, documentId: string) =>
      [...queryKeys.attachments.all(), 'document', kind, documentId] as const,
    detail: (attachmentId: string) =>
      [...queryKeys.attachments.all(), 'detail', attachmentId] as const,
    fillPlan: (attachmentId: string) =>
      [...queryKeys.attachments.all(), 'fill-plan', attachmentId] as const,
  },
  reminders: {
    all: () => ['reminders'] as const,
    list: () => [...queryKeys.reminders.all(), 'list'] as const,
    byVehicle: (vehicleId: string) => [...queryKeys.reminders.all(), 'vehicle', vehicleId] as const,
    detail: (reminderId: string) => [...queryKeys.reminders.all(), 'detail', reminderId] as const,
    scheduleSuggestions: (vehicleId: string) =>
      [...queryKeys.reminders.all(), 'schedule-suggestions', vehicleId] as const,
  },
  vehicleDocuments: {
    all: () => ['vehicleDocuments'] as const,
    byVehicle: (vehicleId: string, kind?: string) =>
      [...queryKeys.vehicleDocuments.all(), 'vehicle', vehicleId, kind ?? 'all'] as const,
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
  vehicleLoans: {
    all: () => ['vehicleLoans'] as const,
    list: () => [...queryKeys.vehicleLoans.all(), 'list'] as const,
    byVehicle: (vehicleId: string) =>
      [...queryKeys.vehicleLoans.all(), 'vehicle', vehicleId] as const,
    detail: (id: string) => [...queryKeys.vehicleLoans.all(), 'detail', id] as const,
    schedule: (id: string) => [...queryKeys.vehicleLoans.all(), 'schedule', id] as const,
    attachments: (id: string) => [...queryKeys.vehicleLoans.all(), 'attachments', id] as const,
  },
  claims: {
    all: () => ['claims'] as const,
    byVehicle: (vehicleId: string) => [...queryKeys.claims.all(), 'vehicle', vehicleId] as const,
  },
  admin: {
    all: () => ['admin'] as const,
    users: (params?: { search?: string; page?: number; limit?: number }) =>
      [...queryKeys.admin.all(), 'users', params ?? {}] as const,
  },
  vehicleSharing: {
    all: () => ['vehicleSharing'] as const,
    members: (vehicleId: string) =>
      [...queryKeys.vehicleSharing.all(), 'members', vehicleId] as const,
    invites: (vehicleId: string) =>
      [...queryKeys.vehicleSharing.all(), 'invites', vehicleId] as const,
  },
  notifications: {
    all: () => ['notifications'] as const,
    list: () => [...queryKeys.notifications.all(), 'list'] as const,
    preferences: () => [...queryKeys.notifications.all(), 'preferences'] as const,
  },
  /**
   * Under the audit root: every write the timeline shows (a service, a fill, an
   * odometer reading) is audited, and its mutation already invalidates `audit.all()`.
   */
  history: {
    all: () => [...queryKeys.audit.all(), 'history'] as const,
    list: (params: { vehicleId?: string; kind?: string }) =>
      [...queryKeys.history.all(), params.vehicleId ?? 'all', params.kind ?? 'all'] as const,
  },
  audit: {
    all: () => ['audit'] as const,
    me: (resourceType?: string) => [...queryKeys.audit.all(), 'me', resourceType ?? 'all'] as const,
    byVehicle: (vehicleId: string) => [...queryKeys.audit.all(), 'vehicle', vehicleId] as const,
  },
};
