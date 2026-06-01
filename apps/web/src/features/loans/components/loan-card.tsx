import type { VehicleLoan } from '@vehicle-vault/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { formatCurrencyInr } from '../utils/compute-emi';

type LoanCardProps = {
  loan: VehicleLoan;
  vehicleLabel?: string;
  onDelete?: (loan: VehicleLoan) => void;
  onManage?: (loan: VehicleLoan) => void;
  onEdit?: (loan: VehicleLoan) => void;
};

export function LoanCard({ loan, vehicleLabel, onDelete, onManage, onEdit }: LoanCardProps) {
  const paidPct =
    loan.principal > 0
      ? Math.min(100, Math.round((loan.principalPaidToDate / loan.principal) * 100))
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle className="text-base">{loan.lender}</CardTitle>
          {vehicleLabel ? (
            <p className="text-xs text-muted-foreground">{vehicleLabel}</p>
          ) : null}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            loan.status === 'active'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {loan.status}
        </span>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm">
        <div className="grid grid-cols-3 gap-3">
          <Metric label="EMI" value={formatCurrencyInr(loan.emiAmount)} />
          <Metric label="Rate" value={`${loan.interestRate}% /yr`} />
          <Metric label="Tenure" value={`${loan.tenureMonths} mo`} />
          <Metric label="Principal" value={formatCurrencyInr(loan.principal)} />
          <Metric label="Outstanding" value={formatCurrencyInr(loan.outstandingBalance)} />
          <Metric label="Interest paid" value={formatCurrencyInr(loan.interestPaidToDate)} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Principal paid</span>
            <span>
              {paidPct}% • {loan.monthsRemaining} mo left
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            {onManage ? (
              <Button size="sm" variant="outline" onClick={() => onManage(loan)}>
                Manage
              </Button>
            ) : null}
            {onEdit ? (
              <Button size="sm" variant="ghost" onClick={() => onEdit(loan)}>
                Edit
              </Button>
            ) : null}
          </div>
          {onDelete ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onClick={() => onDelete(loan)}
            >
              Delete
            </Button>
          ) : null}
        </div>
        {loan.prepaidToDate > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {loan.prepayments.length} prepayment{loan.prepayments.length === 1 ? '' : 's'} ·{' '}
            saved interest baked in
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground">{value}</div>
    </div>
  );
}
