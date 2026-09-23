import type { FuelEconomyUnit, VehicleFuelEconomy } from '@vehicle-vault/shared';
import { Fuel } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

import { useVehicleFuelEconomy } from '../hooks/use-vehicle-fuel-economy';

/** What a fill is measured in, for "over 450 km and 30 L". */
const QUANTITY_UNIT: Record<FuelEconomyUnit, string> = {
  'km/L': 'L',
  'km/kg': 'kg',
  'km/kWh': 'kWh',
};

function formatFigure(value: number) {
  return format.number(value, { decimals: 1, fixed: true });
}

/** "14% below the claim", "6% above", or level with it. */
function describeDifference(differencePercent: number) {
  if (differencePercent === 0) return 'level with the claim';
  const direction = differencePercent < 0 ? 'below' : 'above';
  return `${Math.abs(differencePercent)}% ${direction} the claim`;
}

/** Said instead of a number until there are two fills to measure between. */
function missingFills(economy: VehicleFuelEconomy) {
  if (economy.usableFills === 0) {
    return 'No fill-ups with an odometer reading yet. Log two and this shows what the vehicle really returns.';
  }
  return 'One fill-up logged. Log the next one with its odometer reading: economy is measured between fills.';
}

function EconomyFigures({ economy }: { economy: VehicleFuelEconomy }) {
  const { achieved, claimed, differencePercent, unit } = economy;

  return (
    <div className="space-y-3">
      {achieved ? (
        <div>
          <p className="text-3xl font-black tabular-nums text-slate-900">
            {formatFigure(achieved.value)}{' '}
            <span className="text-base font-bold text-slate-500">{unit}</span>
          </p>
          <p className="text-[13px] text-slate-500">
            Real, over {format.distance(achieved.distanceKm)} and {format.number(achieved.quantity)}{' '}
            {QUANTITY_UNIT[unit]}
          </p>
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed text-slate-500">{missingFills(economy)}</p>
      )}

      {claimed !== null ? (
        <p className="text-[13px] text-slate-600">
          Claimed {formatFigure(claimed)} {unit}
          {differencePercent !== null ? (
            <>
              {' · '}
              <span
                className={cn(
                  'font-semibold',
                  differencePercent < 0 ? 'text-amber-700' : 'text-emerald-700',
                )}
              >
                {describeDifference(differencePercent)}
              </span>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/**
 * What the vehicle actually returns against what its variant claims: the
 * question every owner asks and no brochure answers. Measured from the fuel
 * logs, fill to fill; see the API's computeFuelEconomy.
 */
export function FuelEconomyCard({ vehicleId }: { vehicleId: string }) {
  const economyQuery = useVehicleFuelEconomy(vehicleId);

  return (
    <Card className="border-slate-200/60 bg-white/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Fuel aria-hidden="true" className="h-4 w-4 text-primary" />
          Real fuel economy
        </CardTitle>
        <CardDescription>What it returns, against what it claims.</CardDescription>
      </CardHeader>
      <CardContent>
        {economyQuery.isPending ? (
          <p className="text-[13px] text-slate-400">Working it out…</p>
        ) : economyQuery.isError ? (
          <p className="text-[13px] text-slate-500">Couldn&apos;t work out the fuel economy.</p>
        ) : (
          <EconomyFigures economy={economyQuery.data} />
        )}
      </CardContent>
    </Card>
  );
}
