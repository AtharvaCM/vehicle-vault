import { useMemo } from 'react';
import { Fuel } from 'lucide-react';
import type { FuelLog, FuelType } from '@vehicle-vault/shared';

import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

import { fillEconomy } from '../utils/fill-economy';
import { fuelQuantityUnit } from '../utils/fuel-unit';
import { FUEL_ROW_GRID, FuelLogRow } from './fuel-log-row';

type FuelLogListProps = {
  logs: FuelLog[];
  fuelType: FuelType;
  onEdit?: (log: FuelLog) => void;
  onDelete?: (logId: string) => void;
  /** Omitted for someone who cannot add, which also drops the empty state's action. */
  onAdd?: () => void;
  isLoading?: boolean;
};

/** Every fill as a compact row, each with the economy it earned since the fill before. */
export function FuelLogList({
  logs,
  fuelType,
  onEdit,
  onDelete,
  onAdd,
  isLoading,
}: FuelLogListProps) {
  const economy = useMemo(() => fillEconomy(logs), [logs]);
  const unit = fuelQuantityUnit(fuelType);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 w-full animate-pulse rounded-xl bg-line-subtle" />
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
    <div className="overflow-hidden rounded-card border border-line/60 bg-surface">
      <div
        aria-hidden="true"
        className={`hidden border-b border-line-subtle bg-page/60 px-4 py-2 text-caption font-medium text-fg-3 ${FUEL_ROW_GRID}`}
      >
        <span>Date</span>
        <span>Quantity</span>
        <span>Odometer</span>
        <span>Since last fill</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      <ul
        aria-label={`Fills, with km/${unit} since the fill before`}
        className="divide-y divide-line-subtle"
      >
        {logs.map((log) => (
          <FuelLogRow
            economy={economy.get(log.id)}
            fuelType={fuelType}
            key={log.id}
            log={log}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </ul>
    </div>
  );
}
