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
import { confirm } from '@/components/shared/confirm';
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
  return <span className="font-bold text-fg-3">Not recorded</span>;
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
      className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-xs font-bold text-fg-2 hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      params={{ vehicleId, kind: document.kind, documentId: document.id }}
      to="/vehicles/$vehicleId/documents/$kind/$documentId"
    >
      <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />
      Show
    </Link>
  );

  async function handleDelete() {
    const noun = documentKindNouns[document.kind].toLowerCase();
    if (
      !(await confirm({
        title: `Delete this ${noun} record?`,
        description: "It can't be undone.",
        confirmLabel: 'Delete',
        destructive: true,
      }))
    ) {
      return;
    }

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

  if (document.kind === 'insurance') {
    return (
      <Card className="border-line/60 bg-surface overflow-hidden hover:border-primary/20 transition-colors">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="flex-[1.5] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-caption font-black text-fg-3">Provider & policy</p>
                  <h4 className="font-black text-fg leading-tight">
                    {document.provider ?? <NotRecorded />}
                  </h4>
                  {document.number && (
                    <p className="text-xs font-bold text-fg-3 tabular-nums">#{document.number}</p>
                  )}
                </div>
                <Badge
                  variant={isExpired ? 'destructive' : isExpiringSoon ? 'secondary' : 'outline'}
                  className={
                    isExpired
                      ? 'bg-late-tint text-late border-late/30 hover:bg-late-tint'
                      : isExpiringSoon
                        ? 'bg-soon-tint text-soon border-soon/30 hover:bg-soon-tint'
                        : 'bg-ok-tint text-ok border-ok/30 hover:bg-ok-tint'
                  }
                >
                  {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring soon' : 'Active'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-caption font-bold text-fg-3">
                    <Calendar className="h-3 w-3" />
                    Valid from
                  </div>
                  <p className="text-sm font-bold text-fg-2">
                    {document.startDate ? format.date(document.startDate) : <NotRecorded />}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-caption font-bold text-fg-3">
                    <Calendar className="h-3 w-3" />
                    Valid till
                  </div>
                  <p className="text-sm font-bold text-fg-2">
                    {document.endDate ? format.date(document.endDate) : 'No date limit'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-page border-l border-line-subtle p-5 flex flex-col justify-between">
              <div className="space-y-3">
                {typeof document.details?.premiumAmount === 'number' && (
                  <div className="space-y-0.5">
                    <p className="text-caption font-black text-fg-3">Premium paid</p>
                    <p className="text-lg font-black tracking-tight text-fg">
                      {format.money(document.details.premiumAmount)}
                    </p>
                  </div>
                )}
                {typeof document.details?.insuredValue === 'number' && (
                  <div className="space-y-0.5">
                    <p className="text-caption font-black text-fg-3">
                      Insured declared value (IDV)
                    </p>
                    <p className="text-sm font-bold text-fg-2">
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
                    className="text-fg-3 hover:text-primary rounded-full md:h-8 md:w-8"
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
                    className="text-fg-3 hover:text-late rounded-full md:h-8 md:w-8"
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
          <div className="border-t border-line-subtle px-5 py-4">
            <DocumentAttachmentsSection documentId={document.id} kind="insurance" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isComplianceKind(document.kind)) {
    const amount = document.details?.amount;
    return (
      <Card className="border-line/60 bg-surface overflow-hidden hover:border-primary/20 transition-colors">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="flex-[1.5] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-caption font-black text-fg-3">
                    {documentKindTitles[document.kind]}
                  </p>
                  <h4 className="font-black text-fg leading-tight">
                    {document.provider ?? <NotRecorded />}
                  </h4>
                  {document.number && (
                    <p className="text-xs font-bold text-fg-3 tabular-nums">#{document.number}</p>
                  )}
                </div>
                <Badge
                  variant={isExpired ? 'destructive' : 'outline'}
                  className={
                    isExpired
                      ? 'bg-late-tint text-late border-late/30 hover:bg-late-tint'
                      : isExpiringSoon
                        ? 'bg-soon-tint text-soon border-soon/30 hover:bg-soon-tint'
                        : 'bg-ok-tint text-ok border-ok/30 hover:bg-ok-tint'
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
                  <div className="flex items-center gap-1.5 text-caption font-bold text-fg-3">
                    <Calendar className="h-3 w-3" />
                    Issued on
                  </div>
                  <p className="text-sm font-bold text-fg-2">
                    {document.startDate ? format.date(document.startDate) : <NotRecorded />}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-caption font-bold text-fg-3">
                    <FileBadge className="h-3 w-3" />
                    Valid till
                  </div>
                  <p className="text-sm font-bold text-fg-2">
                    {document.endDate ? format.date(document.endDate) : 'No date limit'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-page border-l border-line-subtle p-5 flex flex-col justify-between">
              <div className="space-y-3">
                {typeof amount === 'number' && (
                  <div className="space-y-0.5">
                    <p className="text-caption font-black text-fg-3">Amount paid</p>
                    <p className="text-lg font-black tracking-tight text-fg">
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
                    className="text-fg-3 hover:text-primary rounded-full md:h-8 md:w-8"
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
                    className="text-fg-3 hover:text-late rounded-full md:h-8 md:w-8"
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
          <div className="border-t border-line-subtle px-5 py-4">
            <DocumentAttachmentsSection documentId={document.id} kind={document.kind} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Warranty kind
  return (
    <Card className="border-line/60 bg-surface overflow-hidden hover:border-primary/20 transition-colors">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex-[1.5] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-caption font-black text-fg-3">
                  {(document.details?.type as string) || 'Warranty'}
                </p>
                <h4 className="font-black text-fg leading-tight">
                  {document.provider ?? <NotRecorded />}
                </h4>
                {document.number && (
                  <p className="text-xs font-bold text-fg-3 tabular-nums">#{document.number}</p>
                )}
              </div>
              <Badge
                variant={isExpired ? 'destructive' : 'outline'}
                className={
                  isExpired
                    ? 'bg-late-tint text-late border-late/30 hover:bg-late-tint'
                    : 'bg-brand-tint text-brand border-brand/30 hover:bg-brand-tint'
                }
              >
                {isExpired ? 'Expired' : 'In force'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-caption font-bold text-fg-3">
                  <Calendar className="h-3 w-3" />
                  Coverage start
                </div>
                <p className="text-sm font-bold text-fg-2">
                  {document.startDate ? format.date(document.startDate) : <NotRecorded />}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-caption font-bold text-fg-3">
                  <Shield className="h-3 w-3" />
                  Coverage end
                </div>
                <p className="text-sm font-bold text-fg-2">
                  {document.endDate ? format.date(document.endDate) : 'No date limit'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-page border-l border-line-subtle p-5 flex flex-col justify-between">
            <div className="space-y-3">
              {typeof document.details?.endOdometer === 'number' && (
                <div className="space-y-0.5">
                  <p className="text-caption font-black text-fg-3">Odometer limit</p>
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-fg-3" />
                    <p className="text-lg font-black tracking-tight text-fg">
                      {format.number(document.details.endOdometer)}
                    </p>
                    <span className="text-caption font-bold text-fg-3">km</span>
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
                  className="text-fg-3 hover:text-primary rounded-full md:h-8 md:w-8"
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
                  className="text-fg-3 hover:text-late rounded-full md:h-8 md:w-8"
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
        <div className="border-t border-line-subtle px-5 py-4">
          <DocumentAttachmentsSection documentId={document.id} kind="warranty" />
        </div>
      </CardContent>
    </Card>
  );
}
