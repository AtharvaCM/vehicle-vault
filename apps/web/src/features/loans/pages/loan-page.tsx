import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import type { CreateVehicleLoanInput, VehicleLoan } from '@vehicle-vault/shared';
import { MoreHorizontal } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { PageContainer } from '@/components/layout/page-container';
import { Chart } from '@/components/shared/chart';
import { ErrorState } from '@/components/shared/error-state';
import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { Money } from '@/components/shared/money';
import { PageTitle } from '@/components/shared/page-title';
import { SectionHeader } from '@/components/shared/section-header';
import { StatusPill } from '@/components/shared/status-pill';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';
import { getVehicleDisplayName } from '@/features/vehicles/utils/get-vehicle-display-name';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

import { LoanAttachmentsSection } from '../components/loan-attachments-section';
import { LoanForm } from '../components/loan-form';
import { useAddPrepayment, useDeletePrepayment, useForecloseLoan } from '../hooks/use-loan-actions';
import { useLoanSchedule } from '../hooks/use-loan-schedule';
import { useLoan } from '../hooks/use-loans';
import { useUpdateLoan } from '../hooks/use-update-loan';

const prepaymentSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  amount: z.number({ error: 'Enter the amount prepaid' }).positive('Amount must be more than 0'),
  notes: z.string().trim().optional(),
});

type PrepaymentFormValues = z.infer<typeof prepaymentSchema>;

const todayInput = () => new Date().toISOString().split('T')[0];

/** "2026-09": the schedule's key for the month a date falls in. */
function periodOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * When the next EMI falls: the loan's day of the month, this month if it has
 * not passed yet, else next month. None once the loan has ended or closed.
 */
export function nextEmiDate(
  loan: Pick<VehicleLoan, 'startDate' | 'endDate' | 'status'>,
  now = new Date(),
) {
  if (loan.status !== 'active') return null;
  const day = new Date(loan.startDate).getDate();
  const candidate = new Date(now.getFullYear(), now.getMonth(), day);
  if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return candidate <= new Date(loan.endDate) ? candidate : null;
}

type LoanPageProps = { loanId: string };

/**
 * One loan, as its owner reads it: what is left, how far along it is and when
 * the next EMI falls, the balance over time with today on it (or what each EMI
 * pays), then its papers, its terms and its prepayments.
 */
export function LoanPage({ loanId }: LoanPageProps) {
  const loanQuery = useLoan(loanId);
  const loan = loanQuery.data;
  const vehicleQuery = useVehicle(loan?.vehicleId ?? '');

  if (loanQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle description="Loading this loan." title="Loan" />
        <LoadingState description="Getting the loan's schedule." title="Loading loan" />
      </PageContainer>
    );
  }

  if (loanQuery.isError || !loan) {
    const notFound = loanQuery.error instanceof ApiError && loanQuery.error.status === 404;
    return (
      <PageContainer>
        <PageTitle
          description="Loans are only shown to the vehicle's owner."
          title={notFound ? 'Loan not found' : 'Unable to load loan'}
        />
        <ErrorState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/costs">
              Back to Costs
            </Link>
          }
          description={
            notFound
              ? "This loan isn't in your garage, or it belongs to a vehicle shared with you."
              : "We couldn't load this loan. Try again in a moment."
          }
          title={notFound ? 'Loan not found' : 'Unable to load loan'}
        />
      </PageContainer>
    );
  }

  const vehicleName = vehicleQuery.data ? getVehicleDisplayName(vehicleQuery.data) : undefined;

  return <LoanBody loan={loan} vehicleName={vehicleName} />;
}

