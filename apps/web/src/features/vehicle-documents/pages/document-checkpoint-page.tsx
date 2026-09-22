import { Link } from '@tanstack/react-router';
import {
  VehicleDocumentKindSchema,
  type VehicleDocument,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';
import { differenceInCalendarDays, format } from 'date-fns';
import { ArrowLeft, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Attachment } from '@/features/attachments/types/attachment';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';
import { endpoints } from '@/lib/api/endpoints';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { openApiFileInNewTab } from '@/lib/api/open-api-file';
import { appToast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';

import { useVehicleDocuments } from '../hooks/use-documents';
import { useDocumentAttachments } from '../hooks/use-document-attachments';
import { useAttachmentObjectUrl } from '../hooks/use-attachment-object-url';
import { documentKindTitles } from '../utils/document-kind-labels';

/** What the number on each document is called, as the officer will ask for it. */
const NUMBER_LABELS: Record<VehicleDocumentKind, string> = {
  insurance: 'Policy number',
  warranty: 'Warranty number',
  registration: 'RC number',
  puc: 'Certificate number',
  road_tax: 'Receipt number',
};

const ISSUER_LABELS: Record<VehicleDocumentKind, string> = {
  insurance: 'Insurer',
  warranty: 'Provider',
  registration: 'Issued by',
  puc: 'Tested at',
  road_tax: 'Paid to',
};

const day = (date: Date | string) => format(new Date(date), 'dd MMM yyyy');

type Validity =
  | { state: 'expired'; endDate: Date }
  | { state: 'expiring'; endDate: Date; days: number }
  | { state: 'valid'; endDate: Date | null };

function validityOf(document: VehicleDocument, today = new Date()): Validity {
  if (!document.endDate) return { state: 'valid', endDate: null };
  const endDate = new Date(document.endDate);
  const days = differenceInCalendarDays(endDate, today);
  if (days < 0) return { state: 'expired', endDate };
  if (days <= 30) return { state: 'expiring', endDate, days };
  return { state: 'valid', endDate };
}

/** The status, said plainly and in colour, first thing on the screen. */
function ValidityBanner({ validity }: { validity: Validity }) {
  if (validity.state === 'expired') {
    return (
      <div className="rounded-2xl bg-rose-600 px-5 py-4 text-white" role="status">
        <p className="text-2xl font-black tracking-tight">EXPIRED</p>
        <p className="text-sm font-semibold">Ran out on {day(validity.endDate)}</p>
      </div>
    );
  }
  if (validity.state === 'expiring') {
    return (
      <div className="rounded-2xl bg-amber-500 px-5 py-4 text-white" role="status">
        <p className="text-2xl font-black tracking-tight">VALID</p>
        <p className="text-sm font-semibold">
          {validity.days === 0 ? 'Runs out today' : `Runs out in ${validity.days} days`}, on{' '}
          {day(validity.endDate)}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-emerald-600 px-5 py-4 text-white" role="status">
      <p className="text-2xl font-black tracking-tight">VALID</p>
      <p className="text-sm font-semibold">
        {validity.endDate ? `Until ${day(validity.endDate)}` : 'Does not expire'}
      </p>
    </div>
  );
}

/** An image is shown in place; anything else, a PDF say, opens on its own. */
function DocumentFile({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.mimeType.startsWith('image/');
  const image = useAttachmentObjectUrl(isImage ? attachment.id : null);

  if (isImage) {
    if (image.objectUrl) {
      return (
        <img
          alt={attachment.originalFileName}
          className="w-full rounded-xl border border-slate-200 object-contain"
          src={image.objectUrl}
        />
      );
    }
    return (
      <p className="text-sm text-slate-500">
        {image.isError ? `Couldn't load ${attachment.originalFileName}.` : 'Loading the photo…'}
      </p>
    );
  }

  return (
    <Button
      className="h-12 w-full justify-start gap-2 text-base"
      onClick={() => {
        openApiFileInNewTab(endpoints.attachments.file(attachment.id)).catch((error) =>
          appToast.error({ title: getApiErrorMessage(error, 'Could not open the file') }),
        );
      }}
      variant="outline"
    >
      <FileText aria-hidden="true" className="h-5 w-5" />
      Open {attachment.originalFileName}
    </Button>
  );
}

type DocumentCheckpointPageProps = {
  vehicleId: string;
  kind: string;
  documentId: string;
};

/**
 * One document, the way it gets shown at a checkpoint: a phone held at arm's
 * length, in a hurry. Full screen, status first, the number large, then the
 * file itself. Anyone the vehicle is shared with can open it.
 */
export function DocumentCheckpointPage({
  documentId,
  kind,
  vehicleId,
}: DocumentCheckpointPageProps) {
  const parsedKind = VehicleDocumentKindSchema.safeParse(kind);
  const documentKind = parsedKind.success ? parsedKind.data : null;
  const documentsQuery = useVehicleDocuments(vehicleId);
  const vehicleQuery = useVehicle(vehicleId);
  const document = documentKind
    ? documentsQuery.data?.find((item) => item.id === documentId && item.kind === documentKind)
    : undefined;
  const attachmentsQuery = useDocumentAttachments(documentKind ?? 'insurance', documentId, {
    enabled: Boolean(document),
  });

  const backLink = (
    <Link
      aria-label="Back to the vehicle"
      className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      params={{ vehicleId }}
      search={{ tab: 'protection' }}
      to="/vehicles/$vehicleId"
    >
      <ArrowLeft aria-hidden="true" className="h-6 w-6" />
    </Link>
  );

  let body: React.ReactNode;
  if (documentsQuery.isPending) {
    body = <p className="text-slate-500">Loading the document…</p>;
  } else if (documentsQuery.isError) {
    body = (
      <p className="text-slate-600">
        {getApiErrorMessage(documentsQuery.error, "Couldn't load this document.")}
      </p>
    );
  } else if (!document || !documentKind) {
    body = <p className="text-slate-600">This document isn&apos;t on this vehicle.</p>;
  } else {
    const attachments = attachmentsQuery.data ?? [];
    body = (
      <div className="space-y-6">
        <ValidityBanner validity={validityOf(document)} />

        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            {NUMBER_LABELS[documentKind]}
          </p>
          {document.number ? (
            <p className="break-all text-4xl font-black tabular-nums tracking-tight text-slate-900">
              {document.number}
            </p>
          ) : (
            <p className="text-xl font-bold text-slate-400">Not recorded</p>
          )}
        </div>

        <dl className="grid gap-4 text-lg">
          <div>
            <dt className="text-xs font-black uppercase tracking-widest text-slate-400">
              {ISSUER_LABELS[documentKind]}
            </dt>
            <dd
              className={cn('font-bold', document.provider ? 'text-slate-900' : 'text-slate-400')}
            >
              {document.provider ?? 'Not recorded'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase tracking-widest text-slate-400">Valid</dt>
            <dd className="font-bold text-slate-900">
              {document.startDate ? `${day(document.startDate)} to ` : 'Until '}
              {document.endDate ? day(document.endDate) : 'no expiry'}
            </dd>
          </div>
        </dl>

        <section aria-label="The document" className="space-y-3">
          {attachmentsQuery.isPending ? (
            <p className="text-sm text-slate-500">Loading the file…</p>
          ) : attachments.length ? (
            attachments.map((attachment) => (
              <DocumentFile attachment={attachment} key={attachment.id} />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No file attached. Add a photo or the PDF from the document&apos;s card.
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    // Over the app's own chrome: at a checkpoint the document is the only thing on screen.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white" data-testid="document-checkpoint">
      <div className="mx-auto max-w-lg px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <header className="mb-4 flex items-center gap-2">
          {backLink}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black text-slate-900">
              {documentKind ? documentKindTitles[documentKind] : 'Document'}
            </h1>
            {vehicleQuery.data ? (
              <p className="text-sm font-bold tabular-nums text-slate-500">
                {vehicleQuery.data.registrationNumber}
              </p>
            ) : null}
          </div>
        </header>
        {body}
      </div>
    </div>
  );
}
