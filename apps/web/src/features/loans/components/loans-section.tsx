import { MoreHorizontal } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { CreateVehicleLoanInput, VehicleLoan } from '@vehicle-vault/shared';

import { EmptyState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { SectionHeader } from '@/components/shared/section-header';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from '@/lib/format';
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
import { getVehicleDisplayName } from '@/features/vehicles/utils/get-vehicle-display-name';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

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

  const vehicleNameById = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, getVehicleDisplayName(v)])),
    [vehicles],
  );
  // Name and plate, where a vehicle is picked or a dialog names it.
  const vehicleLabelById = useMemo(
    () =>
      Object.fromEntries(
        vehicles.map((v) => [v.id, `${getVehicleDisplayName(v)} • ${v.registrationNumber}`]),
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
          {!loans.length ? (
            <EmptyState
              description="Add a loan to include EMI and interest in your cost analysis."
              title="No loans yet"
            />
          ) : (
            <div className="overflow-hidden rounded-card border border-line bg-surface">
              <ul aria-label="Loans" className="divide-y divide-line-subtle">
                {loans.map((loan) => (
                  <LoanLine
                    key={loan.id}
                    loan={loan}
                    onDelete={setLoanToDelete}
                    onEdit={setLoanToEdit}
                    onOpen={setSelectedLoan}
                    vehicleName={vehicleNameById[loan.vehicleId]}
                  />
                ))}
              </ul>
              {/* The garage's total, one line under the loans it adds up. */}
              <p
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-line bg-page/60 px-4 py-3 text-small text-fg-2 sm:px-5"
                data-testid="loans-total"
              >
                <span className="font-semibold text-fg">Total</span>
                <span>
                  <Money className="font-semibold text-fg" value={totals.outstanding} /> left
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <Money value={totals.emi} /> a month in EMIs
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <Money value={totals.interestPaid} /> interest paid so far
                </span>
              </p>
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

type LoanLineProps = {
  loan: VehicleLoan;
  vehicleName: string | undefined;
  onOpen: (loan: VehicleLoan) => void;
  onEdit: (loan: VehicleLoan) => void;
  onDelete: (loan: VehicleLoan) => void;
};

/** "Weekend Bike · HDFC · ₹1,31,624 left · ends Mar 2029": the line opens the loan. */
function LoanLine({ loan, vehicleName, onOpen, onEdit, onDelete }: LoanLineProps) {
  const active = loan.status === 'active';

  return (
    <li className="flex items-stretch" data-testid="loan-line">
      <button
        className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-page/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
        onClick={() => onOpen(loan)}
        type="button"
      >
        <span className="min-w-0 truncate text-body font-semibold text-fg">
          {vehicleName ? `${vehicleName} · ` : null}
          {loan.lender}
        </span>
        <span className="shrink-0 text-small text-fg-2">
          {active ? (
            <>
              <Money className="font-semibold text-fg" value={loan.outstandingBalance} /> left ·
              ends {format.date(loan.endDate, 'monthYear')}
            </>
          ) : (
            `${format.enumLabel('loanStatus', loan.status)} · ${format.date(loan.closedAt ?? loan.endDate, 'monthYear')}`
          )}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`More actions for the ${loan.lender} loan`}
            className="h-auto w-11 shrink-0 rounded-none"
            size="icon"
            type="button"
            variant="ghost"
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(loan)}>Edit</DropdownMenuItem>
          <DropdownMenuItem className="text-late" onClick={() => onDelete(loan)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