function LoanBody({ loan, vehicleName }: { loan: VehicleLoan; vehicleName: string | undefined }) {
  const prepayRef = useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmForeclose, setConfirmForeclose] = useState(false);
  const updateMutation = useUpdateLoan();
  const foreclose = useForecloseLoan(loan.id);
  const isActive = loan.status === 'active';
  const repaid =
    loan.principal > 0
      ? Math.min(100, Math.round((loan.principalPaidToDate / loan.principal) * 100))
      : 0;
  const nextEmi = nextEmiDate(loan);

  async function handleEdit(input: CreateVehicleLoanInput) {
    try {
      await updateMutation.mutateAsync({ id: loan.id, input });
      appToast.success({ title: 'Loan updated' });
      setIsEditing(false);
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not update loan') });
    }
  }

  async function handleForeclose() {
    try {
      await foreclose.mutateAsync({});
      appToast.success({ title: 'Loan foreclosed' });
      setConfirmForeclose(false);
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not foreclose loan') });
    }
  }

  return (
    <PageContainer className="pb-10">
      <PageTitle
        actions={
          // One row, even on a phone where the header stacks its actions full width.
          <div className="flex gap-2">
            {isActive ? (
              <Button
                className="flex-1 sm:flex-none"
                onClick={() => {
                  prepayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  prepayRef.current?.focus();
                }}
                type="button"
              >
                Prepay
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="More loan actions"
                  className="shrink-0"
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>Edit loan</DropdownMenuItem>
                {isActive ? (
                  <DropdownMenuItem onClick={() => setConfirmForeclose(true)}>
                    Foreclose
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
        description={`${vehicleName ? `${vehicleName} · ` : ''}${format.enumLabel('loanStatus', loan.status)}`}
        title={loan.lender}
      />

      <section aria-label="Where the loan stands" className="space-y-3" data-testid="loan-hero">
        <p className="text-display font-semibold tracking-tight text-fg">
          <Money value={loan.outstandingBalance} />{' '}
          <span className="text-lead text-fg-2">left</span>
        </p>
        <div
          aria-label={`${repaid}% repaid`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={repaid}
          className="h-2 w-full max-w-xl overflow-hidden rounded-full bg-line-subtle"
          role="progressbar"
        >
          <div className="h-full rounded-full bg-ok" style={{ width: `${repaid}%` }} />
        </div>
        <p className="text-small text-fg-2">
          {repaid}% repaid · {isActive ? 'ends' : 'closed'}{' '}
          {format.date(isActive ? loan.endDate : (loan.closedAt ?? loan.endDate), 'monthYear')}
          {nextEmi ? (
            <>
              {' '}
              · next EMI <Money value={loan.emiAmount} /> on {format.date(nextEmi.toISOString())}
            </>
          ) : null}
        </p>
        {isActive ? null : (
          <StatusPill status="ended">{format.enumLabel('loanStatus', loan.status)}</StatusPill>
        )}
      </section>

      <LoanChartCard loanId={loan.id} />

      <LoanAttachmentsSection loanId={loan.id} />

      <Card>
        <CardHeader className="pb-3">
          <SectionHeader title="Details" />
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-body sm:grid-cols-3">
            <Detail label="Principal" value={<Money value={loan.principal} />} />
            <Detail label="Interest rate" value={`${loan.interestRate}% a year`} />
            <Detail label="Tenure" value={`${loan.tenureMonths} months`} />
            <Detail label="Started" value={format.date(loan.startDate)} />
            <Detail label="EMI" value={<Money value={loan.emiAmount} />} />
            <Detail
              label="Interest paid so far"
              value={<Money value={loan.interestPaidToDate} />}
            />
            <Detail label="Total interest" value={<Money value={loan.totalInterest} />} />
            <Detail label="Total payable" value={<Money value={loan.totalPayable} />} />
            {loan.accountNumber ? <Detail label="Account" value={loan.accountNumber} /> : null}
          </dl>
        </CardContent>
      </Card>

      <Prepayments inputRef={prepayRef} loan={loan} />

      <Dialog onOpenChange={setIsEditing} open={isEditing}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit loan</DialogTitle>
            <DialogDescription>
              {vehicleName ?? ''}
              {loan.status === 'closed' ? ' · closed loan' : ''}
            </DialogDescription>
          </DialogHeader>
          <LoanForm
            initialValues={{
              lender: loan.lender,
              accountNumber: loan.accountNumber ?? '',
              principal: loan.principal,
              interestRate: loan.interestRate,
              tenureMonths: loan.tenureMonths,
              startDate: loan.startDate.slice(0, 10),
              notes: loan.notes ?? '',
            }}
            isSubmitting={updateMutation.isPending}
            key={loan.id}
            onSubmit={handleEdit}
            submitError={
              updateMutation.isError
                ? getApiErrorMessage(updateMutation.error, 'Could not update loan')
                : null
            }
            submitLabel="Save changes"
          />
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setConfirmForeclose} open={confirmForeclose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Foreclose loan?</AlertDialogTitle>
            <AlertDialogDescription>
              Marks the loan as closed today and treats the outstanding{' '}
              {format.money(loan.outstandingBalance)} as paid in full. No further EMIs accrue.
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
    </PageContainer>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-small text-fg-3">{label}</dt>
      <dd className="truncate font-medium text-fg">{value}</dd>
    </div>
  );
}

type ChartView = 'balance' | 'split';

/** The balance over time with today marked, or, toggled, what each EMI pays. */
function LoanChartCard({ loanId }: { loanId: string }) {
  const [view, setView] = useState<ChartView>('balance');
  const query = useLoanSchedule(loanId);
  const data = useMemo(
    () =>
      (query.data ?? []).map((point) => ({
        period: point.period,
        principal: point.principal,
        interest: point.interest,
        prepayment: point.prepayment,
        balance: point.balance,
      })),
    [query.data],
  );
  const hasPrepayment = data.some((point) => point.prepayment > 0);

  return (
    <Card data-testid="loan-chart">
      <CardHeader className="pb-3">
        <SectionHeader
          actions={
            <ToggleGroup
              aria-label="Chart"
              onValueChange={(value) => {
                if (value) setView(value as ChartView);
              }}
              type="single"
              value={view}
            >
              <ToggleGroupItem value="balance">Balance</ToggleGroupItem>
              <ToggleGroupItem value="split">EMI split</ToggleGroupItem>
            </ToggleGroup>
          }
          title={view === 'balance' ? 'Balance over time' : 'What each EMI pays'}
        />
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-small text-fg-3">Loading the schedule…</p>
        ) : query.isError ? (
          <p className="text-small text-late">The schedule could not be loaded.</p>
        ) : !data.length ? (
          <p className="text-small text-fg-2">No schedule yet.</p>
        ) : view === 'balance' ? (
          <Chart
            data={data}
            form="step"
            height={220}
            label="Balance left after each EMI"
            marker={{ at: periodOf(new Date()), label: 'Today' }}
            series={[{ key: 'balance', label: 'Balance', slot: 3 }]}
            xKey="period"
          />
        ) : (
          <Chart
            data={data}
            form="stacked"
            height={220}
            label="What each EMI pays, by month"
            marker={{ at: periodOf(new Date()), label: 'Today' }}
            series={[
              { key: 'principal', label: 'Principal', slot: 1 },
              { key: 'interest', label: 'Interest', slot: 2 },
              ...(hasPrepayment
                ? [{ key: 'prepayment' as const, label: 'Prepayment', slot: 3 as const }]
                : []),
            ]}
            xKey="period"
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Prepayments made so far, and (while the loan runs) the form to add one. */
function Prepayments({
  loan,
  inputRef,
}: {
  loan: VehicleLoan;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const addPrep = useAddPrepayment(loan.id);
  const delPrep = useDeletePrepayment(loan.id);
  const form = useForm<PrepaymentFormValues>({
    resolver: zodResolver(prepaymentSchema),
    defaultValues: { date: todayInput(), amount: undefined, notes: '' },
  });
  const isClosed = loan.status === 'closed';
  const amountField = form.register('amount', { valueAsNumber: true });

  const handleAdd = form.handleSubmit(async (values) => {
    try {
      await addPrep.mutateAsync({
        date: new Date(values.date).toISOString(),
        amount: values.amount,
        notes: values.notes || undefined,
      });
      appToast.success({ title: 'Prepayment added' });
      form.reset({ date: todayInput(), amount: undefined, notes: '' });
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not add prepayment') });
    }
  });

  async function handleDelete(prepaymentId: string) {
    try {
      await delPrep.mutateAsync(prepaymentId);
      appToast.success({ title: 'Prepayment removed' });
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not remove prepayment') });
    }
  }

  return (
    <Card data-testid="loan-prepayments">
      <CardHeader className="pb-3">
        <SectionHeader description="A prepayment shortens the tenure." title="Prepayments" />
      </CardHeader>
      <CardContent className="space-y-3">
        {loan.prepayments.length ? (
          <ul className="divide-y divide-line-subtle text-body">
            {loan.prepayments.map((prepayment) => (
              <li className="flex items-center justify-between py-2" key={prepayment.id}>
                <div>
                  <div className="font-medium text-fg">
                    <Money value={prepayment.amount} />
                  </div>
                  <div className="text-small text-fg-3">
                    {format.date(prepayment.date)}
                    {prepayment.notes ? ` · ${prepayment.notes}` : ''}
                  </div>
                </div>
                <Button
                  className="text-late hover:bg-late-tint hover:text-late"
                  disabled={delPrep.isPending}
                  onClick={() => void handleDelete(prepayment.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-fg-3">None yet.</p>
        )}
        {!isClosed ? (
          <form className="grid gap-3 pt-2 sm:grid-cols-[1fr_1fr_2fr_auto]" onSubmit={handleAdd}>
            <FormField error={form.formState.errors.date?.message} htmlFor="prep-date" label="Date">
              <Input id="prep-date" {...form.register('date')} type="date" />
            </FormField>
            <FormField
              error={form.formState.errors.amount?.message}
              htmlFor="prep-amount"
              label="Amount (₹)"
            >
              <Input
                id="prep-amount"
                min={0}
                step="1"
                type="number"
                {...amountField}
                ref={(node) => {
                  amountField.ref(node);
                  inputRef.current = node;
                }}
              />
            </FormField>
            <FormField
              error={form.formState.errors.notes?.message}
              htmlFor="prep-notes"
              label="Notes (optional)"
            >
              <Input id="prep-notes" {...form.register('notes')} placeholder="Bonus, etc." />
            </FormField>
            <div className="flex items-end">
              <Button disabled={addPrep.isPending} type="submit">
                {addPrep.isPending ? 'Adding…' : 'Add prepayment'}
              </Button>
            </div>
          </form>
        ) : null}
        {addPrep.isError ? (
          <InlineError message={getApiErrorMessage(addPrep.error, 'Could not add prepayment')} />
        ) : null}
      </CardContent>
    </Card>
  );
}
