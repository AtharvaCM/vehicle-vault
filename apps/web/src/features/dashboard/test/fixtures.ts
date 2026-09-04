import { ReminderStatus, ReminderType, VehicleType } from '@vehicle-vault/shared';

import type {
  DashboardAttentionCounts,
  DashboardAttentionItem,
  DashboardReminderCounts,
  DashboardSummary,
  DashboardVehicleHealth,
} from '../types/dashboard';

export function makeAttentionItem(
  overrides: Partial<DashboardAttentionItem> = {},
): DashboardAttentionItem {
  return {
    id: 'reminder-1',
    kind: 'reminder',
    urgency: 'this_week',
    vehicleId: 'vehicle-1',
    vehicleName: 'Daily driver',
    registrationNumber: 'MH12AB1234',
    currentUserRole: 'owner',
    title: 'Engine oil change',
    reminderType: ReminderType.Service,
    reminderStatus: ReminderStatus.Upcoming,
    dueDate: '2026-04-05T00:00:00.000Z',
    daysUntilDue: 3,
    ...overrides,
  };
}

export function makeVehicle(
  overrides: Partial<DashboardVehicleHealth> = {},
): DashboardVehicleHealth {
  return {
    id: 'vehicle-1',
    displayName: 'Daily driver',
    registrationNumber: 'MH12AB1234',
    vehicleType: VehicleType.Car,
    odometer: 45200,
    currentUserRole: 'owner',
    status: 'ok',
    overdueCount: 0,
    dueSoonCount: 0,
    nextDue: null,
    documents: {
      insurance: { state: 'active', endDate: '2026-12-01T00:00:00.000Z' },
      puc: { state: 'active', endDate: '2026-09-15T00:00:00.000Z' },
    },
    lastService: null,
    ...overrides,
  };
}

export function makeAttentionCounts(
  overrides: Partial<DashboardAttentionCounts> = {},
): DashboardAttentionCounts {
  return {
    overdue: 0,
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    documentsExpiring30d: 0,
    vehiclesNeedingAttention: 0,
    total: 0,
    ...overrides,
  };
}

export function makeReminderCounts(
  overrides: Partial<DashboardReminderCounts> = {},
): DashboardReminderCounts {
  return { overdue: 0, dueToday: 0, upcoming: 0, completed: 0, ...overrides };
}

export function makeSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  const vehicles = overrides.vehicles ?? [makeVehicle()];

  return {
    totalVehicles: vehicles.length,
    totalMaintenanceRecords: 0,
    totalAttachments: 0,
    reminderCounts: makeReminderCounts(),
    recentVehicles: [],
    recentMaintenance: [],
    upcomingReminders: [],
    overdueReminders: [],
    insights: [],
    loans: {
      activeCount: 0,
      closedCount: 0,
      monthlyEmi: 0,
      outstandingBalance: 0,
      interestPaidToDate: 0,
      prepaidToDate: 0,
      nextEmiDate: null,
    },
    attention: [],
    attentionTotal: 0,
    attentionCounts: makeAttentionCounts(),
    vehicles,
    vehiclesTotal: vehicles.length,
    hasSpend: false,
    ...overrides,
  };
}
