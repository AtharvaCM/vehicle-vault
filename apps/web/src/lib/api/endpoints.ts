export const endpoints = {
  dashboard: {
    summary: '/dashboard/summary',
  },
  vehicles: {
    list: '/vehicles',
    create: '/vehicles',
    detail: (vehicleId: string) => `/vehicles/${vehicleId}`,
  },
  maintenance: {
    list: (vehicleId: string) => `/vehicles/${vehicleId}/maintenance`,
    create: (vehicleId: string) => `/vehicles/${vehicleId}/maintenance`,
  },
  reminders: {
    list: '/reminders',
  },
} as const;
