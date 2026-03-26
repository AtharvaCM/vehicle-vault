import { useState, useRef } from 'react';
import { Fuel, Plus, Scan, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { appToast } from '@/lib/toast';

import { FuelLogList } from './fuel-log-list';
import { FuelLogForm } from './fuel-log-form';
import { FuelImportDialog } from './fuel-import-dialog';
import { useQuery } from '@tanstack/react-query';
import { useFuelLogs } from '../hooks/use-fuel-logs';
import { useCreateFuelLog } from '../hooks/use-create-fuel-log';
import { useDeleteFuelLog } from '../hooks/use-delete-fuel-log';
import { useScanReceipt, useScanStatus, type ScannedFuelLog } from '../hooks/use-scan-receipt';
import type { FuelLog } from '@vehicle-vault/shared';

type FuelTabProps = {
  vehicleId: string;
};

export function FuelTab({ vehicleId }: FuelTabProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [scannedData, setScannedData] = useState<Partial<ScannedFuelLog> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const logsQuery = useFuelLogs(vehicleId);
  const createMutation = useCreateFuelLog(vehicleId);
  const deleteMutation = useDeleteFuelLog(vehicleId);
  const scanMutation = useScanReceipt();
  const scanStatus = useQuery(useScanStatus());

  const handleCreate = async (values: any) => {
    try {
      await createMutation.mutateAsync(values);
      setIsFormOpen(false);
      setScannedData(null);
      appToast.success({
        title: 'Fuel log saved',
        description: 'Your fuel fill has been recorded.',
      });
    } catch (error) {
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
        title: 'Receipt Scanned!',
        description: 'We\'ve extracted the details for you to review.',
      });
    } catch (error) {
      appToast.error({
        title: 'Scan failed',
        description: 'Could not read the receipt. Please try again or enter manually.',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Fuel History</h3>
          <p className="text-sm text-slate-500">Track your fuel consumption and efficiency over time.</p>
        </div>
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
                  title: 'AI Not Configured',
                  description: 'Please set your GEMINI_API_KEY in the backend .env to enable receipt scanning.'
                });
                return;
              }
              fileInputRef.current?.click();
            }} 
            size="sm" 
            variant="outline" 
            className="gap-2 border-primary/20 hover:border-primary/50 text-primary bg-primary/5 relative"
            title={scanStatus.data?.available ? 'AI Ready' : 'AI Plugin Missing'}
          >
            {scanMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="relative">
                <Scan className="h-4 w-4" />
                <span className={`absolute -top-1 -right-1 h-2 w-2 rounded-full border border-white dark:border-zinc-950 ${scanStatus.data?.available ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-400'}`} />
              </div>
            )}
            {scanMutation.isPending ? 'Analyzing...' : 'Scan Receipt'}
          </Button>

          <Button onClick={() => setIsImportOpen(true)} size="sm" variant="outline" className="gap-2">
            Import CSV
          </Button>
          
          <Button onClick={() => {
            setScannedData(null);
            setIsFormOpen(true);
          }} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Log Fuel
          </Button>
        </div>
      </div>

      <FuelLogList 
        logs={logsQuery.data || []} 
        isLoading={logsQuery.isLoading}
        onAdd={() => setIsFormOpen(true)}
        onDelete={handleDelete}
      />

      <FuelImportDialog 
        vehicleId={vehicleId}
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
      />

      <Dialog open={isFormOpen} onOpenChange={(val) => {
        setIsFormOpen(val);
        if (!val) setScannedData(null);
      }}>
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
