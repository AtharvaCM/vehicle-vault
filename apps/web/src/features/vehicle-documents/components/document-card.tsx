import { Link } from '@tanstack/react-router';
import {
  Calendar,
  Gauge,
  Maximize2,
  Pencil,
  Trash2,
  Shield,
  FileBadge,
  RefreshCw,
} from 'lucide-react';
import { isBefore, addDays } from 'date-fns';
import { type VehicleDocument } from '@vehicle-vault/shared';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from '@/lib/format';
import { useDeleteVehicleDocument } from '../hooks/use-documents';
import {
  documentKindNouns,
  documentKindTitles,
  isComplianceKind,
} from '../utils/document-kind-labels';
import { appToast } from '@/lib/toast';
import { useVehicleAccess } from '@/features/vehicles/context/vehicle-access';

import { isRenewable } from '../utils/renewal-values';
import { DocumentAttachmentsSection } from './document-attachments-section';

interface DocumentCardProps {
  document: VehicleDocument;
  vehicleId: string;
  onEdit?: (document: VehicleDocument) => void;
  /**
   * Offered on the document of record once it has expired or is within a month
   * of it. Omitted for viewers, and for a record a renewal has superseded.
   */
  onRenew?: (document: VehicleDocument) => void;
}

/**
 * A document the new-vehicle prompt created knows only its expiry: the insurer,
 * the number and the start date are all filled in later.
 */
function NotRecorded() {
  return <span className="font-bold text-slate-400">Not recorded</span>;
}

