import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TcoResponse } from '@vehicle-vault/shared';

import { Figure } from '@/components/shared/figure';
import { Money } from '@/components/shared/money';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from '@/lib/format';

import { tcoQueryOptions } from '../api/get-tco';
import { costPerKmHint } from '../utils/cost-per-km-hint';

type Props = {
  vehicleId: string;
};

export function TcoCard({ vehicleId }: Props) {
  const query = useQuery(tcoQueryOptions(vehicleId));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lead">
          <Wallet className="h-4 w-4 text-brand" />
          Total cost of ownership
        </CardTitle>
        <CardDescription>Lifetime spend, ₹/km, ₹/month since purchase</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-ui text-fg-3">Loading TCO…</p>
        ) : query.isError ? (
          <p className="text-ui text-late">Failed to load TCO.</p>
        ) : !query.data ? null : (
          <TcoBody data={query.data} />
        )}
      </CardContent>
    </Card>
  );
}

function TcoBody({ data: tco }: { data: TcoResponse }) {
  const purchaseSet = tco.purchaseDate || tco.purchasePrice || tco.purchaseOdometer != null;

  const loanInterestPaid = Number(tco.totals.loanInterest);
  const loanOutstanding = Number(tco.totals.loanOutstanding);
  const accessories = Number(tco.totals.accessories);

  const figures: { label: string; value: number; negative?: boolean; emphasis?: boolean }[] = [
    {
      label: tco.totals.tco ? 'Total cost of ownership' : 'Net lifetime spend',
      value: Number(tco.totals.tco ?? tco.totals.netSpend),
      emphasis: true,
    },
    { label: 'Maintenance', value: Number(tco.totals.maintenance) },
    { label: 'Fuel', value: Number(tco.totals.fuel) },
    ...(accessories > 0 ? [{ label: 'Accessories', value: accessories }] : []),
    { label: 'Insurance', value: Number(tco.totals.insurance) },
    ...(loanInterestPaid > 0 ? [{ label: 'Loan interest paid', value: loanInterestPaid }] : []),
    ...(loanOutstanding > 0 ? [{ label: 'Loan outstanding', value: loanOutstanding }] : []),
    {
      label: 'Insurer reimbursed',
      value: Number(tco.totals.insurerReimbursed),
      negative: true,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {figures.map((f) => (
          <div
            key={f.label}
            className={
              f.emphasis
                ? 'rounded-xl border border-brand/30 bg-brand-tint/60 p-3'
                : 'rounded-xl border border-line bg-surface p-3'
            }
          >
            <Figure
              label={f.label}
              value={
                <span className={f.emphasis ? 'text-brand' : undefined}>
                  {f.negative ? '− ' : null}
                  <Money value={f.value} />
                </span>
              }
            />
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          hint={costPerKmHint(tco)}
          label="₹ / km"
          value={
            <Money
              decimals={1}
              value={tco.derived.costPerKm ? Number(tco.derived.costPerKm) : null}
            />
          }
        />
        <Metric
          hint={
            tco.ownershipMonths != null ? `${tco.ownershipMonths} months owned` : 'No purchase date'
          }
          label="₹ / month"
          value={
            <Money value={tco.derived.costPerMonth ? Number(tco.derived.costPerMonth) : null} />
          }
        />
        <Metric
          hint={tco.purchaseDate ? format.date(tco.purchaseDate) : 'Not set'}
          label="Purchase price"
          value={<Money value={tco.purchasePrice ? Number(tco.purchasePrice) : null} />}
        />
      </div>

      {!purchaseSet ? (
        <p className="rounded-lg border border-soon/30 bg-soon-tint/70 px-3 py-2 text-caption text-soon">
          Add purchase date, price, and odometer in the vehicle form to unlock the full TCO picture.
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <Figure hint={hint} label={label} value={value} />
    </div>
  );
}
