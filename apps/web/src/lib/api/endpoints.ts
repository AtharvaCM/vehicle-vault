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
    list: (vehicleId: string) => `/vehicles/${vehicleId}/maintenance-records`,
    create: (vehicleId: string) => `/vehicles/${vehicleId}/maintenance-records`,
    detail: (recordId: string) => `/maintenance-records/${recordId}`,
    update: (recordId: string) => `/maintenance-records/${recordId}`,
    delete: (recordId: string) => `/maintenance-records/${recordId}`,
  },
  reminders: {
    list: '/reminders',
  },
} as const;
