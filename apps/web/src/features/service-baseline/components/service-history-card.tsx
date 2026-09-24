import { useEffect, useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { ServiceBaselineStatus, type VehicleServiceBaselineEntry } from '@vehicle-vault/shared';

import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

import {
  useServiceBaselineCoverage,
  useUpsertServiceBaseline,
} from '../hooks/use-service-baseline';
import {
  buildBaselineEntries,
  deriveDrafts,
  isEditable,
  type BaselineDrafts,
} from '../utils/baseline-drafts';
import { useVehicleAccess } from '@/features/vehicles/context/vehicle-access';

interface ServiceHistoryCardProps {
  vehicleId: string;
}

export function ServiceHistoryCard({ vehicleId }: ServiceHistoryCardProps) {
  const { canEdit } = useVehicleAccess();
  const coverageQuery = useServiceBaselineCoverage(vehicleId);
  const upsertMutation = useUpsertServiceBaseline(vehicleId);
  const [drafts, setDrafts] = useState<BaselineDrafts>({});

  const entries = useMemo(() => coverageQuery.data?.entries ?? [], [coverageQuery.data]);

  // Re-seeded whenever the server view changes, so a save leaves the inputs
  // showing what was actually stored rather than what was typed.
  useEffect(() => {
    setDrafts(deriveDrafts(entries));
  }, [entries]);

  const pending = useMemo(() => buildBaselineEntries(entries, drafts), [entries, drafts]);

  function setDraft(category: string, status: ServiceBaselineStatus, odometer: string) {
    setDrafts((current) => ({ ...current, [category]: { status, odometer } }));
  }

  function handleOdometerChange(category: string, value: string) {
    setDraft(category, ServiceBaselineStatus.Known, value);
  }

  function toggleUnknown(category: string) {
    setDrafts((current) => {
      const draft = current[category];
      const nowUnknown = draft?.status !== ServiceBaselineStatus.Unknown;

      return {
        ...current,
        [category]: nowUnknown
          ? { status: ServiceBaselineStatus.Unknown, odometer: '' }
          : { status: 'unset', odometer: '' },
      };
    });
  }

  async function handleSave() {
    try {
      await upsertMutation.mutateAsync({ entries: pending });
      appToast.success({
        title: 'Service history updated',
        description: `Saved ${pending.length} ${pending.length === 1 ? 'category' : 'categories'}.`,
      });
    } catch (error) {
      appToast.error({
        title: 'Could not save service history',
        description: getApiErrorMessage(error),
      });
    }
  }

  if (coverageQuery.isPending) {
    return (
      <LoadingState
        description="Checking what is already known about this vehicle."
        title="Service history baseline"
      />
    );
  }

  if (coverageQuery.isError) {
    return (
      <ErrorState
        action={
          <Button onClick={() => void coverageQuery.refetch()} variant="outline">
            Try again
          </Button>
        }
        description={getApiErrorMessage(coverageQuery.error)}
        title="Could not load service history"
      />
    );
  }

  const unanswered = coverageQuery.data?.unansweredCount ?? 0;

  return (
    <Card className="border-line/60 bg-surface/70">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lead font-bold">Service history baseline</CardTitle>
          {unanswered > 0 ? <Badge variant="secondary">{unanswered} unanswered</Badge> : null}
        </div>
        <CardDescription>
          What was already done when this vehicle joined the vault. Reminders are timed from these
          figures — a category with nothing on file is measured from the day you added the vehicle,
          which quietly assumes it had just been done. Saying “I don’t know” is a real answer here,
          and a more useful one than leaving it blank.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {entries.map((entry) => (
          <BaselineRow
            key={entry.category}
            entry={entry}
            draft={drafts[entry.category]}
            onOdometerChange={(value) => handleOdometerChange(entry.category, value)}
            onToggleUnknown={() => toggleUnknown(entry.category)}
            readOnly={!canEdit}
          />
        ))}

        {canEdit ? (
          <div className="flex items-center justify-end gap-3 pt-2">
            <p className="text-caption text-fg-3">
              {pending.length === 0
                ? 'No changes to save'
                : `${pending.length} ${pending.length === 1 ? 'change' : 'changes'} ready`}
            </p>
            <Button
              disabled={pending.length === 0 || upsertMutation.isPending}
              onClick={() => void handleSave()}
            >
              {upsertMutation.isPending ? 'Saving…' : 'Save history'}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface BaselineRowProps {
  entry: VehicleServiceBaselineEntry;
  draft: BaselineDrafts[string] | undefined;
  onOdometerChange: (value: string) => void;
  onToggleUnknown: () => void;
  /** Someone who can see the vehicle but not change it: the answer, not the form. */
  readOnly?: boolean;
}

function BaselineRow({
  entry,
  draft,
  onOdometerChange,
  onToggleUnknown,
  readOnly = false,
}: BaselineRowProps) {
  const label = format.enumLabel('maintenanceCategory', entry.category);

  if (readOnly && isEditable(entry)) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/60 bg-page/60 px-3 py-2">
        <span className="text-ui font-medium text-fg-2">{label}</span>
        <span className="text-caption text-fg-3">{describeAnswer(entry)}</span>
      </div>
    );
  }

  if (!isEditable(entry)) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/60 bg-page/60 px-3 py-2">
        <span className="text-ui font-medium text-fg-2">{label}</span>
        <span className="text-caption text-fg-3">
          Logged service at {format.odometer(entry.lastDoneOdometer)}
        </span>
      </div>
    );
  }

  const isUnknown = draft?.status === ServiceBaselineStatus.Unknown;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line/60 px-3 py-2">
      <span className="min-w-32 flex-1 text-ui font-medium text-fg-2">{label}</span>

      <div className="flex items-center gap-2">
        <Input
          aria-label={`${label} last done at odometer`}
          className="w-32"
          disabled={isUnknown}
          inputMode="numeric"
          onChange={(event) => onOdometerChange(event.target.value)}
          placeholder="Last done at km"
          value={isUnknown ? '' : (draft?.odometer ?? '')}
        />
        <Button
          aria-pressed={isUnknown}
          onClick={onToggleUnknown}
          size="sm"
          type="button"
          variant={isUnknown ? 'default' : 'outline'}
        >
          <HelpCircle className="mr-1 h-3.5 w-3.5" />
          Don’t know
        </Button>
      </div>
    </div>
  );
}

/** What the owner has said about a category, for someone who cannot change it. */
function describeAnswer(entry: VehicleServiceBaselineEntry): string {
  if (entry.source === 'declared-unknown') return 'Marked as not known';
  if (entry.source === 'baseline' && entry.lastDoneOdometer != null) {
    return `Last done at ${format.odometer(entry.lastDoneOdometer)}`;
  }
  if (entry.source === 'baseline') return 'Answered without an odometer reading';
  return 'Not answered yet';
}
