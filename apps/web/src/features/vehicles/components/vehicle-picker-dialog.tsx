import { Link, type LinkProps } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { Button, buttonVariants, type TextButtonSize } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { accessFor } from '../context/vehicle-access';
import type { Vehicle } from '../types/vehicle';
import { getVehicleDisplayName } from '../utils/get-vehicle-display-name';

export type VehiclePickerVehicle = Pick<
  Vehicle,
  'id' | 'nickname' | 'make' | 'model' | 'registrationNumber' | 'currentUserRole'
>;

type VehiclePickerDialogProps = {
  /** The account's vehicles, unfiltered — viewer-only ones are excluded here. */
  vehicles: VehiclePickerVehicle[];
  /**
   * The vehicles query is still pending: `vehicles` is only `[]` because
   * nothing has loaded yet, not because the account truly has none. Render a
   * disabled trigger rather than risk showing "Add a vehicle" to an owner who
   * already has some.
   */
  isLoading?: boolean;
  /** Builds the typed link for a chosen vehicle, e.g. `/vehicles/$vehicleId/maintenance/new`. */
  buildLink: (vehicleId: string) => LinkProps;
  /** Label for the trigger when there is at least one editable vehicle. */
  triggerLabel: string;
  /** Label shown instead when there is nothing editable to pick from. */
  addVehicleLabel?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: TextButtonSize;
  className?: string;
};

/**
 * "Pick a vehicle, then go": the shared launcher behind an action that needs a
 * vehicle id before it can open a form (log maintenance, create a reminder).
 * Viewer-only vehicles can never open these forms, so they never appear here.
 *
 * - Still loading: a disabled button with the normal trigger label — never
 *   the add-vehicle link, which would wrongly imply there are none.
 * - No editable vehicle: a plain link to add one — there is nothing to pick.
 * - Exactly one: a plain link straight to its form, no dialog in the way.
 * - Several: a button that opens a dialog listing them by name.
 */
export function VehiclePickerDialog({
  vehicles,
  isLoading = false,
  buildLink,
  triggerLabel,
  addVehicleLabel = 'Add vehicle',
  dialogTitle = 'Choose a vehicle',
  dialogDescription = 'Pick which vehicle this is for.',
  variant = 'default',
  size = 'default',
  className,
}: VehiclePickerDialogProps) {
  const [open, setOpen] = useState(false);

  const editableVehicles = useMemo(
    () => vehicles.filter((vehicle) => accessFor(vehicle.currentUserRole ?? null).canEdit),
    [vehicles],
  );
  const sortedVehicles = useMemo(
    () =>
      [...editableVehicles].sort((a, b) =>
        getVehicleDisplayName(a).localeCompare(getVehicleDisplayName(b)),
      ),
    [editableVehicles],
  );

  const [onlyVehicle] = sortedVehicles;

  if (isLoading) {
    return (
      <Button className={className} disabled size={size} type="button" variant={variant}>
        {triggerLabel}
      </Button>
    );
  }

  if (!onlyVehicle) {
    return (
      <Link className={cn(buttonVariants({ variant, size }), className)} to="/vehicles/new">
        {addVehicleLabel}
      </Link>
    );
  }

  if (sortedVehicles.length === 1) {
    return (
      <Link
        {...buildLink(onlyVehicle.id)}
        className={cn(buttonVariants({ variant, size }), className)}
      >
        {triggerLabel}
      </Link>
    );
  }

  return (
    <>
      <Button
        className={className}
        onClick={() => setOpen(true)}
        size={size}
        type="button"
        variant={variant}
      >
        {triggerLabel}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {sortedVehicles.map((vehicle) => (
              <Link
                key={vehicle.id}
                {...buildLink(vehicle.id)}
                className="flex flex-col items-start gap-0.5 rounded-lg border border-input px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => setOpen(false)}
              >
                <span className="text-ui font-medium text-fg">
                  {getVehicleDisplayName(vehicle)}
                </span>
                <span className="text-caption tabular-nums text-fg-3">
                  {vehicle.registrationNumber}
                </span>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
