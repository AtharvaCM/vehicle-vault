import { useState } from 'react';
import { Fuel, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { appToast } from '@/lib/toast';

import { FuelLogList } from './fuel-log-list';
import { FuelLogForm } from './fuel-log-form';
import { useFuelLogs } from '../hooks/use-fuel-logs';
import { useCreateFuelLog } from '../hooks/use-create-fuel-log';
import { useDeleteFuelLog } from '../hooks/use-delete-fuel-log';
import type { FuelLog } from '@vehicle-vault/shared';

type FuelTabProps = {
  vehicleId: string;
};

export function FuelTab({ vehicleId }: FuelTabProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);

  const logsQuery = useFuelLogs(vehicleId);
  const createMutation = useCreateFuelLog(vehicleId);
  const deleteMutation = useDeleteFuelLog(vehicleId);

  const handleCreate = async (values: any) => {
    try {
      await createMutation.mutateAsync(values);
      setIsFormOpen(false);
      appToast.success({
        title: 'Fuel log saved',
        description: 'Your fuelfill has been recorded.',
      });
    } catch (error) {
      appToast.error({
        title: 'Failed to save log',
        description: 'Please try again.',
      });
    }
  };

  const handleDelete = async (logId: string) => {
    if (confirm('Are you sure you want to delete this fuel log?')) {
      try {
        await deleteMutation.mutateAsync(logId);
        appToast.success({
          title: 'Fuel log deleted',
          description: 'The record was removed.',
        });
      } catch (error) {
        appToast.error({
          title: 'Failed to delete log',
          description: 'Please try again.',
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Fuel History</h3>
          <p className="text-sm text-slate-500">Track your fuel consumption and efficiency over time.</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Log Fuel
        </Button>
      </div>

      <FuelLogList 
        logs={logsQuery.data || []} 
        isLoading={logsQuery.isLoading}
        onAdd={() => setIsFormOpen(true)}
        onDelete={handleDelete}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <FuelLogForm 
            onSubmit={handleCreate}
            isSubmitting={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
