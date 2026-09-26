import { Link } from '@tanstack/react-router';
import type { VehicleDocumentKind } from '@vehicle-vault/shared';
import { Check, CloudOff, FileText, X } from 'lucide-react';

import { NumberPlate } from '@/components/shared/number-plate';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { endpoints } from '@/lib/api/endpoints';
import { openApiFileInNewTab } from '@/lib/api/open-api-file';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import { useAttachmentObjectUrl, useObjectUrl } from '../hooks/use-attachment-object-url';
import {
  useIsOnline,
  useShowPapers,
  type PapersView,
  type ShownFile,
  type ShownPaper,
} from '../hooks/use-show-papers';
import { documentKindTitles } from '../utils/document-kind-labels';
import { PAPER_TAB_LABELS } from '../utils/papers-to-show';

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

/** Within this many days of running out, the banner says so. */
const RUNS_OUT_SOON_DAYS = 30;

const day = (date: Date | string) => format.date(date);

type Validity =
  | { state: 'expired'; endDate: Date | string }
  | { state: 'expiring'; endDate: Date | string; days: number }
  | { state: 'valid'; endDate: Date | string | null };

export function validityOf(paper: Pick<ShownPaper, 'endDate'>, today = new Date()): Validity {
  const days = format.daysUntil(paper.endDate, today);
  if (days === null || !paper.endDate) return { state: 'valid', endDate: null };
  if (days < 0) return { state: 'expired', endDate: paper.endDate };
  if (days <= RUNS_OUT_SOON_DAYS) return { state: 'expiring', endDate: paper.endDate, days };
  return { state: 'valid', endDate: paper.endDate };
}

/** The status, said plainly and in colour, first thing on the screen. */
function ValidityBanner({ validity }: { validity: Validity }) {
  const [tone, word, line] =
    validity.state === 'expired'
      ? ['bg-late text-on-late', 'EXPIRED', `Ran out on ${day(validity.endDate)}`]
      : validity.state === 'expiring'
        ? [
            'bg-soon-dot text-on-soon',
            'RUNS OUT SOON',
            `Valid until ${day(validity.endDate)}, ${
              validity.days === 0
                ? 'runs out today'
                : `${validity.days} day${validity.days === 1 ? '' : 's'} left`
            }`,
          ]
        : [
            'bg-ok text-on-ok',
            'VALID',
            validity.endDate ? `Until ${day(validity.endDate)}` : 'Does not expire',
          ];

  return (
    <div className={cn('flex flex-col gap-1 rounded-2xl px-5 py-4', tone)} role="status">
      <p className="font-display text-title font-bold tracking-wide">{word}</p>
      <p className="text-body font-semibold">{line}</p>
    </div>
  );
}

function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** A photo shown in place: live from the API, the saved copy meanwhile or without signal. */
function PaperImage({ file }: { file: ShownFile }) {
  const live = useAttachmentObjectUrl(file.live ? file.id : null);
  const savedUrl = useObjectUrl(file.saved?.blob);
  const src = live.objectUrl ?? savedUrl;

  if (src) {
    return (
      <img
        alt={file.name}
        className="w-full rounded-xl border border-line object-contain"
        src={src}
      />
    );
  }
  let message = 'Loading the photo…';
  if (!file.live) message = `${file.name} wasn't saved on this phone.`;
  else if (live.isError) message = `Couldn't load ${file.name}.`;
  return (
    <p className="rounded-xl border border-dashed border-line p-4 text-ui text-fg-3">{message}</p>
  );
}

/** Anything but a photo, a PDF say, opens on its own: the saved copy offline. */
function PaperDocumentFile({ file, online }: { file: ShownFile; online: boolean }) {
  const saved = file.saved?.blob ?? null;

  if (!saved && !(file.live && online)) {
    return (
      <p className="rounded-xl border border-dashed border-line p-4 text-ui text-fg-3">
        {file.name} isn&apos;t saved on this phone. It opens when there&apos;s signal.
      </p>
    );
  }

  return (
    <Button
      className="h-12 w-full justify-start gap-2 text-body"
      onClick={() => {
        if (file.live && online) {
          openApiFileInNewTab(endpoints.attachments.file(file.id)).catch((error) => {
            if (saved) openBlob(saved);
            else appToast.error({ title: getApiErrorMessage(error, 'Could not open the file') });
          });
        } else if (saved) {
          openBlob(saved);
        }
      }}
      variant="outline"
    >
      <FileText aria-hidden="true" className="h-5 w-5" />
      Open {file.name}
    </Button>
  );
}

