import { FuelLog } from '@vehicle-vault/shared';
import { FuelLogCard } from './fuel-log-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Fuel } from 'lucide-react';
import { Button } from '@/components/ui/button';

type FuelLogListProps = {
  logs: FuelLog[];
  onEdit?: (log: FuelLog) => void;
  onDelete?: (logId: string) => void;
  /** Omitted for someone who cannot add, which also drops the empty state's action. */
  onAdd?: () => void;
  isLoading?: boolean;
};

export function FuelLogList({ logs, onEdit, onDelete, onAdd, isLoading }: FuelLogListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-line-subtle" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={Fuel}
        title="No fuel logs found"
        description="Start tracking your vehicle's efficiency by adding your first fuel fill-up."
        action={
          onAdd ? (
            <Button onClick={onAdd} variant="outline">
              Add fuel log
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <FuelLogCard key={log.id} log={log} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
