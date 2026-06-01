import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { VehicleLoan } from '@vehicle-vault/shared';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import {
  useAddPrepayment,
  useDeletePrepayment,
  useForecloseLoan,
} from '../hooks/use-loan-actions';
import { formatCurrencyInr } from '../utils/compute-emi';
import { LoanAttachmentsSection } from './loan-attachments-section';
import { LoanScheduleChart } from './loan-schedule-chart';

type Props = {
  loan: VehicleLoan | null;
  vehicleLabel?: string;
  onOpenChange: (open: boolean) => void;
};

const prepaymentSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  amount: z.number().positive('Amount must be positive'),
  notes: z.string().trim().optional(),
});

type PrepaymentFormValues = z.infer<typeof prepaymentSchema>;

export function LoanDetailDialog({ loan, vehicleLabel, onOpenChange }: Props) {
  const [confirmForeclose, setConfirmForeclose] = useState(false);
  const addPrep = useAddPrepayment(loan?.id ?? '');
  const delPrep = useDeletePrepayment(loan?.id ?? '');
  const foreclose = useForecloseLoan(loan?.id ?? '');

  const form = useForm<PrepaymentFormValues>({
    resolver: zodResolver(prepaymentSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      notes: '',
    },
  });

  if (!loan) return null;

  const isClosed = loan.status === 'closed';

  const handleAddPrepayment = form.handleSubmit(async (values) => {
    try {
      await addPrep.mutateAsync({
        date: new Date(values.date).toISOString(),
        amount: values.amount,
        notes: values.notes || undefined,
      });
      appToast.success({ title: 'Prepayment added' });
      form.reset({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        notes: '',
      });
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not add prepayment') });
    }
  });

  const handleDeletePrepayment = async (prepaymentId: string) => {
    try {
      await delPrep.mutateAsync(prepaymentId);
      appToast.success({ title: 'Prepayment removed' });
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not remove prepayment') });
    }
  };

  const handleForeclose = async () => {
    try {
      await foreclose.mutateAsync({});
      appToast.success({ title: 'Loan foreclosed' });
      setConfirmForeclose(false);
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not foreclose loan') });
    }
  };

  return (
    <>
      <Dialog open={loan !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {loan.lender}
              {vehicleLabel ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  • {vehicleLabel}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              EMI {formatCurrencyInr(loan.emiAmount)} · {loan.interestRate}%/yr ·{' '}
              {loan.tenureMonths} mo
              {isClosed && loan.closedAt
                ? ` · closed ${new Date(loan.closedAt).toLocaleDateString()}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Principal" value={formatCurrencyInr(loan.principal)} />
            <Stat label="Outstanding" value={formatCurrencyInr(loan.outstandingBalance)} />
            <Stat label="Interest paid" value={formatCurrencyInr(loan.interestPaidToDate)} />
            <Stat label="Prepaid" value={formatCurrencyInr(loan.prepaidToDate)} />
          </div>

          <section className="space-y-2 rounded-md border border-border p-4">
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Amortization</h3>
              <span className="text-xs text-muted-foreground">
                Principal vs interest per EMI · balance line
              </span>
            </header>
            <LoanScheduleChart loanId={loan.id} />
          </section>

          <LoanAttachmentsSection loanId={loan.id} />

          <section className="space-y-3 rounded-md border border-border p-4">
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Prepayments</h3>
              <span className="text-xs text-muted-foreground">
                {loan.prepayments.length} total · shortens tenure
              </span>
            </header>

            {loan.prepayments.length ? (
              <ul className="divide-y divide-border text-sm">
                {loan.prepayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">{formatCurrencyInr(p.amount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(p.date).toLocaleDateString()}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      disabled={delPrep.isPending}
                      onClick={() => handleDeletePrepayment(p.id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No prepayments yet.</p>
            )}

            {!isClosed ? (
              <form className="grid gap-3 pt-2 sm:grid-cols-[1fr_1fr_2fr_auto]" onSubmit={handleAddPrepayment}>
                <FormField
                  htmlFor="prep-date"
                  label="Date"
                  error={form.formState.errors.date?.message}
                >
                  <Input id="prep-date" {...form.register('date')} type="date" />
                </FormField>
                <FormField
                  htmlFor="prep-amount"
                  label="Amount (₹)"
                  error={form.formState.errors.amount?.message}
                >
                  <Input
                    id="prep-amount"
                    {...form.register('amount', { valueAsNumber: true })}
                    type="number"
                    min={0}
                    step="1"
                  />
                </FormField>
                <FormField
                  htmlFor="prep-notes"
                  label="Notes (optional)"
                  error={form.formState.errors.notes?.message}
                >
                  <Input id="prep-notes" {...form.register('notes')} placeholder="Bonus, etc." />
                </FormField>
                <div className="flex items-end">
                  <Button type="submit" disabled={addPrep.isPending}>
                    {addPrep.isPending ? 'Adding…' : 'Add'}
                  </Button>
                </div>
              </form>
            ) : null}

            {addPrep.isError ? (
              <InlineError
                message={getApiErrorMessage(addPrep.error, 'Could not add prepayment')}
              />
            ) : null}
          </section>

          {!isClosed ? (
            <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <div>
                <div className="font-medium text-amber-900">Foreclose loan</div>
                <div className="text-xs text-amber-700">
                  Pay off outstanding {formatCurrencyInr(loan.outstandingBalance)} and close.
                </div>
              </div>
              <Button
                variant="outline"
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
                onClick={() => setConfirmForeclose(true)}
              >
                Foreclose
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmForeclose} onOpenChange={setConfirmForeclose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Foreclose loan?</AlertDialogTitle>
            <AlertDialogDescription>
              Marks loan as closed today and treats outstanding{' '}
              {formatCurrencyInr(loan.outstandingBalance)} as paid in full. No further EMIs accrue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={foreclose.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={foreclose.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleForeclose();
              }}
            >
              {foreclose.isPending ? 'Closing…' : 'Foreclose'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
