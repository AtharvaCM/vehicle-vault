import { Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useUpdateVehicleOdometer } from '@/features/vehicles/hooks/use-update-vehicle-odometer';

type OdometerQuickUpdateProps = {
  vehicleId: string;
  displayName: string;
  /** The stored reading; a new one may not go below it. */
  odometer: number;
};

type FormError = {
  message: string;
  /** Only a lower reading is fixed elsewhere: on the vehicle's edit form. */
  offerEdit: boolean;
};

/**
 * The most frequent correction in the app, in one tap and one number: the
 * odometer every forecast and alert is measured from. It only moves forward —
 * the API refuses a lower reading too — and the edit form stays the place to
 * fix a reading that was typed wrong.
 */
export function OdometerQuickUpdate({
  displayName,
  odometer,
  vehicleId,
}: OdometerQuickUpdateProps) {
  const updateOdometer = useUpdateVehicleOdometer(vehicleId);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(odometer));
  const [error, setError] = useState<FormError | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Start from the stored reading each time, so the input never shows a
      // stale draft from an earlier, abandoned attempt.
      setValue(String(odometer));
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const reading = Number(value);

    if (value.trim() === '' || !Number.isInteger(reading) || reading < 0) {
      setError({ message: 'Enter the reading in whole kilometres.', offerEdit: false });
      return;
    }
    if (reading < odometer) {
      setError({
        message: `The odometer already reads ${odometer.toLocaleString('en-IN')} km, so a lower reading can't be saved here.`,
        offerEdit: true,
      });
      return;
    }

    try {
      await updateOdometer.mutateAsync(reading);
    } catch (mutationError) {
      // The API words its own refusal, including a lower reading that raced in
      // from somewhere else (a fuel log, another tab).
      setError({ message: getApiErrorMessage(mutationError), offerEdit: false });
      return;
    }

    setOpen(false);
    appToast.success({
      title: 'Odometer updated',
      description: `${displayName} now reads ${reading.toLocaleString('en-IN')} km.`,
    });
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Update odometer for ${displayName}`}
          className="rounded-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          Update
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form className="space-y-3" noValidate onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor={`odometer-${vehicleId}`}>New reading (km)</Label>
            <Input
              aria-describedby={error ? `odometer-${vehicleId}-error` : undefined}
              aria-invalid={Boolean(error)}
              autoFocus
              id={`odometer-${vehicleId}`}
              inputMode="numeric"
              min={odometer}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              step={1}
              type="number"
              value={value}
            />
          </div>
          {error ? (
            <p className="text-xs text-rose-600" id={`odometer-${vehicleId}-error`} role="alert">
              {error.message}
              {error.offerEdit ? (
                <>
                  {' '}
                  <Link
                    className="font-semibold underline"
                    params={{ vehicleId }}
                    to="/vehicles/$vehicleId/edit"
                  >
                    Edit the vehicle
                  </Link>{' '}
                  to correct a mistyped reading.
                </>
              ) : null}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)} size="sm" type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={updateOdometer.isPending} size="sm" type="submit">
              {updateOdometer.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