function PaperPanel({
  paper,
  online,
  canAddFiles,
}: {
  paper: ShownPaper;
  online: boolean;
  canAddFiles: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ValidityBanner validity={validityOf(paper)} />

      <dl className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-small text-fg-3">{NUMBER_LABELS[paper.kind]}</dt>
          {paper.number ? (
            <dd className="break-all font-mono text-title font-semibold text-fg">{paper.number}</dd>
          ) : (
            <dd className="text-heading font-bold text-fg-3">Not recorded</dd>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-small text-fg-3">{ISSUER_LABELS[paper.kind]}</dt>
          <dd className={cn('text-lead font-semibold', paper.provider ? 'text-fg' : 'text-fg-3')}>
            {paper.provider ?? 'Not recorded'}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-small text-fg-3">Valid</dt>
          <dd className="text-lead font-semibold text-fg">
            {paper.startDate ? `${day(paper.startDate)} to ` : 'Until '}
            {paper.endDate ? day(paper.endDate) : 'no expiry'}
          </dd>
        </div>
      </dl>

      <section aria-label={documentKindTitles[paper.kind]} className="flex flex-col gap-3">
        {paper.files === null ? (
          <p className="text-ui text-fg-3">Loading the file…</p>
        ) : paper.files.length ? (
          paper.files.map((file) =>
            file.mimeType.startsWith('image/') ? (
              <PaperImage file={file} key={file.id} />
            ) : (
              <PaperDocumentFile file={file} key={file.id} online={online} />
            ),
          )
        ) : (
          <p className="rounded-xl border border-dashed border-line p-4 text-ui text-fg-3">
            {canAddFiles
              ? "No file attached. Add a photo or the PDF from the paper's card."
              : 'No file attached.'}
          </p>
        )}
      </section>
    </div>
  );
}

/** Whether what's on screen will be there without signal, and how fresh it is. */
function SavedLine({ view }: { view: PapersView }) {
  if (view.status !== 'ready' || !view.savedAt) return <span />;

  if (view.source === 'saved') {
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-small text-fg-2">
        <CloudOff aria-hidden="true" className="size-3.5 shrink-0" />
        <span>Saved on this phone · updated {format.date(view.savedAt, 'dateTime')}</span>
      </p>
    );
  }
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-small text-fg-2">
      <Check aria-hidden="true" className="size-3.5 shrink-0" />
      <span>Saved on this phone · works offline</span>
    </p>
  );
}

type ShowPapersPageProps = {
  vehicleId: string;
  /** The paper whose tab is open; the first on file when absent or not on this vehicle. */
  paper?: VehicleDocumentKind;
  /** An old per-document link's document, shown in its kind's tab. */
  documentId?: string;
  onPaperChange: (paper: VehicleDocumentKind) => void;
  onClose: () => void;
};

/**
 * Every paper of one vehicle, the way they get shown when someone asks: a
 * phone held at arm's length, in a hurry, maybe with one bar of signal. Full
 * screen over the app, the XL plate, then a tab per paper: status first, the
 * number large, the issuer, the validity and the file. A copy stays on the
 * device, so it opens offline too. Anyone the vehicle is shared with can open it.
 */
export function ShowPapersPage({
  vehicleId,
  paper,
  documentId,
  onPaperChange,
  onClose,
}: ShowPapersPageProps) {
  const view = useShowPapers(vehicleId, documentId);
  const online = useIsOnline();

  let body: React.ReactNode;
  if (view.status === 'loading') {
    body = <p className="text-body text-fg-3">Loading the papers…</p>;
  } else if (view.status === 'gone') {
    body = (
      <p className="text-body text-fg-2">
        This vehicle isn&apos;t in your garage, or it&apos;s no longer shared with you.
      </p>
    );
  } else if (view.status === 'unavailable') {
    body = <p className="text-body text-fg-2">{view.message}</p>;
  } else if (view.papers.length === 0) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-body text-fg-2">No papers on file for this vehicle yet.</p>
        {view.canEdit ? (
          <Link
            className={buttonVariants({ variant: 'outline' })}
            params={{ vehicleId }}
            search={{ tab: 'papers' }}
            to="/vehicles/$vehicleId"
          >
            Add a paper
          </Link>
        ) : null}
      </div>
    );
  } else {
    const active = view.papers.find((item) => item.kind === paper)?.kind ?? view.papers[0]!.kind;
    body = (
      <Tabs
        className="flex flex-col gap-5"
        onValueChange={(value) => onPaperChange(value as VehicleDocumentKind)}
        value={active}
      >
        <TabsList aria-label="Papers" className="relative flex w-full overflow-x-auto">
          {view.papers.map((item) => (
            <TabsTrigger
              className="min-w-fit flex-1 px-2 text-ui"
              key={item.kind}
              value={item.kind}
            >
              {PAPER_TAB_LABELS[item.kind]}
            </TabsTrigger>
          ))}
        </TabsList>
        {view.papers.map((item) => (
          <TabsContent className="mt-0" key={item.kind} value={item.kind}>
            <PaperPanel canAddFiles={view.canEdit} online={online} paper={item} />
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  const vehicle = view.status === 'ready' ? view.vehicle : null;

  return (
    // Over the app's own chrome: at a checkpoint the papers are the only thing on screen.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface" data-testid="show-papers">
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <SavedLine view={view} />
          <Button
            aria-label="Close"
            className="-mr-2 shrink-0"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-6" />
          </Button>
        </div>

        <h1 className="sr-only">
          Papers
          {vehicle?.registrationNumber
            ? ` for ${format.registration(vehicle.registrationNumber)}`
            : ''}
        </h1>
        {vehicle ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <NumberPlate
              electric={vehicle.electric}
              registration={vehicle.registrationNumber}
              size="xl"
            />
            <p className="text-body text-fg-2">{vehicle.description}</p>
          </div>
        ) : null}

        {body}
      </div>
    </div>
  );
}
