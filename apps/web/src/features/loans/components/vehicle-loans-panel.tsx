import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { CreateVehicleLoanInput, VehicleLoan } from '@vehicle-vault/shared';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { Button, buttonVariants } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { useCreateLoan } from '../hooks/use-create-loan';
import { useDeleteLoan } from '../hooks/use-delete-loan';
import { useVehicleLoans } from '../hooks/use-loans';
import { useUpdateLoan } from '../hooks/use-update-loan';
import { formatCurrencyInr } from '../utils/compute-emi';
import { LoanCard } from './loan-card';
import { LoanDetailDialog } from './loan-detail-dialog';
import { LoanForm } from './loan-form';

type Props = {
  vehicleId: string;
  vehicleLabel?: string;
};

export function VehicleLoansPanel({ vehicleId, vehicleLabel }: Props) {
  const query = useVehicleLoans(vehicleId);
  const createMutation = useCreateLoan(vehicleId);
  const updateMutation = useUpdateLoan();
  const deleteMutation = useDeleteLoan();

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<VehicleLoan | null>(null);
  const [loanToEdit, setLoanToEdit] = useState<VehicleLoan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<VehicleLoan | null>(null);

  const loans = query.data ?? [];

  const totals = useMemo(
    () =>
      loans.reduce(
        (acc, loan) => ({
          emi: acc.emi + (loan.status === 'active' ? loan.emiAmount : 0),
          outstanding: acc.outstanding + loan.outstandingBalance,
          interestPaid: acc.interestPaid + loan.interestPaidToDate,
        }),
        { emi: 0, outstanding: 0, interestPaid: 0 },
      ),
    [loans],
  );

  const handleCreate = async (input: CreateVehicleLoanInput) => {
    try {
      await createMutation.mutateAsync(input);
      appToast.success({ title: 'Loan added' });
      setCreateOpen(false);
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not save loan') });
    }
  };

  const handleEdit = async (input: CreateVehicleLoanInput) => {
    if (!loanToEdit) return;
    try {
      await updateMutation.mutateAsync({ id: loanToEdit.id, input });
      appToast.success({ title: 'Loan updated' });
      setLoanToEdit(null);
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not update loan') });
    }
  };

  const handleDelete = async () => {
    if (!loanToDelete) return;
    try {
      await deleteMutation.mutateAsync(loanToDelete.id);
      appToast.success({ title: 'Loan removed' });
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not delete loan') });
    } finally {
      setLoanToDelete(null);
    }
  };

  if (query.isLoading) {
    return <LoadingState title="Loans" description="Loading loans for this vehicle…" />;
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load loans"
        description={getApiErrorMessage(query.error, 'Failed to load loans')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Vehicle loans</h2>
          <p className="text-sm text-slate-500">Financing tied to this vehicle.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/loans" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            View all loans
          </Link>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Add loan
          </Button>
        </div>
      </div>

      {loans.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryStat label="Monthly EMI (active)" value={formatCurrencyInr(totals.emi)} />
          <SummaryStat label="Outstanding" value={formatCurrencyInr(totals.outstanding)} />
          <SummaryStat label="Interest paid" value={formatCurrencyInr(totals.interestPaid)} />
        </div>
      ) : null}

      {!loans.length ? (
        <EmptyState
          title="No loans yet"
          description="Add a loan to track EMI, outstanding balance, and total interest for this vehicle."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
          {loans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onDelete={setLoanToDelete}
              onManage={setSelectedLoan}
              onEdit={setLoanToEdit}
            />
          ))}
        </div>
      )}

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => !open && setCreateOpen(false)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add loan to {vehicleLabel ?? 'vehicle'}</DialogTitle>
            <DialogDescription>
              EMI, interest, and outstanding balance are computed automatically.
            </DialogDescription>
          </DialogHeader>
          <LoanForm
            isSubmitting={createMutation.isPending}
            onSubmit={handleCreate}
            submitError={
              createMutation.isError
                ? getApiErrorMessage(createMutation.error, 'Could not save loan')
                : null
            }
          />
        </DialogContent>
      </Dialog>

      <Dialog open={loanToEdit !== null} onOpenChange={(open) => !open && setLoanToEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit loan</DialogTitle>
            <DialogDescription>
              {loanToEdit?.status === 'closed' ? 'Closed loan' : 'Update terms or notes.'}
            </DialogDescription>
          </DialogHeader>
          {loanToEdit ? (
            <LoanForm
              key={loanToEdit.id}
              isSubmitting={updateMutation.isPending}
              onSubmit={handleEdit}
              submitLabel="Save changes"
              submitError={
                updateMutation.isError
                  ? getApiErrorMessage(updateMutation.error, 'Could not update loan')
                  : null
              }
              initialValues={{
                lender: loanToEdit.lender,
                accountNumber: loanToEdit.accountNumber ?? '',
                principal: loanToEdit.principal,
                interestRate: loanToEdit.interestRate,
                tenureMonths: loanToEdit.tenureMonths,
                startDate: loanToEdit.startDate.slice(0, 10),
                notes: loanToEdit.notes ?? '',
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <LoanDetailDialog
        loan={selectedLoan ? loans.find((l) => l.id === selectedLoan.id) ?? selectedLoan : null}
        vehicleLabel={vehicleLabel}
        onOpenChange={(open) => !open && setSelectedLoan(null)}
      />

      <AlertDialog
        open={loanToDelete !== null}
        onOpenChange={(open) => !open && setLoanToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete loan?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes loan from analytics and TCO. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
