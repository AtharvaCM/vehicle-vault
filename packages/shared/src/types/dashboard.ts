import type {
  MaintenanceCategory,
  ReminderStatus,
  ReminderType,
  VehicleRole,
  VehicleType,
} from '../enums';
import type { MaintenanceSuggestion } from './maintenance';
import type { VehicleDocumentKind } from './vehicle-document';

export type DashboardReminderCounts = {
  overdue: number;
  dueToday: number;
  upcoming: number;
  completed: number;
};

/**
 * @deprecated Superseded by {@link DashboardVehicleHealth} (`DashboardSummary.vehicles`),
 * which covers every vehicle with a health verdict instead of the five newest.
 * Kept for one release so older clients keep working.
 */
export type DashboardVehicleSummary = {
  id: string;
  displayName: string;
  registrationNumber: string;
  vehicleType: VehicleType;
  odometer: number;
  updatedAt: string;
};

export type DashboardMaintenanceSummary = {
  id: string;
  vehicleId: string;
  vehicleLabel: string;
  category: MaintenanceCategory;
  serviceDate: string;
  totalCost: number;
  workshopName?: string;
  attachmentCount: number;
};

export type DashboardReminderSummary = {
  id: string;
  vehicleId: string;
  vehicleLabel: string;
  title: string;
  type: ReminderType;
  status: ReminderStatus;
  dueDate?: string;
  dueOdometer?: number;
  updatedAt: string;
};

export type DashboardLoanSummary = {
  activeCount: number;
  closedCount: number;
  monthlyEmi: number;
  outstandingBalance: number;
  interestPaidToDate: number;
  prepaidToDate: number;
  nextEmiDate: string | null;
};

/** What kind of deadline a "Needs attention" row represents. */
export type DashboardAttentionKind = 'reminder' | 'document' | 'loan_emi';

/**
 * Server-computed urgency bucket. Bucketing uses UTC calendar days — the same
 * arithmetic `RemindersService` uses to derive `ReminderStatus` — so a row's
 * bucket can never contradict the reminder's own status.
 *
 * - `overdue`: past due / expired (documents only within the last 90 days)
 * - `today`: due today
 * - `this_week`: due in 1–7 days
 * - `this_month`: due in 8–30 days (rendered as a low-weight "Coming up" list)
 */
export type DashboardUrgency = 'overdue' | 'today' | 'this_week' | 'this_month';

export type DashboardAttentionItem = {
  /** `reminder.id`, `document.id`, or `emi:${loanId}`. */
  id: string;
  kind: DashboardAttentionKind;
  urgency: DashboardUrgency;
  vehicleId: string;
  /** `nickname?.trim() || `${make} ${model}``. */
  vehicleName: string;
  registrationNumber: string;
  /** The current user's role on the vehicle; viewers cannot complete reminders. */
  currentUserRole: VehicleRole;
  /** Reminder title, document kind title (e.g. "Insurance policy"), or "Loan EMI". */
  title: string;
  reminderType?: ReminderType;
  reminderStatus?: ReminderStatus;
  documentKind?: VehicleDocumentKind;
  /** Documents only: insurer / issuing authority. */
  provider?: string;
  /** Loan EMI only. */
  loanId?: string;
  /** Loan EMI only: the EMI amount. */
  amount?: number;
  /** ISO date; null only for odometer-only reminders. */
  dueDate: string | null;
  /** Calendar days from today (UTC) to `dueDate`; negative when past. Null when `dueDate` is null. */
  daysUntilDue: number | null;
  dueOdometer?: number;
  /** `dueOdometer - vehicle.odometer`; negative when past. */
  kmUntilDue?: number;
};

/** Counts computed from the UNTRUNCATED attention list, so tiles never disagree with the queue. */
export type DashboardAttentionCounts = {
  overdue: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  /** Documents (any kind) expired or expiring within 30 days. */
  documentsExpiring30d: number;
  /** Vehicles whose `status` is not `ok`. */
  vehiclesNeedingAttention: number;
  /** overdue + today + thisWeek + thisMonth. */
  total: number;
};

export type DashboardDocumentState = 'active' | 'expiring' | 'expired' | 'missing';

export type DashboardVehicleDocumentStatus = {
  state: DashboardDocumentState;
  /** Latest end date on file for this kind, or null (no document / open-ended warranty). */
  endDate: string | null;
};

export type DashboardVehicleNextDue = {
  kind: 'reminder' | 'document';
  /** Reminder id or document id. */
  targetId: string;
  title: string;
  dueDate: string | null;
  daysUntilDue: number | null;
  dueOdometer?: number;
};

export type DashboardVehicleLastService = {
  recordId: string;
  serviceDate: string;
  odometer: number;
  category: MaintenanceCategory;
};

export type DashboardVehicleStatus = 'overdue' | 'due_soon' | 'ok';

/** One vehicle with a health verdict — the "every vehicle at a glance" row. */
export type DashboardVehicleHealth = {
  id: string;
  displayName: string;
  registrationNumber: string;
  vehicleType: VehicleType;
  odometer: number;
  /**
   * ISO datetime the odometer reading was last touched: the later of the
   * vehicle's own `updatedAt` and its latest fuel log's `date`. Every
   * odometer-driven reminder status and smart suggestion trusts `odometer`
   * to be current, so the dashboard surfaces this to nudge a stale reading.
   */
  odometerUpdatedAt: string;
  currentUserRole: VehicleRole;
  /** `overdue` when overdueCount > 0, else `due_soon` when dueSoonCount > 0, else `ok`. */
  status: DashboardVehicleStatus;
  /** Attention items for this vehicle with urgency `overdue`. */
  overdueCount: number;
  /** Attention items for this vehicle with urgency today | this_week | this_month. */
  dueSoonCount: number;
  /** Earliest open reminder or document expiry for the vehicle, by the queue's ordering. */
  nextDue: DashboardVehicleNextDue | null;
  /**
   * Latest document per kind. Only kinds present on the vehicle appear, except
   * `insurance` and `puc`, which are always present (state `missing` when absent)
   * because they are the two legally mandatory documents in India.
   */
  documents: Partial<Record<VehicleDocumentKind, DashboardVehicleDocumentStatus>>;
  lastService: DashboardVehicleLastService | null;
};

export type DashboardSummary = {
  totalVehicles: number;
  totalMaintenanceRecords: number;
  totalAttachments: number;
  reminderCounts: DashboardReminderCounts;
  /** @deprecated Use `vehicles`. */
  recentVehicles: DashboardVehicleSummary[];
  recentMaintenance: DashboardMaintenanceSummary[];
  /** Due-today + upcoming reminders, soonest first, capped. Prefer `attention`. */
  upcomingReminders: DashboardReminderSummary[];
  /** Overdue reminders, capped. Prefer `attention`. */
  overdueReminders: DashboardReminderSummary[];
  insights: MaintenanceSuggestion[];
  loans: DashboardLoanSummary;
  /**
   * Cross-vehicle queue of reminders, document expiries, and imminent EMIs,
   * sorted by urgency then due date (odometer-only items last within a bucket),
   * capped at 25. `attentionTotal` carries the uncapped count.
   */
  attention: DashboardAttentionItem[];
  attentionTotal: number;
  attentionCounts: DashboardAttentionCounts;
  /** Every vehicle the user can see (cap 50), sorted by status severity then display name. */
  vehicles: DashboardVehicleHealth[];
  vehiclesTotal: number;
  /** True when any maintenance record, fuel log, or active loan exists — gates the Spend section. */
  hasSpend: boolean;
};
