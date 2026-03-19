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
    list: (vehicleId: string) => [...queryKeys.maintenance.all(), 'list', vehicleId] as const,
  },
  reminders: {
    all: () => ['reminders'] as const,
    list: () => [...queryKeys.reminders.all(), 'list'] as const,
  },
};
