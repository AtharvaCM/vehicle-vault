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

export type DashboardLoanSummary = {
  activeCount: number;
  closedCount: number;
  monthlyEmi: number;
  outstandingBalance: number;
  interestPaidToDate: number;
  prepaidToDate: number;
  nextEmiDate: string | null;
};

/**
 * What a "Needs attention" row is about. Reminders, documents and EMIs carry
 * their own dates; tyres, service history and accessory warranties are the
 * alert engine's verdicts, read from the same functions the bell raises them
 * from, so the queue and the bell cannot disagree about a vehicle.
 */
export type DashboardAttentionKind =
  | 'reminder'
  | 'document'
  | 'loan_emi'
  | 'tyre'
  | 'service_baseline'
  | 'accessory';

/**
 * Server-computed urgency bucket. Bucketing uses UTC calendar days — the same
 * arithmetic `RemindersService` uses to derive `ReminderStatus` — so a row's
 * bucket can never contradict the reminder's own status.
 *
 * - `overdue`: past due / expired (documents only within the last 90 days)
 * - `today`: due today
 * - `this_week`: due in 1–7 days
 * - `this_month`: due in 8–30 days (rendered as a low-weight "Coming up" list)
 *
 * An undated verdict buckets by what it says, the way an odometer reminder
 * does: a tyre past its replacement limit (tread or age) is `overdue`, like a
 * reminder past its km; a first warning, or a question the app is asking
 * (tyres not measured lately, service history unknown), is `this_month`, where
 * a reminder approaching its km sits. An accessory warranty has a date and
 * buckets like a document, from today to 30 days out.
 */
export type DashboardUrgency = 'overdue' | 'today' | 'this_week' | 'this_month';

export type DashboardAttentionItem = {
  /**
   * `reminder.id`, `document.id`, `emi:${loanId}`, `tyre:${tyreId}`,
   * `tyre-check:${vehicleId}` (the inspection question),
   * `service-history:${vehicleId}` or `accessory:${accessoryId}`.
   */
  id: string;
  kind: DashboardAttentionKind;
  urgency: DashboardUrgency;
  vehicleId: string;
  /** `nickname?.trim() || `${make} ${model}``. */
  vehicleName: string;
  registrationNumber: string;
  /** The current user's role on the vehicle; viewers cannot complete reminders. */
  currentUserRole: VehicleRole;
  /**
   * Reminder title, document kind title (e.g. "Insurance policy"), "Loan EMI",
   * or the verdict (e.g. "Replace tyre").
   */
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
  /** ISO date; null for odometer-only reminders and the undated verdicts (tyre, service history). */
  dueDate: string | null;
  /** Calendar days from today (UTC) to `dueDate`; negative when past. Null when `dueDate` is null. */
  daysUntilDue: number | null;
  dueOdometer?: number;
  /** `dueOdometer - vehicle.odometer`; negative when past. */
  kmUntilDue?: number;
  /**
   * Undated verdicts only (tyre, service history): what the verdict rests on,
   * where a dated row says when it falls due. E.g. "Front left · 2.8 mm tread",
   * or "Brake pads and coolant".
   */
  detail?: string;
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
  /**
   * Distinct vehicles among overdue/today/thisWeek items (thisMonth excluded,
   * matching the headline's own definition of "urgent"). Computed from the
   * uncapped attention list, so it stays accurate once `attention` is capped
   * at 25 and can no longer be trusted to name every urgent vehicle itself.
   */
  urgentVehicles: number;
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
  /** EMIs never become "next due". */
  kind: Exclude<DashboardAttentionKind, 'loan_emi'>;
  /** The attention row's id. */
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
  /** The vehicle's first attention row other than an EMI, by the queue's ordering. */
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
  recentMaintenance: DashboardMaintenanceSummary[];
  insights: MaintenanceSuggestion[];
  loans: DashboardLoanSummary;
  /**
   * Cross-vehicle queue of reminders, document expiries, imminent EMIs, and
   * the alert engine's tyre, service-history and accessory-warranty verdicts,
   * sorted by urgency then due date (undated items last within a bucket),
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
