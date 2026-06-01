import { useMemo, useRef, useState } from 'react';
import type { CreateVehicleLoanInput, VehicleLoan } from '@vehicle-vault/shared';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { LoanCard } from '../components/loan-card';
import { LoanDetailDialog } from '../components/loan-detail-dialog';
import { LoanForm } from '../components/loan-form';
import { useCreateLoan } from '../hooks/use-create-loan';
import { useDeleteLoan } from '../hooks/use-delete-loan';
import { useLoans } from '../hooks/use-loans';
import { useScanLoanDocument, useLoanScanStatus } from '../hooks/use-scan-loan-document';
import { useUpdateLoan } from '../hooks/use-update-loan';
import type { LoanFormValues } from '../schemas/loan-form.schema';
import { formatCurrencyInr } from '../utils/compute-emi';

export function LoansPage() {
  const loansQuery = useLoans();
  const vehiclesQuery = useVehicles();
  const deleteMutation = useDeleteLoan();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<VehicleLoan | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<VehicleLoan | null>(null);
  const [loanToEdit, setLoanToEdit] = useState<VehicleLoan | null>(null);
  const [scannedDraft, setScannedDraft] = useState<Partial<LoanFormValues> | null>(null);
  const [scanFormKey, setScanFormKey] = useState(0);
  const scanFileInputRef = useRef<HTMLInputElement | null>(null);
  const updateMutation = useUpdateLoan();
  const scanMutation = useScanLoanDocument();
  const scanStatus = useLoanScanStatus();

  const vehicles = vehiclesQuery.data ?? [];
  const loans = loansQuery.data ?? [];

  const vehicleLabelById = useMemo(
    () =>
      Object.fromEntries(
        vehicles.map((v) => [
          v.id,
          `${v.nickname?.trim() || `${v.make} ${v.model}`} • ${v.registrationNumber}`,
        ]),
      ),
    [vehicles],
  );

  const totals = useMemo(() => {
    return loans.reduce(
      (acc, loan) => ({
        emi: acc.emi + (loan.status === 'active' ? loan.emiAmount : 0),
        outstanding: acc.outstanding + loan.outstandingBalance,
        interestPaid: acc.interestPaid + loan.interestPaidToDate,
      }),
      { emi: 0, outstanding: 0, interestPaid: 0 },
    );
  }, [loans]);

  const createMutation = useCreateLoan(selectedVehicleId ?? '');

  const handleCreate = async (input: CreateVehicleLoanInput) => {
    if (!selectedVehicleId) {
      appToast.error({ title: 'Pick a vehicle first' });
      return;
    }
    try {
      await createMutation.mutateAsync(input);
      appToast.success({ title: 'Loan added' });
      setCreateOpen(false);
      setSelectedVehicleId(null);
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

  const handleScanFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const draft = await scanMutation.mutateAsync(file);
      const initial: Partial<LoanFormValues> = {
        lender: draft.lender,
        accountNumber: draft.accountNumber,
        principal: draft.principal,
        interestRate: draft.interestRate,
        tenureMonths: draft.tenureMonths,
        startDate: draft.startDate ? draft.startDate.slice(0, 10) : undefined,
        notes: draft.notes,
      };
      setScannedDraft(initial);
      setScanFormKey((k) => k + 1);
      appToast.success({ title: 'Document scanned — review and save' });
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Scan failed') });
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

  if (loansQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingState title="Vehicle loans" description="Loading your loans…" />
      </PageContainer>
    );
  }
  if (loansQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Could not load loans"
          description={getApiErrorMessage(loansQuery.error, 'Failed to load loans')}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex items-start justify-between gap-4">
        <PageTitle
          title="Vehicle loans"
          description="Track financing across vehicles to see real cost of ownership."
        />
        <Button
          onClick={() => {
            setCreateOpen(true);
            setSelectedVehicleId(vehicles[0]?.id ?? null);
          }}
          disabled={!vehicles.length}
        >
          Add loan
        </Button>
      </div>

      {loans.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SummaryStat label="Monthly EMI (active)" value={formatCurrencyInr(totals.emi)} />
          <SummaryStat label="Outstanding" value={formatCurrencyInr(totals.outstanding)} />
          <SummaryStat label="Interest paid" value={formatCurrencyInr(totals.interestPaid)} />
        </div>
      ) : null}

      <div className="mt-6">
        {!loans.length ? (
          <EmptyState
            title="No loans yet"
            description="Add a loan to include EMI and interest in your cost analysis."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {loans.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                vehicleLabel={vehicleLabelById[loan.vehicleId]}
                onDelete={setLoanToDelete}
                onManage={setSelectedLoan}
                onEdit={setLoanToEdit}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setScannedDraft(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add vehicle loan</DialogTitle>
            <DialogDescription>
              EMI, interest, and outstanding balance are computed automatically.
            </DialogDescription>
          </DialogHeader>

          {scanStatus.data?.available ? (
            <div className="flex items-center justify-between rounded-md border border-indigo-200 bg-indigo-50/60 p-3 text-sm">
              <div>
                <div className="font-medium text-indigo-900">Scan sanction letter / agreement</div>
                <div className="text-xs text-indigo-700">
                  AI extracts lender, principal, rate, tenure, start date.
                </div>
              </div>
              <input
                ref={scanFileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                className="hidden"
                onChange={handleScanFileChange}
              />
              <Button
                variant="outline"
                className="border-indigo-300 text-indigo-900 hover:bg-indigo-100"
                disabled={scanMutation.isPending}
                onClick={() => scanFileInputRef.current?.click()}
              >
                {scanMutation.isPending ? 'Scanning…' : 'Scan document'}
              </Button>
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground/90">
                Vehicle
              </label>
              <Select
                value={selectedVehicleId ?? undefined}
                onValueChange={(v) => setSelectedVehicleId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {vehicleLabelById[v.id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <LoanForm
              key={`create-${scanFormKey}`}
              isSubmitting={createMutation.isPending}
              onSubmit={handleCreate}
              submitError={
                createMutation.isError
                  ? getApiErrorMessage(createMutation.error, 'Could not save loan')
                  : null
              }
              initialValues={scannedDraft ?? undefined}
            />
          </div>
        </DialogContent>
      </Dialog>

      <LoanDetailDialog
        loan={selectedLoan ? loans.find((l) => l.id === selectedLoan.id) ?? selectedLoan : null}
        vehicleLabel={selectedLoan ? vehicleLabelById[selectedLoan.vehicleId] : undefined}
        onOpenChange={(open) => !open && setSelectedLoan(null)}
      />

      <Dialog
        open={loanToEdit !== null}
        onOpenChange={(open) => !open && setLoanToEdit(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit loan</DialogTitle>
            <DialogDescription>
              {loanToEdit ? vehicleLabelById[loanToEdit.vehicleId] ?? '' : ''}
              {loanToEdit?.status === 'closed' ? ' · closed loan' : ''}
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
    </PageContainer>
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
