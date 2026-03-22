import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  VehicleCatalogImportRunDetail,
  VehicleCatalogImportRunReview,
  VehicleCatalogPublishedOfferingReview,
} from '@vehicle-vault/shared';
import { CheckCheck, DatabaseZap, GitCompareArrows, PencilLine, Save, ScanSearch, X } from 'lucide-react';

import { InlineError } from '@/components/shared/inline-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { formatDate } from '@/lib/utils/format-date';
import { appToast } from '@/lib/toast';

import { useCatalogImportRunDetail } from '../hooks/use-catalog-import-run-detail';
import { useCatalogImportRuns } from '../hooks/use-catalog-import-runs';
import { useArchiveMissingCatalogImportRun } from '../hooks/use-archive-missing-catalog-import-run';
import { usePublishCatalogImportRun } from '../hooks/use-publish-catalog-import-run';
import { useUpdateVehicleCatalogOfferingReview } from '../hooks/use-update-vehicle-catalog-offering-review';

export function CatalogImportReviewCard() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const runsQuery = useCatalogImportRuns();
  const detailQuery = useCatalogImportRunDetail(selectedRunId);
  const archiveMissingMutation = useArchiveMissingCatalogImportRun();
  const publishMutation = usePublishCatalogImportRun();
  const updateOfferingReviewMutation = useUpdateVehicleCatalogOfferingReview();

  const selectedRun = useMemo(
    () => runsQuery.data?.find((run) => run.id === selectedRunId) ?? null,
    [runsQuery.data, selectedRunId],
  );

  async function handlePublish(runId: string) {
    try {
      const run = await publishMutation.mutateAsync(runId);
      appToast.success({
        title: 'Catalog import published',
        description: `${formatSourceLabel(run.sourceKey)} is now part of the trusted vehicle catalog.`,
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to publish catalog import',
        description: getApiErrorMessage(
          error,
          "We couldn't publish that catalog import run right now.",
        ),
      });
    }
  }

  async function handleArchiveMissing(runId: string) {
    try {
      const run = await archiveMissingMutation.mutateAsync(runId);
      appToast.success({
        title: 'Missing variants archived',
        description:
          run.diff.missingVariants.length === 0
            ? 'Missing source variants were marked as historical and removed from the active diff.'
            : 'Some source rows are still missing from the staged snapshot and need review.',
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to archive missing variants',
        description: getApiErrorMessage(
          error,
          "We couldn't archive the missing source variants right now.",
        ),
      });
    }
  }

  return (
    <>
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Catalog review</CardTitle>
          <CardDescription>
            Internal catalog operations. Review staged source imports before publishing them into the
            trusted make/model/variant catalog.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {runsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ) : runsQuery.isError ? (
            <InlineError
              message={getApiErrorMessage(
                runsQuery.error,
                "We couldn't load the catalog review queue right now.",
              )}
            />
          ) : !runsQuery.data?.length ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-slate-50/70 p-5 text-sm text-slate-600">
              No import runs have been staged yet. Run `pnpm catalog:import:all` to capture the next review batch.
            </div>
          ) : (
            <div className="space-y-3">
              {runsQuery.data.map((run) => (
                <RunRow
                  key={run.id}
                  isPublishing={publishMutation.isPending && publishMutation.variables === run.id}
                  onOpen={() => {
                    setSelectedRunId(run.id);
                  }}
                  onPublish={() => {
                    void handlePublish(run.id);
                  }}
                  run={run}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRunId(null);
          }
        }}
        open={Boolean(selectedRunId)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRun ? formatSourceLabel(selectedRun.sourceKey) : 'Catalog import'}
            </DialogTitle>
            <DialogDescription>
              Review the staged source snapshot, compare it with the current published catalog data,
              and publish it when the diff looks right.
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-44 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : detailQuery.isError ? (
            <InlineError
              message={getApiErrorMessage(
                detailQuery.error,
                "We couldn't load the catalog import review details.",
              )}
            />
          ) : detailQuery.data ? (
            <CatalogImportDetail
              isArchiving={archiveMissingMutation.isPending}
              detail={detailQuery.data}
              onArchiveMissing={() => {
                void handleArchiveMissing(detailQuery.data.id);
              }}
              isPublishing={publishMutation.isPending}
              onPublish={() => {
                void handlePublish(detailQuery.data.id);
              }}
              onSaveOfferingReview={async (offeringId, input) => {
                try {
                  const updated = await updateOfferingReviewMutation.mutateAsync({
                    offeringId,
                    input,
                    runId: detailQuery.data.id,
                  });
                  appToast.success({
                    title: 'Catalog review saved',
                    description: `${updated.variantName} now keeps its reviewed year range and source note.`,
                  });
                } catch (error) {
                  appToast.error({
                    title: 'Unable to save catalog review',
                    description: getApiErrorMessage(
                      error,
                      "We couldn't save that catalog correction right now.",
                    ),
                  });
                  throw error;
                }
              }}
              savingOfferingId={updateOfferingReviewMutation.isPending ? updateOfferingReviewMutation.variables?.offeringId : undefined}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RunRow({
  run,
  onOpen,
  onPublish,
  isPublishing,
}: {
  run: VehicleCatalogImportRunReview;
  onOpen: () => void;
  onPublish: () => void;
  isPublishing: boolean;
}) {
  const canPublish = run.status === 'succeeded' && !run.publishedAt;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-900">{formatSourceLabel(run.sourceKey)}</p>
          <RunStateBadge run={run} />
          <Badge tone="neutral">{run.marketCode}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Captured {run.snapshotCapturedAt ? formatDate(run.snapshotCapturedAt, { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown'}</span>
          <span>{run.diff.newModels.length} new models</span>
          <span>{run.diff.newVariants.length} new variants</span>
          <span>{run.diff.changedVariants.length} changed variants</span>
          <span>{run.diff.missingVariants.length} missing from snapshot</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onOpen} type="button" variant="outline">
          <GitCompareArrows className="mr-2 h-4 w-4" />
          Review diff
        </Button>
        {canPublish ? (
          <Button disabled={isPublishing} onClick={onPublish} type="button">
            <CheckCheck className="mr-2 h-4 w-4" />
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CatalogImportDetail({
  detail,
  onArchiveMissing,
  isArchiving,
  onPublish,
  isPublishing,
  onSaveOfferingReview,
  savingOfferingId,
}: {
  detail: VehicleCatalogImportRunDetail;
  onArchiveMissing: () => void;
  isArchiving: boolean;
  onPublish: () => void;
  isPublishing: boolean;
  onSaveOfferingReview: (
    offeringId: string,
    input: {
      isCurrent?: boolean;
      reviewNote?: string | null;
      yearEnd?: number | null;
      yearStart?: number | null;
    },
  ) => Promise<void>;
  savingOfferingId?: string;
}) {
  const canPublish = detail.status === 'succeeded' && !detail.publishedAt;
  const canArchiveMissing = canPublish && detail.diff.missingVariants.length > 0;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          label="Incoming variants"
          value={detail.diff.incomingCounts.variants}
          icon={<DatabaseZap className="h-4 w-4" />}
        />
        <SummaryMetric
          label="Published variants"
          value={detail.diff.publishedCounts.variants}
          icon={<GitCompareArrows className="h-4 w-4" />}
        />
        <SummaryMetric
          label="New variants"
          value={detail.diff.newVariants.length}
          icon={<CheckCheck className="h-4 w-4" />}
        />
        <SummaryMetric
          label="Missing from snapshot"
          value={detail.diff.missingVariants.length}
          icon={<ScanSearch className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
        <div className="space-y-4 rounded-2xl border border-border/70 bg-slate-50/70 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Diff summary</p>
            <p className="text-sm text-slate-600">
              Compare this staged snapshot with what is currently published for the same source key.
            </p>
          </div>
          <DiffList label="New models" values={detail.diff.newModels} />
          <DiffList label="New variants" values={detail.diff.newVariants} />
          <DiffList label="Changed variants" values={detail.diff.changedVariants} />
          <DiffList
            label="Missing from snapshot"
            values={detail.diff.missingVariants}
            emptyCopy="No current source variants are missing from this staged snapshot."
          />
        </div>

        <div className="space-y-4 rounded-2xl border border-border/70 bg-white p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Snapshot contents</p>
            <p className="text-sm text-slate-600">
              This is the staged catalog payload that will be published if approved.
            </p>
          </div>
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {detail.dataset.map((make) => (
              <div key={`${make.marketCode}-${make.vehicleType}-${make.name}`} className="rounded-xl border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">{make.name}</p>
                  <Badge tone="accent">{make.vehicleType}</Badge>
                </div>
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  {make.models.map((model) => (
                    <div key={model.name} className="rounded-xl bg-slate-50/80 px-3 py-2">
                      <p className="font-medium text-slate-900">{model.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {model.generations.length} generation{model.generations.length === 1 ? '' : 's'} ·{' '}
                        {model.generations.reduce((count, generation) => count + generation.variants.length, 0)} variants
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/70 bg-white p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">Published source reviews</p>
          <p className="text-sm text-slate-600">
            Add provenance notes or correct ambiguous year ranges on the currently published source rows.
            Those corrections stay attached to future imports for the same source.
          </p>
        </div>
        {detail.publishedOfferings.length ? (
          <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {detail.publishedOfferings.map((offering) => (
              <PublishedOfferingReviewRow
                key={offering.id}
                offering={offering}
                onSave={onSaveOfferingReview}
                saving={savingOfferingId === offering.id}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No published source data exists for this importer yet. Publish the first trusted run before
            manual provenance review is needed.
          </p>
        )}
      </div>

      <DialogFooter>
        {canPublish ? (
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            {canArchiveMissing ? (
              <Button disabled={isArchiving} onClick={onArchiveMissing} type="button" variant="outline">
                <ScanSearch className="mr-2 h-4 w-4" />
                {isArchiving ? 'Archiving missing...' : 'Archive missing as historical'}
              </Button>
            ) : null}
            <Button disabled={isPublishing} onClick={onPublish} type="button">
              <CheckCheck className="mr-2 h-4 w-4" />
              {isPublishing ? 'Publishing import...' : 'Approve and publish'}
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border/70 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {detail.publishedAt
              ? `Published ${formatDate(detail.publishedAt, { dateStyle: 'medium', timeStyle: 'short' })}`
              : 'Only successful staged runs can be published.'}
          </div>
        )}
      </DialogFooter>
    </>
  );
}

function PublishedOfferingReviewRow({
  offering,
  onSave,
  saving,
}: {
  offering: VehicleCatalogPublishedOfferingReview;
  onSave: (
    offeringId: string,
    input: {
      isCurrent?: boolean;
      reviewNote?: string | null;
      yearEnd?: number | null;
      yearStart?: number | null;
    },
  ) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [yearStart, setYearStart] = useState(offering.yearStart?.toString() ?? '');
  const [yearEnd, setYearEnd] = useState(offering.yearEnd?.toString() ?? '');
  const [isCurrent, setIsCurrent] = useState(offering.isCurrent);
  const [reviewNote, setReviewNote] = useState(offering.reviewNote ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setYearStart(offering.yearStart?.toString() ?? '');
    setYearEnd(offering.yearEnd?.toString() ?? '');
    setIsCurrent(offering.isCurrent);
    setReviewNote(offering.reviewNote ?? '');
    setLocalError(null);
    setEditing(false);
  }, [offering]);

  async function handleSave() {
    let parsedYearStart: number | null;
    let parsedYearEnd: number | null;

    try {
      parsedYearStart = parseOptionalYear(yearStart);
      parsedYearEnd = parseOptionalYear(yearEnd);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Enter valid four-digit years.');
      return;
    }

    if (parsedYearStart !== null && parsedYearEnd !== null && parsedYearEnd < parsedYearStart) {
      setLocalError('End year cannot be earlier than start year.');
      return;
    }

    setLocalError(null);

    try {
      await onSave(offering.id, {
        yearStart: parsedYearStart,
        yearEnd: parsedYearEnd,
        isCurrent,
        reviewNote: reviewNote.trim() ? reviewNote.trim() : null,
      });
      setEditing(false);
    } catch {
      // Toast is handled by the parent mutation wrapper.
    }
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-slate-50/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900">{offering.variantName}</p>
            <Badge tone="accent">{formatFuelTypes(offering.fuelTypes)}</Badge>
            <Badge tone="neutral">{formatYearRange(offering.yearStart, offering.yearEnd, offering.isCurrent)}</Badge>
            {offering.manualOverrideApplied ? <Badge tone="warning">Reviewed</Badge> : null}
          </div>
          <p className="text-sm text-slate-600">
            {offering.makeName} / {offering.modelName} / {offering.generationName}
          </p>
          {offering.reviewNote ? (
            <p className="text-sm leading-6 text-slate-600">
              <span className="font-medium text-slate-900">Source note:</span> {offering.reviewNote}
            </p>
          ) : (
            <p className="text-sm text-slate-500">No manual provenance note added yet.</p>
          )}
        </div>

        <Button
          onClick={() => {
            setEditing((current) => !current);
            setLocalError(null);
          }}
          type="button"
          variant="outline"
        >
          {editing ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </>
          ) : (
            <>
              <PencilLine className="mr-2 h-4 w-4" />
              Review
            </>
          )}
        </Button>
      </div>

      {editing ? (
        <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Start year
              </label>
              <Input
                inputMode="numeric"
                maxLength={4}
                onChange={(event) => {
                  setYearStart(event.target.value);
                }}
                placeholder="e.g. 2022"
                value={yearStart}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                End year
              </label>
              <Input
                inputMode="numeric"
                maxLength={4}
                onChange={(event) => {
                  setYearEnd(event.target.value);
                }}
                placeholder={isCurrent ? 'Leave empty for current' : 'e.g. 2025'}
                value={yearEnd}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              checked={isCurrent}
              className="h-4 w-4 rounded border border-slate-300 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => {
                const nextChecked = event.target.checked;
                setIsCurrent(nextChecked);
                if (nextChecked) {
                  setYearEnd('');
                }
              }}
              type="checkbox"
            />
            Mark this offering as currently active
          </label>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Provenance note
            </label>
            <Textarea
              maxLength={500}
              onChange={(event) => {
                setReviewNote(event.target.value);
              }}
              placeholder="Add context such as brochure ambiguity, OEM rename history, or manual year correction rationale."
              rows={3}
              value={reviewNote}
            />
          </div>

          {localError ? <InlineError message={localError} /> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              onClick={() => {
                setEditing(false);
                setLocalError(null);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void handleSave()} type="button">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving review...' : 'Save review'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{label}</p>
        <span className="text-slate-400">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function DiffList({
  label,
  values,
  emptyCopy = 'No changes detected in this category.',
}: {
  label: string;
  values: string[];
  emptyCopy?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      {values.length ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <Badge key={value} tone="neutral">
              {value}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">{emptyCopy}</p>
      )}
    </div>
  );
}

function RunStateBadge({ run }: { run: VehicleCatalogImportRunReview }) {
  if (run.publishedAt) {
    return <Badge tone="accent">Published</Badge>;
  }

  if (run.status === 'failed') {
    return <Badge tone="danger">Failed</Badge>;
  }

  if (run.status === 'running') {
    return <Badge tone="warning">Running</Badge>;
  }

  return <Badge tone="warning">Staged</Badge>;
}

function formatSourceLabel(sourceKey: string) {
  return sourceKey
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatFuelTypes(fuelTypes: string[]) {
  return fuelTypes.map((fuelType) => fuelType.toUpperCase()).join(' / ');
}

function formatYearRange(
  yearStart?: number,
  yearEnd?: number,
  isCurrent?: boolean,
) {
  if (yearStart && yearEnd) {
    return `${yearStart} to ${yearEnd}`;
  }

  if (yearStart && isCurrent) {
    return `${yearStart} to current`;
  }

  if (yearStart) {
    return `From ${yearStart}`;
  }

  if (yearEnd) {
    return `Until ${yearEnd}`;
  }

  return isCurrent ? 'Current' : 'Year not set';
}

function parseOptionalYear(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d{4}$/.test(trimmed)) {
    throw new Error('Year must be a four-digit number.');
  }

  return Number(trimmed);
}
