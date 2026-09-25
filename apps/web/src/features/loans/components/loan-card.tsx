import type { VehicleLoan } from '@vehicle-vault/shared';

import { Figure } from '@/components/shared/figure';
import { Link } from '@tanstack/react-router';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from '@/lib/format';

type LoanCardProps = {
  loan: VehicleLoan;
  vehicleLabel?: string;
  onDelete?: (loan: VehicleLoan) => void;
  onEdit?: (loan: VehicleLoan) => void;
};

export function LoanCard({ loan, vehicleLabel, onDelete, onEdit }: LoanCardProps) {
  const paidPct =
    loan.principal > 0
      ? Math.min(100, Math.round((loan.principalPaidToDate / loan.principal) * 100))
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle className="text-lead">{loan.lender}</CardTitle>
          {vehicleLabel ? (
            <p className="text-caption text-muted-foreground">{vehicleLabel}</p>
          ) : null}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-caption font-medium ${
            loan.status === 'active' ? 'bg-ok-tint text-ok' : 'bg-muted text-muted-foreground'
          }`}
        >
          {format.enumLabel('loanStatus', loan.status)}
        </span>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-ui">
        <div className="grid grid-cols-3 gap-3">
          <Figure label="EMI" value={format.money(loan.emiAmount)} />
          <Figure label="Rate" value={`${loan.interestRate}% /yr`} />
          <Figure label="Tenure" value={`${loan.tenureMonths} mo`} />
          <Figure label="Principal" value={format.money(loan.principal)} />
          <Figure label="Outstanding" value={format.money(loan.outstandingBalance)} />
          <Figure label="Interest paid" value={format.money(loan.interestPaidToDate)} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-caption text-muted-foreground">
            <span>Principal paid</span>
            <span>
              {paidPct}% • {loan.monthsRemaining} mo left
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-ok" style={{ width: `${paidPct}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            <Link
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
              params={{ loanId: loan.id }}
              to="/costs/loans/$loanId"
            >
              Open
            </Link>
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
              className="text-late hover:bg-late-tint hover:text-late"
              onClick={() => onDelete(loan)}
            >
              Delete
            </Button>
          ) : null}
        </div>
        {loan.prepaidToDate > 0 ? (
          <p className="text-caption text-muted-foreground">
            {loan.prepayments.length} prepayment{loan.prepayments.length === 1 ? '' : 's'} · saved
            interest baked in
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
