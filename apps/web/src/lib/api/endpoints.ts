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
  attachments: {
    byRecord: (recordId: string) => `/maintenance-records/${recordId}/attachments`,
    upload: (recordId: string) => `/maintenance-records/${recordId}/attachments`,
    detail: (attachmentId: string) => `/attachments/${attachmentId}`,
    file: (attachmentId: string) => `/attachments/${attachmentId}/file`,
    delete: (attachmentId: string) => `/attachments/${attachmentId}`,
  },
  reminders: {
    list: '/reminders',
    byVehicle: (vehicleId: string) => `/vehicles/${vehicleId}/reminders`,
    detail: (reminderId: string) => `/reminders/${reminderId}`,
    create: (vehicleId: string) => `/vehicles/${vehicleId}/reminders`,
    update: (reminderId: string) => `/reminders/${reminderId}`,
    delete: (reminderId: string) => `/reminders/${reminderId}`,
    complete: (reminderId: string) => `/reminders/${reminderId}/complete`,
  },
} as const;
