import { useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { OdometerUpdateForm } from './odometer-update-form';

type OdometerQuickUpdateProps = {
  vehicleId: string;
  displayName: string;
  /** The stored reading; a new one may not go below it. */
  odometer: number;
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
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Update odometer for ${displayName}`}
          // An inline word in a line of text: an invisible margin makes it a 44px target on
          // phones. The row's caption line-height is tighter than the old ambient one this
          // inherited from, so the margin is a touch taller to still clear 44px.
          className="relative rounded-sm font-semibold text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring max-md:before:absolute max-md:before:-inset-x-2 max-md:before:-inset-y-4 max-md:before:content-['']"
          type="button"
        >
          Update
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        {/* Mounted afresh on each open, so it starts from the stored reading
            rather than a draft from an abandoned attempt. */}
        <OdometerUpdateForm
          displayName={displayName}
          odometer={odometer}
          onCancel={() => setOpen(false)}
          onDone={() => setOpen(false)}
          vehicleId={vehicleId}
        />
      </PopoverContent>
    </Popover>
  );
}
