import { useNavigate } from '@tanstack/react-router';
import {
  CalendarPlus,
  CarFront,
  ChevronLeft,
  ChevronRight,
  FileText,
  Fuel,
  Gauge,
  Plus,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FuelType } from '@vehicle-vault/shared';

import { NumberPlate } from '@/components/shared/number-plate';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { FuelLogDialog } from '@/features/dashboard/components/fuel-log-dialog';
import { OdometerUpdateForm } from '@/features/dashboard/components/odometer-update-form';
import {
  QuickLogDialog,
  type QuickLogVehicle,
} from '@/features/dashboard/components/quick-log-dialog';
import { DocumentFormDialog } from '@/features/vehicle-documents/components/document-form-dialog';
import { accessFor } from '@/features/vehicles/context/vehicle-access';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';
import { getVehicleDisplayName } from '@/features/vehicles/utils/get-vehicle-display-name';

export type QuickLogAction = 'service' | 'fuel' | 'odometer' | 'paper' | 'reminder' | 'vehicle';

type ActionSpec = { action: QuickLogAction; label: string; icon: LucideIcon };

/** The app's most frequent writes, most frequent first. */
export const QUICK_LOG_ACTIONS: readonly ActionSpec[] = [
  { action: 'service', label: 'Log service', icon: Wrench },
  { action: 'fuel', label: 'Log fuel', icon: Fuel },
  { action: 'odometer', label: 'Update odometer', icon: Gauge },
  { action: 'paper', label: 'Add paper', icon: FileText },
  { action: 'reminder', label: 'Add reminder', icon: CalendarPlus },
  { action: 'vehicle', label: 'Add vehicle', icon: CarFront },
];

type PickableVehicle = QuickLogVehicle & { electric: boolean };

/** What the sheet hands over once it knows the action and, where needed, the vehicle. */
type Chosen = { action: Exclude<QuickLogAction, 'vehicle' | 'reminder'>; vehicle: PickableVehicle };

const TILE_CLASS =
  'flex min-h-[72px] flex-col items-start justify-between gap-2 rounded-card border border-line bg-surface p-3 text-left text-ui font-semibold text-fg transition-colors hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-fg-3 disabled:hover:bg-surface';

/**
 * The phone bar's centre ＋: every quick write in one sheet. An action that
 * needs a vehicle asks which one first, unless there is only one it could be;
 * vehicles the user can only view are never offered. Then the matching form
 * opens: the same dialogs Home uses for a service or a fill, the odometer
 * update, the paper form, or the reminder and vehicle pages.
 */
export function QuickLogButton() {
  const navigate = useNavigate();
  const vehiclesQuery = useVehicles();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState<QuickLogAction | null>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);

  const vehicles = useMemo<PickableVehicle[]>(
    () =>
      (vehiclesQuery.data ?? [])
        .filter((vehicle) => accessFor(vehicle.currentUserRole ?? null).canEdit)
        .map((vehicle) => ({
          id: vehicle.id,
          displayName: getVehicleDisplayName(vehicle),
          registrationNumber: vehicle.registrationNumber,
          odometer: vehicle.odometer,
          fuelType: vehicle.fuelType,
          electric: vehicle.fuelType === FuelType.Electric,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [vehiclesQuery.data],
  );

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (open) setPending(null);
  }

  function go(action: QuickLogAction, vehicle?: PickableVehicle) {
    setIsOpen(false);
    if (action === 'vehicle') {
      void navigate({ to: '/vehicles/new' });
    } else if (action === 'reminder') {
      void navigate({
        to: '/vehicles/$vehicleId/reminders/new',
        params: { vehicleId: vehicle!.id },
      });
    } else {
      setChosen({ action, vehicle: vehicle! });
    }
  }

  function pick(action: QuickLogAction) {
    if (action === 'vehicle') return go(action);
    const [only] = vehicles;
    if (vehicles.length === 1 && only) return go(action, only);
    setPending(action);
  }

  const pendingSpec = QUICK_LOG_ACTIONS.find((spec) => spec.action === pending);
  const closeChosen = () => setChosen(null);

  return (
    <>
      <Sheet onOpenChange={handleOpenChange} open={isOpen}>
        <SheetTrigger asChild>
          <button
            aria-label="Log"
            className="flex size-[52px] items-center justify-center self-center justify-self-center rounded-sheet bg-brand text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="quick-log-button"
            type="button"
          >
            <Plus aria-hidden="true" className="size-6" strokeWidth={2.2} />
          </button>
        </SheetTrigger>
        <SheetContent
          className="max-h-[85dvh] overflow-y-auto rounded-t-sheet px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          side="bottom"
        >
          {pendingSpec ? (
            <>
              <SheetHeader className="pr-10 text-left">
                <button
                  className="-ml-2 flex h-11 items-center gap-1 self-start rounded-control px-2 text-ui font-medium text-fg-2 hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setPending(null)}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  Back
                </button>
                <SheetTitle>Which vehicle?</SheetTitle>
                <SheetDescription>{pendingSpec.label}, for one of your vehicles.</SheetDescription>
              </SheetHeader>
              <ul aria-label="Vehicles" className="mt-3 flex flex-col gap-2">
                {vehicles.map((vehicle) => (
                  <li key={vehicle.id}>
                    <button
                      className="flex min-h-14 w-full items-center gap-3 rounded-card border border-line bg-surface px-3 py-2 text-left transition-colors hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => go(pendingSpec.action, vehicle)}
                      type="button"
                    >
                      <NumberPlate
                        electric={vehicle.electric}
                        registration={vehicle.registrationNumber}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate text-body font-medium text-fg">
                        {vehicle.displayName}
                      </span>
                      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <SheetHeader className="pr-10 text-left">
                <SheetTitle>Log</SheetTitle>
                <SheetDescription>
                  {vehicles.length === 0 && !vehiclesQuery.isPending
                    ? 'Add a vehicle first; everything else is logged against one.'
                    : 'What would you like to record?'}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {QUICK_LOG_ACTIONS.map(({ action, label, icon: Icon }) => (
                  <button
                    className={TILE_CLASS}
                    disabled={action !== 'vehicle' && vehicles.length === 0}
                    key={action}
                    onClick={() => pick(action)}
                    type="button"
                  >
                    <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {chosen?.action === 'service' ? (
        <QuickLogDialog
          onOpenChange={(open) => !open && closeChosen()}
          open
          vehicles={[chosen.vehicle]}
        />
      ) : null}
      {chosen?.action === 'fuel' ? (
        <FuelLogDialog
          onOpenChange={(open) => !open && closeChosen()}
          open
          vehicles={[chosen.vehicle]}
        />
      ) : null}
      {chosen?.action === 'paper' ? (
        <DocumentFormDialog isOpen onClose={closeChosen} vehicleId={chosen.vehicle.id} />
      ) : null}
      {chosen?.action === 'odometer' ? (
        <Dialog onOpenChange={(open) => !open && closeChosen()} open>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Update odometer</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-3">
              <NumberPlate
                electric={chosen.vehicle.electric}
                registration={chosen.vehicle.registrationNumber}
                size="sm"
              />
              <span className="truncate text-ui font-medium text-fg">
                {chosen.vehicle.displayName}
              </span>
            </div>
            <OdometerUpdateForm
              displayName={chosen.vehicle.displayName}
              odometer={chosen.vehicle.odometer}
              onCancel={closeChosen}
              onDone={closeChosen}
              vehicleId={chosen.vehicle.id}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
