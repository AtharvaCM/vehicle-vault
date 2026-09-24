import { Calendar, Link2, Pencil, ReceiptText, Trash2, Wrench } from 'lucide-react';
import { outOfPocket, type Claim, type ClaimStatus } from '@vehicle-vault/shared';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { confirm } from '@/components/shared/confirm';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

import { useDeleteClaim } from '../hooks/use-claims';
import { ClaimAttachmentsSection } from './claim-attachments-section';
import { useVehicleAccess } from '@/features/vehicles/context/vehicle-access';

interface ClaimCardProps {
  claim: Claim;
  vehicleId: string;
  onEdit?: (claim: Claim) => void;
}

const STATUS_LABEL: Record<ClaimStatus, string> = {
  filed: 'Filed',
  approved: 'Approved',
  settled: 'Settled',
  rejected: 'Rejected',
};

const STATUS_CLASSES: Record<ClaimStatus, string> = {
  filed: 'bg-brand-tint text-brand border-brand/30',
  approved: 'bg-soon-tint text-soon border-soon/30',
  settled: 'bg-ok-tint text-ok border-ok/30',
  rejected: 'bg-late-tint text-late border-late/30',
};

export function ClaimCard({ claim, vehicleId, onEdit }: ClaimCardProps) {
  // Delete is always offered here, unlike edit, so it needs the role itself.
  const { canEdit } = useVehicleAccess();
  const deleteMutation = useDeleteClaim(vehicleId);
  const pocket = outOfPocket(claim);

  async function handleDelete() {
    if (
      !(await confirm({
        title: 'Delete this claim?',
        description: "It can't be undone.",
        confirmLabel: 'Delete',
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(claim.id);
      appToast.success({ title: 'Claim removed', description: 'History updated.' });
    } catch {
      appToast.error({ title: 'Delete failed', description: 'Could not remove the claim.' });
    }
  }

  return (
    <Card className="border-line/60 bg-surface overflow-hidden hover:border-primary/20 transition-colors">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-caption font-medium text-fg-3">Claim</p>
            <h4 className="font-black text-fg leading-tight">
              {claim.claimNumber ? `#${claim.claimNumber}` : 'Claim (no number yet)'}
            </h4>
            <p className="text-xs font-bold text-fg-3 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Filed {format.date(claim.filedDate)}
              {claim.settledDate ? ` · Settled ${format.date(claim.settledDate)}` : ''}
            </p>
          </div>
          <Badge variant="outline" className={STATUS_CLASSES[claim.status]}>
            {STATUS_LABEL[claim.status]}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <p className="text-caption font-medium text-fg-3">Gross bill</p>
            <p className="font-bold text-fg tabular-nums">{format.money(claim.grossAmount)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-fg-3">Insurer paid</p>
            <p className="font-bold text-ok tabular-nums">
              {format.money(claim.insurerPaidAmount)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-fg-3">Out of pocket</p>
            <p className="font-bold text-late tabular-nums">{format.money(pocket)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-line-subtle">
          <div className="text-xs text-fg-3 flex items-center gap-2">
            {claim.maintenanceRecordId ? (
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3" /> Linked to service record
              </span>
            ) : (
              <span className="flex items-center gap-1 text-fg-3">
                <Link2 className="h-3 w-3" /> No service record linked
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onEdit ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(claim)}
                aria-label="Edit claim"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                aria-label="Delete claim"
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 text-late" />
              </Button>
            ) : null}
          </div>
        </div>

        {claim.notes ? (
          <div className="rounded-lg bg-page border border-line-subtle p-3 text-xs text-fg-2 flex items-start gap-2">
            <ReceiptText className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{claim.notes}</span>
          </div>
        ) : null}

        <ClaimAttachmentsSection claim={claim} vehicleId={vehicleId} />
      </CardContent>
    </Card>
  );
}
