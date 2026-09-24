import { useState, useRef } from 'react';
import { Plus, Scan, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import type { FuelLog } from '@vehicle-vault/shared';
import { useVehicleAccess } from '@/features/vehicles/context/vehicle-access';

type FuelTabProps = {
  vehicleId: string;
};

export function FuelTab({ vehicleId }: FuelTabProps) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-fg">Fuel history</h3>
          <p className="text-sm text-fg-3">Track your fuel consumption and efficiency over time.</p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {/* Hidden File Input for Scan */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={fileInputRef}
              onChange={handleScan}
            />

            <Button
              disabled={scanMutation.isPending}
              onClick={() => {
                if (scanStatus.data?.available === false) {
                  appToast.info({
                    title: 'AI not configured',
                    description:
                      'Please set your GEMINI_API_KEY in the backend .env to enable receipt scanning.',
                  });
                  return;
                }
                fileInputRef.current?.click();
              }}
              size="sm"
              variant="outline"
              className="gap-2 border-primary/20 hover:border-primary/50 text-primary bg-primary/5 relative"
              title={scanStatus.data?.available ? 'AI ready' : 'AI plugin missing'}
            >
              {scanMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="relative">
                  <Scan className="h-4 w-4" />
                  <span
                    className={`absolute -top-1 -right-1 h-2 w-2 rounded-full border border-surface ${scanStatus.data?.available ? 'bg-ok shadow-[0_0_8px_var(--ok)]' : 'bg-soon-dot'}`}
                  />
                </div>
              )}
              {scanMutation.isPending ? 'Analyzing...' : 'Scan receipt'}
            </Button>

            <Button
              onClick={() => setIsImportOpen(true)}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              Import CSV
            </Button>

            <Button
              onClick={() => {
                setScannedData(null);
                setIsFormOpen(true);
              }}
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Log fuel
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
            <DialogTitle>Edit fuel log</DialogTitle>
          </DialogHeader>
          {editingLog && (
            <FuelLogForm
              onSubmit={handleUpdate}
              isSubmitting={updateMutation.isPending}
              submitLabel="Save changes"
              initialValues={{
                date: editingLog.date.split('T')[0],
                odometer: editingLog.odometer,
                quantity: editingLog.quantity,
                price: editingLog.price,
                totalCost: editingLog.totalCost,
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
          <FuelLogForm
            onSubmit={handleCreate}
            isSubmitting={createMutation.isPending}
            initialValues={scannedData || undefined}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
