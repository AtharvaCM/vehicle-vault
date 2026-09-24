import { Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateVehicleOdometer } from '@/features/vehicles/hooks/use-update-vehicle-odometer';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

type FormError = {
  message: string;
  /** Only a lower reading is fixed elsewhere: on the vehicle's edit form. */
  offerEdit: boolean;
};

type OdometerUpdateFormProps = {
  vehicleId: string;
  displayName: string;
  /** The stored reading; a new one may not go below it. */
  odometer: number;
  onDone: () => void;
  onCancel: () => void;
};

/**
 * One number, the odometer every forecast and alert is measured from. It only
 * moves forward — the API refuses a lower reading too — and the edit form
 * stays the place to fix a reading that was typed wrong. Shared by the garage
 * card's popover and the quick-log sheet's dialog.
 */
export function OdometerUpdateForm({
  displayName,
  odometer,
  vehicleId,
  onDone,
  onCancel,
}: OdometerUpdateFormProps) {
  const updateOdometer = useUpdateVehicleOdometer(vehicleId);
  const [value, setValue] = useState(String(odometer));
  const [error, setError] = useState<FormError | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const reading = Number(value);

    if (value.trim() === '' || !Number.isInteger(reading) || reading < 0) {
      setError({ message: 'Enter the reading in whole kilometres.', offerEdit: false });
      return;
    }
    if (reading < odometer) {
      setError({
        message: `The odometer already reads ${format.odometer(odometer)}, so a lower reading can't be saved here.`,
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

    onDone();
    appToast.success({
      title: 'Odometer updated',
      description: `${displayName} now reads ${format.odometer(reading)}.`,
    });
  }

  return (
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
        <p className="text-caption text-late" id={`odometer-${vehicleId}-error`} role="alert">
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
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={updateOdometer.isPending} size="sm" type="submit">
          {updateOdometer.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
