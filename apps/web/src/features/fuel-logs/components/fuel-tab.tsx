import { useMemo, useState, useRef } from 'react';
import { ChevronDown, FileUp, Loader2, Plus, Scan } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { confirm } from '@/components/shared/confirm';
import { ErrorState } from '@/components/shared/error-state';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { appToast } from '@/lib/toast';

import { FuelLogList } from './fuel-log-list';
import { FuelLogForm } from './fuel-log-form';
import { FuelImportDialog } from './fuel-import-dialog';
import { useQuery } from '@tanstack/react-query';
import { useFuelLogs } from '../hooks/use-fuel-logs';
import { useCreateFuelLog } from '../hooks/use-create-fuel-log';
import { useDeleteFuelLog } from '../hooks/use-delete-fuel-log';
import { useUpdateFuelLog } from '../hooks/use-update-fuel-log';
import { useScanReceipt, useScanStatus, type ScannedFuelLog } from '../hooks/use-scan-receipt';
import { fuelNoun } from '../utils/fuel-unit';
import type { FuelLog, FuelType } from '@vehicle-vault/shared';
import { useVehicleAccess } from '@/features/vehicles/context/vehicle-access';

type FuelTabProps = {
  vehicleId: string;
  fuelType: FuelType;
  /** The vehicle's current reading, shown as a hint on a new fill's Odometer field. */
  odometer: number;
};

export function FuelTab({ vehicleId, fuelType, odometer }: FuelTabProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { canEdit } = useVehicleAccess();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [scannedData, setScannedData] = useState<Partial<ScannedFuelLog> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const logsQuery = useFuelLogs(vehicleId);
  const createMutation = useCreateFuelLog(vehicleId);
  const deleteMutation = useDeleteFuelLog(vehicleId);
  const updateMutation = useUpdateFuelLog(vehicleId, editingLog?.id ?? '');
  const scanMutation = useScanReceipt();
  const scanStatus = useQuery(useScanStatus());
  const noun = fuelNoun(fuelType);
  // The most recently logged station, so a new fill starts with it already filled in.
  const lastLocation = logsQuery.data?.find((log) => log.location)?.location;
  // Stable across unrelated re-renders (a background refetch, a delete elsewhere):
  // FuelLogForm resets on a new `initialValues` identity, which must not happen
  // while someone is mid-fill.
  const createInitialValues = useMemo(
    () => ({ location: lastLocation, ...scannedData }),
    [lastLocation, scannedData],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCreate = async (values: any) => {
    try {
      await createMutation.mutateAsync(values);
      setIsFormOpen(false);
      setScannedData(null);
      appToast.success({
        title: 'Fuel log saved',
        description: 'Your fuel fill has been recorded.',
      });
    } catch {
      appToast.error({
        title: 'Failed to save log',
        description: 'Please try again.',
      });
    }
  };

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await scanMutation.mutateAsync(file);
      setScannedData(result);
      setIsFormOpen(true);
      appToast.success({
        title: 'Receipt scanned!',
        description: "We've extracted the details for you to review.",
      });
    } catch {
      appToast.error({
        title: 'Scan failed',
        description: 'Could not read the receipt. Please try again or enter manually.',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEdit = (log: FuelLog) => {
    setEditingLog(log);
    setIsEditOpen(true);
  };

  const handleUpdate = async (values: Parameters<typeof updateMutation.mutateAsync>[0]) => {
    try {
      await updateMutation.mutateAsync(values);
      setIsEditOpen(false);
      setEditingLog(null);
      appToast.success({
        title: 'Fuel log updated',
        description: 'Your changes have been saved.',
      });
    } catch {
      appToast.error({
        title: 'Failed to update log',
        description: 'Please try again.',
      });
    }
  };

  const handleDelete = async (logId: string) => {
    if (
      !(await confirm({
        title: 'Delete this fuel log?',
        description: "It can't be undone.",
        confirmLabel: 'Delete',
        destructive: true,
      }))
    ) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(logId);
      appToast.success({
        title: 'Fuel log deleted',
        description: 'The record was removed.',
      });
    } catch {
      appToast.error({
        title: 'Failed to delete log',
        description: 'Please try again.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-48 flex-1">
          <h3 className="text-lead font-bold text-fg">Fuel history</h3>
          <p className="text-ui text-fg-3">Track your fuel consumption and efficiency over time.</p>
        </div>
        {canEdit ? (
          // Log is the one primary action; scanning and importing sit beside
          // it as one secondary control, so the row never wraps it under them.
          <div className="flex shrink-0 flex-nowrap gap-2">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={fileInputRef}
              onChange={handleScan}
            />
            {/* Scanning is offered only when it is available: never a word
                about how the server is configured. Without it, Import is
                the one other way in, and needs no menu. */}
            {scanStatus.data?.available ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={scanMutation.isPending}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    {scanMutation.isPending ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    ) : null}
                    {scanMutation.isPending ? 'Reading…' : 'Scan or import'}
                    <ChevronDown aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                    <Scan aria-hidden="true" className="h-4 w-4" />
                    Scan receipt
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setIsImportOpen(true)}>
                    <FileUp aria-hidden="true" className="h-4 w-4" />
                    Import CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => setIsImportOpen(true)}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <FileUp aria-hidden="true" className="h-4 w-4" />
                Import CSV
              </Button>
            )}
            <Button
              onClick={() => {
                setScannedData(null);
                setIsFormOpen(true);
              }}
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Log {noun.toLowerCase()}
            </Button>
          </div>
        ) : null}
      </div>

      {logsQuery.isError ? (
        <ErrorState
          action={
            <Button onClick={() => logsQuery.refetch()} variant="secondary">
              Retry
            </Button>
          }
          description={getApiErrorMessage(
            logsQuery.error,
            "We couldn't load fuel logs for this vehicle. Your entries are safe — this is a display problem.",
          )}
          title="Unable to load fuel logs"
        />
      ) : (
        <FuelLogList
          logs={logsQuery.data || []}
          fuelType={fuelType}
          isLoading={logsQuery.isLoading}
          onAdd={canEdit ? () => setIsFormOpen(true) : undefined}
          onEdit={canEdit ? handleEdit : undefined}
          onDelete={canEdit ? handleDelete : undefined}
        />
      )}

      <FuelImportDialog vehicleId={vehicleId} open={isImportOpen} onOpenChange={setIsImportOpen} />

      <Dialog
        open={isEditOpen}
        onOpenChange={(val) => {
          setIsEditOpen(val);
          if (!val) setEditingLog(null);
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit {noun.toLowerCase()}</DialogTitle>
          </DialogHeader>
          {editingLog && (
            <FuelLogForm
              fuelType={fuelType}
              onSubmit={handleUpdate}
              isSubmitting={updateMutation.isPending}
              submitLabel="Save changes"
              initialValues={{
                date: editingLog.date.split('T')[0],
                odometer: editingLog.odometer,
                quantity: editingLog.quantity,
                price: editingLog.price,
                totalCost: editingLog.totalCost,
                isFullTank: editingLog.isFullTank ?? true,
                paymentMethod: editingLog.paymentMethod ?? '',
                location: editingLog.location ?? '',
                notes: editingLog.notes ?? '',
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isFormOpen}
        onOpenChange={(val) => {
          setIsFormOpen(val);
          if (!val) setScannedData(null);
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Log {noun.toLowerCase()}</DialogTitle>
          </DialogHeader>
          <FuelLogForm
            fuelType={fuelType}
            lastOdometer={odometer}
            onSubmit={handleCreate}
            isSubmitting={createMutation.isPending}
            initialValues={createInitialValues}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
