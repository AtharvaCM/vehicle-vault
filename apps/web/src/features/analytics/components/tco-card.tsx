import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import type { TcoResponse } from '@vehicle-vault/shared';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { tcoQueryOptions } from '../api/get-tco';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const intFmt = new Intl.NumberFormat('en-IN');

type Props = {
  vehicleId: string;
};

export function TcoCard({ vehicleId }: Props) {
  const query = useQuery(tcoQueryOptions(vehicleId));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-indigo-600" />
          Total cost of ownership
        </CardTitle>
        <CardDescription>Lifetime spend, ₹/km, ₹/month since purchase</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-sm text-slate-500">Loading TCO…</p>
        ) : query.isError ? (
          <p className="text-sm text-red-600">Failed to load TCO.</p>
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

  const figures: { label: string; value: string; emphasis?: boolean }[] = [
    {
      label: tco.totals.tco ? 'Total cost of ownership' : 'Net lifetime spend',
      value: inr.format(Number(tco.totals.tco ?? tco.totals.netSpend)),
      emphasis: true,
    },
    { label: 'Maintenance', value: inr.format(Number(tco.totals.maintenance)) },
    { label: 'Fuel', value: inr.format(Number(tco.totals.fuel)) },
    { label: 'Insurance', value: inr.format(Number(tco.totals.insurance)) },
    ...(loanInterestPaid > 0
      ? [{ label: 'Loan interest paid', value: inr.format(loanInterestPaid) }]
      : []),
    ...(loanOutstanding > 0
      ? [{ label: 'Loan outstanding', value: inr.format(loanOutstanding) }]
      : []),
    { label: 'Insurer reimbursed', value: `− ${inr.format(Number(tco.totals.insurerReimbursed))}` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {figures.map((f) => (
          <div
            key={f.label}
            className={
              f.emphasis
                ? 'rounded-xl border border-indigo-200 bg-indigo-50/60 p-3'
                : 'rounded-xl border border-slate-200 bg-white p-3'
            }
          >
            <p className="text-xs uppercase tracking-wider text-slate-500">{f.label}</p>
            <p
              className={
                f.emphasis
                  ? 'text-xl font-bold text-indigo-700'
                  : 'text-base font-semibold text-slate-800'
              }
            >
              {f.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="₹ / km"
          value={tco.derived.costPerKm ? inr.format(Number(tco.derived.costPerKm)) : '—'}
          hint={`${intFmt.format(tco.kmSincePurchase)} km`}
        />
        <Metric
          label="₹ / month"
          value={tco.derived.costPerMonth ? inr.format(Number(tco.derived.costPerMonth)) : '—'}
          hint={tco.ownershipMonths != null ? `${tco.ownershipMonths} months owned` : 'No purchase date'}
        />
        <Metric
          label="Purchase price"
          value={tco.purchasePrice ? inr.format(Number(tco.purchasePrice)) : '—'}
          hint={tco.purchaseDate ? new Date(tco.purchaseDate).toISOString().slice(0, 10) : 'Not set'}
        />
      </div>

      {!purchaseSet ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-700">
          Add purchase date, price, and odometer in the vehicle form to unlock the full TCO picture.
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}
