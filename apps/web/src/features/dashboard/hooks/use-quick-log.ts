import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MaintenanceCategory, MaintenanceRecordStatus } from '@vehicle-vault/shared';

import { uploadAttachments } from '@/features/attachments/api/upload-attachments';
import { createMaintenanceRecord } from '@/features/maintenance/api/create-maintenance-record';
import type { MaintenanceRecord } from '@/features/maintenance/types/maintenance-record';
import { updateVehicleOdometer } from '@/features/vehicles/api/update-vehicle-odometer';
import { invalidateAudit } from '@/lib/query/invalidate-audit';
import { queryKeys } from '@/lib/query/query-keys';

export type QuickLogInput = {
  vehicle: { id: string; odometer: number };
  /** A calendar day, yyyy-mm-dd. */
  serviceDate: string;
  odometer: number;
  totalCost: number;
  photo: File | null;
};

export type QuickLogOutcome = {
  record: MaintenanceRecord;
  /** The reading was higher than the vehicle's, but raising the odometer failed. */
  odometerFailed: boolean;
  /** A photo was chosen, but it did not upload. */
  photoFailed: boolean;
};

/**
 * A service logged at the workshop counter: date, odometer, cost, and perhaps a
 * photo of the job card. What it creates was decided on issue #116:
 *
 * - A **confirmed** record in category **`other`**. Confirmed, because costs,
 *   forecasts, alerts and reports read only confirmed records; `other`, because
 *   a guessed category would reset the wrong service clock. It can be
 *   recategorised later.
 * - The reading raises the vehicle's odometer **only when higher**, so a
 *   back-dated log never winds it back.
 * - The photo is **attached**, and nothing is extracted from it here. Filling
 *   the record in from it is a later, deliberate step.
 *
 * The record is the part that matters. If raising the odometer or uploading
 * the photo fails after it is saved, the outcome says so rather than losing
 * the record by failing the whole log.
 */
export function useQuickLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: QuickLogInput): Promise<QuickLogOutcome> => {
      const record = await createMaintenanceRecord(input.vehicle.id, {
        category: MaintenanceCategory.Other,
        status: MaintenanceRecordStatus.Confirmed,
        // The form collects a calendar day; the contract is a full timestamp.
        serviceDate: new Date(input.serviceDate).toISOString(),
        odometer: input.odometer,
        totalCost: input.totalCost,
      });

      let odometerFailed = false;
      if (input.odometer > input.vehicle.odometer) {
        try {
          await updateVehicleOdometer(input.vehicle.id, input.odometer);
        } catch {
          odometerFailed = true;
        }
      }

      let photoFailed = false;
      if (input.photo) {
        try {
          await uploadAttachments(record.id, [input.photo]);
        } catch {
          photoFailed = true;
        }
      }

      return { record, odometerFailed, photoFailed };
    },
    onSettled: (outcome) => {
      void invalidateAudit(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      // The odometer, and everything measured from it.
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all() });
      if (outcome) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.attachments.byRecord(outcome.record.id),
        });
      }
    },
  });
}
