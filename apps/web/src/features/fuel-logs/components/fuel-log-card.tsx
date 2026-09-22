import { Fuel, MapPin, MoreVertical } from 'lucide-react';
import type { FuelLog } from '@vehicle-vault/shared';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type FuelLogCardProps = {
  log: FuelLog;
  onEdit?: (log: FuelLog) => void;
  onDelete?: (logId: string) => void;
};

export function FuelLogCard({ log, onEdit, onDelete }: FuelLogCardProps) {
  // The card fills anything from a phone to half a desktop panel, so its figures move
  // beside the text by the card's own width, not the screen's. There they take about
  // 380px with the menu, so they wait for @2xl (42rem), which leaves the text about
  // 200px, as @xl does on a service record's card.
  return (
    <Card className="@container overflow-hidden border-slate-200/60 bg-white/70 shadow-premium-sm transition-all duration-300 hover:border-primary/20 hover:bg-white hover:shadow-premium-md">
      <div className="flex flex-col @2xl:flex-row @2xl:items-center">
        {/* Main Info */}
        <div className="flex flex-1 items-center gap-4 p-4 sm:p-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
            <Fuel className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-slate-900">
                {log.quantity.toLocaleString('en-IN')} L Fuel Fill
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-slate-500">
              <span>{formatDate(log.date)}</span>
              {log.location && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {log.location}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 p-4 @2xl:border-l @2xl:border-t-0 @2xl:bg-transparent @2xl:px-6 @2xl:py-0">
          <div className="flex items-center gap-8 @2xl:gap-10">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Odometer
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-slate-700">
                {log.odometer.toLocaleString('en-IN')} km
              </p>
            </div>

            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Price/L
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-slate-700">
                {formatCurrency(log.price)}
              </p>
            </div>

            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Total Cost
              </p>
              <p className="text-[13px] font-bold tabular-nums text-primary">
                {formatCurrency(log.totalCost)}
              </p>
            </div>
          </div>

          {onEdit || onDelete ? (
            <div className="ml-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-slate-600"
                    aria-label="Fuel log actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit ? (
                    <DropdownMenuItem onClick={() => onEdit(log)}>Edit Entry</DropdownMenuItem>
                  ) : null}
                  {onDelete ? (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(log.id)}
                    >
                      Delete Entry
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
