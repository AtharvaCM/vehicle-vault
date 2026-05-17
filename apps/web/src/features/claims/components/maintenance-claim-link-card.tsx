import { useMemo, useState } from 'react';
import { Link2, Link2Off, Plus, ReceiptText } from 'lucide-react';
import { format } from 'date-fns';
import { outOfPocket, type Claim } from '@vehicle-vault/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVehicleDocuments } from '@/features/vehicle-documents/hooks/use-documents';
import { appToast } from '@/lib/toast';

import { useUpdateClaim, useVehicleClaims } from '../hooks/use-claims';
import { ClaimFormDialog } from './claim-form-dialog';

interface MaintenanceClaimLinkCardProps {
  vehicleId: string;
  /** When omitted (e.g. create-mode), the card renders an informational hint instead. */
  maintenanceRecordId?: string;
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function MaintenanceClaimLinkCard({
  vehicleId,
  maintenanceRecordId,
}: MaintenanceClaimLinkCardProps) {
  const claimsQuery = useVehicleClaims(vehicleId);
  const documentsQuery = useVehicleDocuments(vehicleId);
  const updateClaim = useUpdateClaim(vehicleId);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [pickerValue, setPickerValue] = useState<string>('__none');

  const insurancePolicies = useMemo(
    () => (documentsQuery.data ?? []).filter((d) => d.kind === 'insurance'),
    [documentsQuery.data],
  );

  const claims = claimsQuery.data ?? [];
  const linkedClaim: Claim | undefined = maintenanceRecordId
    ? claims.find((c) => c.maintenanceRecordId === maintenanceRecordId)
    : undefined;
  const unlinkedClaims = claims.filter((c) => c.maintenanceRecordId === null);

  const isPending = claimsQuery.isPending || documentsQuery.isPending;

  async function handleLink() {
    if (!maintenanceRecordId || pickerValue === '__none') return;
    try {
      await updateClaim.mutateAsync({
        id: pickerValue,
        data: { maintenanceRecordId },
      });
      appToast.success({ title: 'Claim linked', description: 'Maintenance record attached.' });
      setPickerValue('__none');
    } catch {
      appToast.error({
        title: 'Could not link claim',
        description: 'It may already be linked to another record.',
      });
    }
  }

  async function handleUnlink(claim: Claim) {
    try {
      await updateClaim.mutateAsync({
        id: claim.id,
        data: { maintenanceRecordId: null },
      });
      appToast.success({ title: 'Claim unlinked', description: 'No record attached.' });
    } catch {
      appToast.error({ title: 'Could not unlink claim' });
    }
  }

  if (!maintenanceRecordId) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-primary" /> Insurance Claim
          </CardTitle>
          <CardDescription>
            Save this record first to link or create an insurance claim.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-primary" /> Insurance Claim
        </CardTitle>
        <CardDescription>
          Tie this repair to an insurance claim so cost analytics reflect what you actually paid.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isPending ? (
          <p className="text-xs text-slate-400">Loading claims…</p>
        ) : linkedClaim ? (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                  Linked claim
                </p>
                <p className="font-bold text-slate-900">
                  {linkedClaim.claimNumber ? `#${linkedClaim.claimNumber}` : 'Claim (no number)'}
                </p>
                <p className="text-xs text-slate-600">
                  {formatINR(linkedClaim.grossAmount)} gross ·{' '}
                  <span className="text-rose-600">
                    {formatINR(outOfPocket(linkedClaim))} out of pocket
                  </span>{' '}
                  · filed {format(new Date(linkedClaim.filedDate), 'd MMM yyyy')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleUnlink(linkedClaim)}
                disabled={updateClaim.isPending}
              >
                <Link2Off className="h-4 w-4" />
                Unlink
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {unlinkedClaims.length > 0 ? (
              <>
                <p className="text-xs text-slate-500">Link to an existing unlinked claim:</p>
                <div className="flex gap-2">
                  <Select onValueChange={setPickerValue} value={pickerValue}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a claim" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— select a claim —</SelectItem>
                      {unlinkedClaims.map((claim) => (
                        <SelectItem key={claim.id} value={claim.id}>
                          {claim.claimNumber ?? '(no number)'} ·{' '}
                          {format(new Date(claim.filedDate), 'd MMM yyyy')} ·{' '}
                          {formatINR(claim.grossAmount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleLink}
                    disabled={pickerValue === '__none' || updateClaim.isPending}
                  >
                    <Link2 className="h-4 w-4" /> Link
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">No unlinked claims on this vehicle.</p>
            )}

            <div className="pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowCreateDialog(true)}
                disabled={insurancePolicies.length === 0}
                title={
                  insurancePolicies.length === 0
                    ? 'Add an insurance policy first'
                    : undefined
                }
              >
                <Plus className="h-4 w-4" /> Create new claim for this record
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <ClaimFormDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        vehicleId={vehicleId}
        insurancePolicies={insurancePolicies}
        defaultMaintenanceRecordId={maintenanceRecordId}
      />
    </Card>
  );
}
