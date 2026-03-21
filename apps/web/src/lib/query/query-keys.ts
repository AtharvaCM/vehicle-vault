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
