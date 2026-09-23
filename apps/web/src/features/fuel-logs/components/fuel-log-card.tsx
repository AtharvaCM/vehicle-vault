import { Fuel, MapPin, MoreVertical } from 'lucide-react';
import type { FuelLog } from '@vehicle-vault/shared';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from '@/lib/format';
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
  // 200px, as @xl does on a service record's card. On a phone the card drops its own
  // padding, as the record and reminder cards do, and the figures close up below @md:
  // all three fit beside the menu down to about 350px. None of them breaks mid-value;
  // on a narrower card, a whole figure moves to a second row.
  return (
    <Card className="@container overflow-hidden border-slate-200/60 bg-white/70 p-0 shadow-premium-sm transition-all duration-300 hover:border-primary/20 hover:bg-white hover:shadow-premium-md sm:p-5">
      <div className="flex flex-col @2xl:flex-row @2xl:items-center">
        {/* Main Info */}
        <div className="flex flex-1 items-center gap-4 p-3 sm:p-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
            <Fuel className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-slate-900">{format.number(log.quantity)} L fuel fill</p>
            </div>
            <div className="flex flex-col gap-y-1 text-[13px] font-medium text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
              <span>{format.date(log.date)}</span>
              {log.location && (
                <>
                  <span className="hidden text-slate-300 sm:inline">•</span>
                  <span className="flex items-start gap-1">
                    <MapPin className="mt-1 h-3 w-3 shrink-0" />
                    {log.location}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 p-3 sm:p-4 @2xl:border-l @2xl:border-t-0 @2xl:bg-transparent @2xl:px-6 @2xl:py-0">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 @md:gap-x-8 @2xl:gap-x-10">
            <div className="space-y-0.5">
              <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Odometer
              </p>
              <p className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-700">
                {format.odometer(log.odometer)}
              </p>
            </div>

            <div className="space-y-0.5">
              <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Price/L
              </p>
              <p className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-700">
                {format.money(log.price)}
              </p>
            </div>

            <div className="space-y-0.5">
              <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Total cost
              </p>
              <p className="whitespace-nowrap text-[13px] font-bold tabular-nums text-primary">
                {format.money(log.totalCost)}
              </p>
            </div>
          </div>

          {onEdit || onDelete ? (
            <div className="ml-3 @md:ml-6">
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
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