export function DocumentCard({ document, vehicleId, onEdit, onRenew }: DocumentCardProps) {
  // Delete is always offered here, unlike edit, so it needs the role itself.
  const { canEdit } = useVehicleAccess();
  const deleteMutation = useDeleteVehicleDocument(vehicleId);

  const isExpired = document.endDate ? isBefore(new Date(document.endDate), new Date()) : false;
  const isExpiringSoon =
    document.endDate && !isExpired
      ? isBefore(new Date(document.endDate), addDays(new Date(), 30))
      : false;

  const renewButton =
    onRenew && isRenewable(document) ? (
      <Button
        className="h-8 rounded-full px-3 text-xs font-bold"
        onClick={() => onRenew(document)}
        size="sm"
        variant="outline"
      >
        <RefreshCw aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
        Renew
      </Button>
    ) : null;

  // For every role: showing a document is reading it, and a viewer may be the
  // one stopped at the checkpoint.
  const showLink = (
    <Link
      aria-label={`Show ${documentKindTitles[document.kind]} full screen`}
      className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      params={{ vehicleId, kind: document.kind, documentId: document.id }}
      to="/vehicles/$vehicleId/documents/$kind/$documentId"
    >
      <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />
      Show
    </Link>
  );

  async function handleDelete() {
    if (
      confirm(
        `Are you sure you want to delete this ${documentKindNouns[document.kind].toLowerCase()} record?`,
      )
    ) {
      try {
        await deleteMutation.mutateAsync({ id: document.id, kind: document.kind });
        appToast.success({
          title: `${documentKindNouns[document.kind]} removed`,
          description: 'History updated.',
        });
      } catch {
        appToast.error({ title: 'Delete failed', description: 'Failed to remove record.' });
      }
    }
  }

  if (document.kind === 'insurance') {
    return (
      <Card className="border-slate-200/60 bg-white overflow-hidden hover:border-primary/20 transition-all">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="flex-[1.5] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Provider & policy
                  </p>
                  <h4 className="font-black text-slate-900 leading-tight">
                    {document.provider ?? <NotRecorded />}
                  </h4>
                  {document.number && (
                    <p className="text-xs font-bold text-slate-500 tabular-nums">
                      #{document.number}
                    </p>
                  )}
                </div>
                <Badge
                  variant={isExpired ? 'destructive' : isExpiringSoon ? 'secondary' : 'outline'}
                  className={
                    isExpired
                      ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-50'
                      : isExpiringSoon
                        ? 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-50'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50'
                  }
                >
                  {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring soon' : 'Active'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                    <Calendar className="h-3 w-3" />
                    Valid from
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    {document.startDate ? format.date(document.startDate) : <NotRecorded />}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                    <Calendar className="h-3 w-3" />
                    Valid till
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    {document.endDate ? format.date(document.endDate) : 'No date limit'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-slate-50 border-l border-slate-100 p-5 flex flex-col justify-between">
              <div className="space-y-3">
                {typeof document.details?.premiumAmount === 'number' && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                      Premium paid
                    </p>
                    <p className="text-lg font-black tracking-tight text-slate-900">
                      {format.money(document.details.premiumAmount)}
                    </p>
                  </div>
                )}
                {typeof document.details?.insuredValue === 'number' && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                      Insured declared value (IDV)
                    </p>
                    <p className="text-sm font-bold text-slate-600">
                      {format.money(document.details.insuredValue)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                {showLink}
                {renewButton}
                {onEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 hover:text-primary rounded-full"
                    onClick={() => onEdit(document)}
                    aria-label="Edit document"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canEdit ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-full"
                    onClick={handleDelete}
                    aria-label="Delete document"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 px-5 py-4">
            <DocumentAttachmentsSection documentId={document.id} kind="insurance" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isComplianceKind(document.kind)) {
    const amount = document.details?.amount;
    return (
      <Card className="border-slate-200/60 bg-white overflow-hidden hover:border-primary/20 transition-all">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="flex-[1.5] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {documentKindTitles[document.kind]}
                  </p>
                  <h4 className="font-black text-slate-900 leading-tight">
                    {document.provider ?? <NotRecorded />}
                  </h4>
                  {document.number && (
                    <p className="text-xs font-bold text-slate-500 tabular-nums">
                      #{document.number}
                    </p>
                  )}
                </div>
                <Badge
                  variant={isExpired ? 'destructive' : 'outline'}
                  className={
                    isExpired
                      ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-50'
                      : isExpiringSoon
                        ? 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-50'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50'
                  }
                >
                  {isExpired
                    ? 'Expired'
                    : isExpiringSoon
                      ? 'Expiring soon'
                      : document.endDate
                        ? 'Valid'
                        : 'No expiry'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                    <Calendar className="h-3 w-3" />
                    Issued on
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    {document.startDate ? format.date(document.startDate) : <NotRecorded />}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                    <FileBadge className="h-3 w-3" />
                    Valid till
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    {document.endDate ? format.date(document.endDate) : 'No date limit'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-slate-50 border-l border-slate-100 p-5 flex flex-col justify-between">
              <div className="space-y-3">
                {typeof amount === 'number' && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                      Amount paid
                    </p>
                    <p className="text-lg font-black tracking-tight text-slate-900">
                      {format.money(amount)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                {showLink}
                {renewButton}
                {onEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 hover:text-primary rounded-full"
                    onClick={() => onEdit(document)}
                    aria-label="Edit document"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canEdit ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-full"
                    onClick={handleDelete}
                    aria-label="Delete document"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 px-5 py-4">
            <DocumentAttachmentsSection documentId={document.id} kind={document.kind} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Warranty kind
  return (
    <Card className="border-slate-200/60 bg-white overflow-hidden hover:border-primary/20 transition-all">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex-[1.5] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {(document.details?.type as string) || 'Warranty'}
                </p>
                <h4 className="font-black text-slate-900 leading-tight">
                  {document.provider ?? <NotRecorded />}
                </h4>
                {document.number && (
                  <p className="text-xs font-bold text-slate-500 tabular-nums">
                    #{document.number}
                  </p>
                )}
              </div>
              <Badge
                variant={isExpired ? 'destructive' : 'outline'}
                className={
                  isExpired
                    ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-50'
                    : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-50'
                }
              >
                {isExpired ? 'Expired' : 'In force'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                  <Calendar className="h-3 w-3" />
                  Coverage start
                </div>
                <p className="text-sm font-bold text-slate-700">
                  {document.startDate ? format.date(document.startDate) : <NotRecorded />}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                  <Shield className="h-3 w-3" />
                  Coverage end
                </div>
                <p className="text-sm font-bold text-slate-700">
                  {document.endDate ? format.date(document.endDate) : 'No date limit'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-slate-50 border-l border-slate-100 p-5 flex flex-col justify-between">
            <div className="space-y-3">
              {typeof document.details?.endOdometer === 'number' && (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                    Odometer limit
                  </p>
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-slate-400" />
                    <p className="text-lg font-black tracking-tight text-slate-900">
                      {format.number(document.details.endOdometer)}
                    </p>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">km</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              {showLink}
              {renewButton}
              {onEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-slate-400 hover:text-primary rounded-full"
                  onClick={() => onEdit(document)}
                  aria-label="Edit document"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {canEdit ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-full"
                  onClick={handleDelete}
                  aria-label="Delete document"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 px-5 py-4">
          <DocumentAttachmentsSection documentId={document.id} kind="warranty" />
        </div>
      </CardContent>
    </Card>
  );
}
