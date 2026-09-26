import { Link } from '@tanstack/react-router';
import { Maximize2, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { type VehicleDocument } from '@vehicle-vault/shared';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { confirm } from '@/components/shared/confirm';
import { format } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDeleteVehicleDocument } from '../hooks/use-documents';
import { documentKindNouns, documentKindTitles } from '../utils/document-kind-labels';
import {
  paperStatus,
  paperStatusLabels,
  warrantyTypeLabel,
  type PaperStatus,
} from '../utils/paper-status';
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

  const renewButton =
    onRenew && isRenewable(document) ? (
      <Button
        className="h-8 rounded-full px-3 text-caption font-bold"
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
      className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-caption font-bold text-fg-2 hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      params={{ vehicleId }}
      search={{ paper: document.kind, document: document.id }}
      to="/vehicles/$vehicleId/papers"
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

  const status = paperStatus(document.endDate);
  const facts = documentFacts(document);

  return (
    <Card
      className="overflow-hidden border-line/60 bg-surface p-0 transition-colors hover:border-primary/20"
      data-testid="document-card"
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-caption font-black text-fg-3">{cardLabel(document)}</p>
            <h4 className="font-black leading-tight text-fg">
              {document.provider ?? <NotRecorded />}
            </h4>
            {document.number ? (
              <p className="font-mono text-caption font-medium text-fg-2">#{document.number}</p>
            ) : null}
          </div>
          <Badge className={cn('shrink-0', STATUS_TONES[status])} variant="outline">
            {paperStatusLabels[status]}
          </Badge>
        </div>

        {/* Every value under its own label, across the card's width. */}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {facts.map((fact) => (
            <div className="min-w-0 space-y-1" key={fact.label}>
              <dt className="text-caption font-bold text-fg-3">{fact.label}</dt>
              <dd className="text-ui font-bold text-fg-2">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {showLink}
          {renewButton}
          {onEdit ? (
            <Button
              aria-label="Edit document"
              className="rounded-full text-fg-3 hover:text-primary md:h-8 md:w-8"
              onClick={() => onEdit(document)}
              size="icon"
              variant="ghost"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              aria-label="Delete document"
              className="rounded-full text-fg-3 hover:text-late md:h-8 md:w-8"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
              size="icon"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardContent>
      <div className="border-t border-line-subtle px-5 py-4">
        <DocumentAttachmentsSection documentId={document.id} kind={document.kind} />
      </div>
    </Card>
  );
}

const STATUS_TONES: Record<PaperStatus, string> = {
  valid: 'border-ok/30 bg-ok-tint text-ok hover:bg-ok-tint',
  'ends-soon': 'border-soon/30 bg-soon-tint text-soon hover:bg-soon-tint',
  expired: 'border-late/30 bg-late-tint text-late hover:bg-late-tint',
};

/** The line above the provider: the kind of paper, or a warranty's own type. */
function cardLabel(document: VehicleDocument): string {
  if (document.kind === 'warranty') {
    const type = warrantyTypeLabel(document.details?.type);
    return type ? `${type} warranty` : documentKindTitles.warranty;
  }
  return documentKindTitles[document.kind];
}

type Fact = { label: string; value: ReactNode };

/** The dates, then whatever the kind carries: money, a distance limit. */
function documentFacts(document: VehicleDocument): Fact[] {
  const from = document.startDate ? format.date(document.startDate) : <NotRecorded />;
  const till = document.endDate ? format.date(document.endDate) : 'No end date';
  const details = document.details ?? {};

  if (document.kind === 'insurance') {
    return [
      { label: 'Valid from', value: from },
      { label: 'Valid till', value: till },
      ...(typeof details.premiumAmount === 'number'
        ? [{ label: 'Premium paid', value: format.money(details.premiumAmount) }]
        : []),
      ...(typeof details.insuredValue === 'number'
        ? [{ label: 'Insured value (IDV)', value: format.money(details.insuredValue) }]
        : []),
    ];
  }

  if (document.kind === 'warranty') {
    return [
      { label: 'Covered from', value: from },
      { label: 'Covered till', value: till },
      ...(typeof details.endOdometer === 'number'
        ? [{ label: 'Covered up to', value: format.odometer(details.endOdometer) }]
        : []),
    ];
  }

  return [
    { label: 'Issued on', value: from },
    { label: 'Valid till', value: till },
    ...(typeof details.amount === 'number'
      ? [{ label: 'Amount paid', value: format.money(details.amount) }]
      : []),
  ];
}
