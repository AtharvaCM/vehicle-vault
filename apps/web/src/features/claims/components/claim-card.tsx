import { format } from 'date-fns';
import { Calendar, Link2, Pencil, ReceiptText, Trash2, Wrench } from 'lucide-react';
import { outOfPocket, type Claim, type ClaimStatus } from '@vehicle-vault/shared';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { appToast } from '@/lib/toast';

import { useDeleteClaim } from '../hooks/use-claims';
import { ClaimAttachmentsSection } from './claim-attachments-section';

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
  filed: 'bg-sky-50 text-sky-600 border-sky-100',
  approved: 'bg-amber-50 text-amber-600 border-amber-100',
  settled: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  rejected: 'bg-rose-50 text-rose-600 border-rose-100',
};

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ClaimCard({ claim, vehicleId, onEdit }: ClaimCardProps) {
  const deleteMutation = useDeleteClaim(vehicleId);
  const pocket = outOfPocket(claim);

  async function handleDelete() {
    if (!confirm('Delete this claim? This cannot be undone.')) return;
    try {
      await deleteMutation.mutateAsync(claim.id);
      appToast.success({ title: 'Claim removed', description: 'History updated.' });
    } catch {
      appToast.error({ title: 'Delete failed', description: 'Could not remove the claim.' });
    }
  }

  return (
    <Card className="border-slate-200/60 bg-white shadow-premium-sm overflow-hidden hover:border-primary/20 transition-all">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Claim
            </p>
            <h4 className="font-black text-slate-900 leading-tight">
              {claim.claimNumber ? `#${claim.claimNumber}` : 'Claim (no number yet)'}
            </h4>
            <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Filed {format(new Date(claim.filedDate), 'd MMM yyyy')}
              {claim.settledDate ? ` · Settled ${format(new Date(claim.settledDate), 'd MMM yyyy')}` : ''}
            </p>
          </div>
          <Badge variant="outline" className={STATUS_CLASSES[claim.status]}>
            {STATUS_LABEL[claim.status]}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <p className="font-black uppercase tracking-widest text-slate-400 text-[10px]">
              Gross bill
            </p>
            <p className="font-bold text-slate-900 tabular-nums">
              {formatINR(claim.grossAmount)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-black uppercase tracking-widest text-slate-400 text-[10px]">
              Insurer paid
            </p>
            <p className="font-bold text-emerald-600 tabular-nums">
              {formatINR(claim.insurerPaidAmount)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-black uppercase tracking-widest text-slate-400 text-[10px]">
              Out of pocket
            </p>
            <p className="font-bold text-rose-600 tabular-nums">{formatINR(pocket)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            {claim.maintenanceRecordId ? (
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3" /> Linked to maintenance record
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-400">
                <Link2 className="h-3 w-3" /> No maintenance record linked
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onEdit ? (
              <Button variant="ghost" size="icon" onClick={() => onEdit(claim)} aria-label="Edit claim">
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              aria-label="Delete claim"
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 text-rose-500" />
            </Button>
          </div>
        </div>

        {claim.notes ? (
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600 flex items-start gap-2">
            <ReceiptText className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{claim.notes}</span>
          </div>
        ) : null}

        <ClaimAttachmentsSection claimId={claim.id} />
      </CardContent>
    </Card>
  );
}
