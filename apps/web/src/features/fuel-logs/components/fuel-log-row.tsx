import { MapPin, MoreVertical } from 'lucide-react';
import type { FuelLog, FuelType } from '@vehicle-vault/shared';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from '@/lib/format';

import { fuelQuantityUnit } from '../utils/fuel-unit';

type FuelLogRowProps = {
  log: FuelLog;
  fuelType: FuelType;
  /** km per unit since the previous fill; omitted where it can't be known. */
  economy?: number;
  onEdit?: (log: FuelLog) => void;
  onDelete?: (logId: string) => void;
};

/** The columns shared by the header and each row, from md. */
export const FUEL_ROW_GRID =
  'md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_2rem] md:items-center md:gap-4';

/**
 * One fill on one line from md (date and station, quantity, odometer, economy,
 * amount, menu); on a phone, two: the date and amount, then the quantity,
 * reading and economy. No value breaks over two lines.
 */
export function FuelLogRow({ log, fuelType, economy, onEdit, onDelete }: FuelLogRowProps) {
  const unit = fuelQuantityUnit(fuelType);
  const quantity = `${format.number(log.quantity)} ${unit}`;
  const economyText =
    economy === undefined
      ? null
      : `${format.number(economy, { decimals: 1, fixed: true })} km/${unit}`;

  const menu =
    onEdit || onDelete ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Fuel log actions"
            className="-my-1 text-fg-3 hover:text-fg-2 md:h-8 md:w-8"
            size="icon"
            variant="ghost"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onEdit ? (
            <DropdownMenuItem onClick={() => onEdit(log)}>Edit entry</DropdownMenuItem>
          ) : null}
          {onDelete ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(log.id)}
            >
              Delete entry
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <li className={`flex gap-3 px-4 py-3 ${FUEL_ROW_GRID}`} data-testid="fuel-row">
      <div className="min-w-0 flex-1 space-y-1 md:contents">
        <div className="flex items-baseline justify-between gap-3 md:block md:min-w-0">
          <div className="min-w-0">
            <p className="whitespace-nowrap text-ui font-semibold text-fg">
              {format.date(log.date)}
            </p>
            {log.location ? (
              <p className="flex items-start gap-1 text-caption text-fg-3">
                <MapPin aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="min-w-0 truncate">{log.location}</span>
              </p>
            ) : null}
          </div>
          <p className="whitespace-nowrap text-ui font-semibold tabular-nums text-fg md:hidden">
            {format.money(log.totalCost)}
          </p>
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-small tabular-nums text-fg-3 md:contents">
          <span className="whitespace-nowrap md:text-ui md:text-fg-2">{quantity}</span>
          <span className="whitespace-nowrap md:text-ui md:text-fg-2">
            {format.odometer(log.odometer)}
          </span>
          {economyText ? (
            <span className="whitespace-nowrap font-medium text-fg-2 md:text-ui">
              {economyText}
            </span>
          ) : (
            <span aria-hidden="true" className="hidden md:inline">
              –
            </span>
          )}
        </p>
        <p className="hidden whitespace-nowrap text-right text-ui font-semibold tabular-nums text-fg md:block">
          {format.money(log.totalCost)}
        </p>
      </div>
      <div className="shrink-0 md:justify-self-end">{menu}</div>
    </li>
  );
}
