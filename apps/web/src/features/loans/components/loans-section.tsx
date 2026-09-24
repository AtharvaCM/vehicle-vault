import { useMemo, useRef, useState } from 'react';
import type { CreateVehicleLoanInput, VehicleLoan } from '@vehicle-vault/shared';

import { EmptyState } from '@/components/shared/empty-state';
import { Figure } from '@/components/shared/figure';
import { Money } from '@/components/shared/money';
import { SectionHeader } from '@/components/shared/section-header';
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

import { LoanCard } from './loan-card';
import { LoanDetailDialog } from './loan-detail-dialog';
import { LoanForm } from './loan-form';
import { useCreateLoan } from '../hooks/use-create-loan';
import { useDeleteLoan } from '../hooks/use-delete-loan';
import { useLoans } from '../hooks/use-loans';
import { useScanLoanDocument, useLoanScanStatus } from '../hooks/use-scan-loan-document';
import { useUpdateLoan } from '../hooks/use-update-loan';
import type { LoanFormValues } from '../schemas/loan-form.schema';

/**
 * The Loans page's whole body (#281: moved onto Costs), unchanged except for
 * losing its own page chrome: `CostsPage` supplies the `PageContainer`, and
 * "Add loan" moves into this section's own header action. Loading and error
 * states are in-section messages, not a full-page takeover, matching the
 * Spend charts beside it.
 */
export function LoansSection() {
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

  const vehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data]);
  const loans = useMemo(() => loansQuery.data ?? [], [loansQuery.data]);

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

  return (
    <section aria-labelledby="loans-heading" className="space-y-4" id="loans">
      <SectionHeader
        actions={
          <Button
            disabled={!vehicles.length}
            onClick={() => {
              setCreateOpen(true);
              setSelectedVehicleId(vehicles[0]?.id ?? null);
            }}
          >
            Add loan
          </Button>
        }
        description="Track financing across vehicles to see real cost of ownership."
        id="loans-heading"
        title="Loans"
      />

      {loansQuery.isLoading ? (
        <p className="text-body text-fg-3">Loading your loans…</p>
      ) : loansQuery.isError ? (
        <p className="text-body text-late">
          {getApiErrorMessage(loansQuery.error, 'Your loans could not be loaded')}
        </p>
      ) : (
        <>
          {loans.length ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-card border border-line bg-surface p-4">
                <Figure label="Monthly EMIs" value={<Money value={totals.emi} />} />
              </div>
              <div className="rounded-card border border-line bg-surface p-4">
                <Figure label="Still owed" value={<Money value={totals.outstanding} />} />
              </div>
              <div className="rounded-card border border-line bg-surface p-4">
                <Figure
                  label="Interest paid so far"
                  value={<Money value={totals.interestPaid} />}
                />
              </div>
            </div>
          ) : null}

          {!loans.length ? (
            <EmptyState
              description="Add a loan to include EMI and interest in your cost analysis."
              title="No loans yet"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {loans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  onDelete={setLoanToDelete}
                  onEdit={setLoanToEdit}
                  onManage={setSelectedLoan}
                  vehicleLabel={vehicleLabelById[loan.vehicleId]}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setScannedDraft(null);
          }
        }}
        open={isCreateOpen}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add vehicle loan</DialogTitle>
            <DialogDescription>
              EMI, interest, and outstanding balance are computed automatically.
            </DialogDescription>
          </DialogHeader>

          {scanStatus.data?.available ? (
            <div className="flex items-center justify-between rounded-md border border-brand/30 bg-brand-tint/60 p-3 text-ui">
              <div>
                <div className="font-medium text-brand">Scan sanction letter / agreement</div>
                <div className="text-caption text-brand">
                  AI extracts lender, principal, rate, tenure, start date.
                </div>
              </div>
              <input
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                capture="environment"
                className="hidden"
                onChange={handleScanFileChange}
                ref={scanFileInputRef}
                type="file"
              />
              <Button
                className="border-brand/30 text-brand hover:bg-brand-tint"
                disabled={scanMutation.isPending}
                onClick={() => scanFileInputRef.current?.click()}
                variant="outline"
              >
                {scanMutation.isPending ? 'Scanning…' : 'Scan document'}
              </Button>
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-small font-medium text-foreground/90">
                Vehicle
              </label>
              <Select
                onValueChange={(v) => setSelectedVehicleId(v)}
                value={selectedVehicleId ?? undefined}
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
              initialValues={scannedDraft ?? undefined}
              isSubmitting={createMutation.isPending}
              key={`create-${scanFormKey}`}
              onSubmit={handleCreate}
              submitError={
                createMutation.isError
                  ? getApiErrorMessage(createMutation.error, 'Could not save loan')
                  : null
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      <LoanDetailDialog
        loan={selectedLoan ? (loans.find((l) => l.id === selectedLoan.id) ?? selectedLoan) : null}
        onOpenChange={(open) => !open && setSelectedLoan(null)}
        vehicleLabel={selectedLoan ? vehicleLabelById[selectedLoan.vehicleId] : undefined}
      />

      <Dialog onOpenChange={(open) => !open && setLoanToEdit(null)} open={loanToEdit !== null}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit loan</DialogTitle>
            <DialogDescription>
              {loanToEdit ? (vehicleLabelById[loanToEdit.vehicleId] ?? '') : ''}
              {loanToEdit?.status === 'closed' ? ' · closed loan' : ''}
            </DialogDescription>
          </DialogHeader>
          {loanToEdit ? (
            <LoanForm
              initialValues={{
                lender: loanToEdit.lender,
                accountNumber: loanToEdit.accountNumber ?? '',
                principal: loanToEdit.principal,
                interestRate: loanToEdit.interestRate,
                tenureMonths: loanToEdit.tenureMonths,
                startDate: loanToEdit.startDate.slice(0, 10),
                notes: loanToEdit.notes ?? '',
              }}
              isSubmitting={updateMutation.isPending}
              key={loanToEdit.id}
              onSubmit={handleEdit}
              submitError={
                updateMutation.isError
                  ? getApiErrorMessage(updateMutation.error, 'Could not update loan')
                  : null
              }
              submitLabel="Save changes"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => !open && setLoanToDelete(null)}
        open={loanToDelete !== null}
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
              className="bg-destructive text-on-late hover:bg-destructive/90"
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
    </section>
  );
}
