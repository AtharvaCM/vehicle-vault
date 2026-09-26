import { Fuel, MapPin, MoreVertical } from 'lucide-react';
import type { FuelLog, FuelType } from '@vehicle-vault/shared';

import { Figure } from '@/components/shared/figure';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from '@/lib/format';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { fuelQuantityUnit, fuelNoun } from '../utils/fuel-unit';

type FuelLogCardProps = {
  log: FuelLog;
  fuelType: FuelType;
  onEdit?: (log: FuelLog) => void;
  onDelete?: (logId: string) => void;
};

/** "8 L fuel fill", "8 kg fuel fill", or "8 kWh charge" for an EV. */
function fillHeadline(quantity: number, fuelType: FuelType): string {
  const unit = fuelQuantityUnit(fuelType);
  const noun = fuelNoun(fuelType);
  const suffix = noun === 'Charge' ? 'charge' : 'fuel fill';

  return `${format.number(quantity)} ${unit} ${suffix}`;
}

export function FuelLogCard({ log, fuelType, onEdit, onDelete }: FuelLogCardProps) {
  const unit = fuelQuantityUnit(fuelType);
  // The card fills anything from a phone to half a desktop panel, so its figures move
  // beside the text by the card's own width, not the screen's. There they take about
  // 380px with the menu, so they wait for @2xl (42rem), which leaves the text about
  // 200px, as @xl does on a service record's card. On a phone the card drops its own
  // padding, as the record and reminder cards do, and the figures close up below @md:
  // all three fit beside the menu down to about 350px. None of them breaks mid-value;
  // on a narrower card, a whole figure moves to a second row.
  return (
    <Card className="@container overflow-hidden border-line/60 bg-surface/70 p-0 transition-colors hover:border-primary/20 hover:bg-surface sm:p-5">
      <div className="flex flex-col @2xl:flex-row @2xl:items-center">
        {/* Main Info */}
        <div className="flex flex-1 items-center gap-4 p-3 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
            <Fuel className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-fg">{fillHeadline(log.quantity, fuelType)}</p>
            </div>
            <div className="flex flex-col gap-y-1 text-small font-medium text-fg-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
              <span>{format.date(log.date)}</span>
              {log.location && (
                <>
                  <span className="hidden text-fg-3 sm:inline">•</span>
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
        <div className="flex items-center justify-between border-t border-line-subtle bg-page/30 p-3 sm:p-4 @2xl:border-l @2xl:border-t-0 @2xl:bg-transparent max-sm:@2xl:px-6 max-sm:@2xl:py-0">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 @md:gap-x-8 @2xl:gap-x-10">
            <Figure
              className="whitespace-nowrap"
              label="Odometer"
              value={format.odometer(log.odometer)}
            />
            <Figure
              className="whitespace-nowrap"
              label={`Price/${unit}`}
              value={format.money(log.price)}
            />
            <Figure
              className="whitespace-nowrap"
              label="Total cost"
              value={<span className="text-brand">{format.money(log.totalCost)}</span>}
            />
          </div>

          {onEdit || onDelete ? (
            <div className="ml-3 @md:ml-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-fg-3 hover:text-fg-2 md:h-8 md:w-8"
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
