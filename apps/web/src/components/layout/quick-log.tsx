import { useNavigate } from '@tanstack/react-router';
import {
  CalendarPlus,
  CarFront,
  ChevronLeft,
  ChevronRight,
  FileText,
  Fuel,
  Gauge,
  Package,
  Plus,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FuelType } from '@vehicle-vault/shared';

import { NumberPlate } from '@/components/shared/number-plate';
import {
  VehicleTypeGlyph,
  vehicleGlyphKind,
  type VehicleGlyphKind,
} from '@/components/shared/vehicle-type-glyph';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { AccessoryFormDialog } from '@/features/accessories/components/accessory-form-dialog';
import { DocumentFormDialog } from '@/features/vehicle-documents/components/document-form-dialog';
import { accessFor } from '@/features/vehicles/context/vehicle-access';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';
import { getVehicleDisplayName } from '@/features/vehicles/utils/get-vehicle-display-name';

export type QuickLogAction =
  | 'service'
  | 'fuel'
  | 'odometer'
  | 'paper'
  | 'reminder'
  | 'accessory'
  | 'vehicle';

type ActionSpec = { action: QuickLogAction; label: string; icon: LucideIcon };

/** The app's most frequent writes, most frequent first. */
export const QUICK_LOG_ACTIONS: readonly ActionSpec[] = [
  { action: 'service', label: 'Log service', icon: Wrench },
  { action: 'fuel', label: 'Log fuel', icon: Fuel },
  { action: 'odometer', label: 'Update odometer', icon: Gauge },
  { action: 'paper', label: 'Add paper', icon: FileText },
  { action: 'reminder', label: 'Add reminder', icon: CalendarPlus },
  { action: 'accessory', label: 'Add accessory', icon: Package },
  { action: 'vehicle', label: 'Add vehicle', icon: CarFront },
];

type PickableVehicle = QuickLogVehicle & { electric: boolean; glyph: VehicleGlyphKind };

/** What the sheet hands over once it knows the action and, where needed, the vehicle. */
type Chosen = { action: Exclude<QuickLogAction, 'vehicle' | 'reminder'>; vehicle: PickableVehicle };

const TILE_CLASS =
  'flex min-h-[72px] flex-col items-start justify-between gap-2 rounded-card border border-line bg-surface p-3 text-left text-ui font-semibold text-fg transition-colors hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-fg-3 disabled:hover:bg-surface';

/**
 * What the quick-log flow knows: which vehicles can be logged against, which
 * action is waiting for a vehicle, and which form is open. An action that needs
 * a vehicle asks which one first, unless there is only one it could be;
 * vehicles the user can only view are never offered.
 */
function useQuickLog() {
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
          glyph: vehicleGlyphKind(vehicle.vehicleType, vehicle.catalogBodyType),
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [vehiclesQuery.data],
  );

  function onOpenChange(open: boolean) {
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

  return {
    isOpen,
    onOpenChange,
    pending,
    setPending,
    chosen,
    closeChosen: () => setChosen(null),
    vehicles,
    isLoading: vehiclesQuery.isPending,
    go,
    pick,
  };
}

type QuickLogState = ReturnType<typeof useQuickLog>;

type PanelProps = {
  state: QuickLogState;
  actions: readonly ActionSpec[];
  /** The container's own title and description parts (a sheet's or a dialog's). */
  Header: typeof SheetHeader;
  Title: typeof SheetTitle;
  Description: typeof SheetDescription;
};

/** The action grid, or the vehicle list once an action needs a vehicle. */
function QuickLogPanel({ state, actions, Header, Title, Description }: PanelProps) {
  const { pending, setPending, vehicles, isLoading, go, pick } = state;
  const pendingSpec = QUICK_LOG_ACTIONS.find((spec) => spec.action === pending);

  if (pendingSpec) {
    return (
      <>
        <Header className="pr-10 text-left">
          <button
            className="-ml-2 flex h-11 items-center gap-1 self-start rounded-control px-2 text-ui font-medium text-fg-2 hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setPending(null)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Back
          </button>
          <Title>Which vehicle?</Title>
          <Description>{pendingSpec.label}, for one of your vehicles.</Description>
        </Header>
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
                <VehicleTypeGlyph className="text-fg-3" decorative kind={vehicle.glyph} />
                <span className="min-w-0 flex-1 truncate text-body font-medium text-fg">
                  {vehicle.displayName}
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      <Header className="pr-10 text-left">
        <Title>Log</Title>
        <Description>
          {vehicles.length === 0 && !isLoading
            ? 'Add a vehicle first; everything else is logged against one.'
            : 'What would you like to record?'}
        </Description>
      </Header>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {actions.map(({ action, label, icon: Icon }) => (
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
  );
}

/** The form an action opens: the same dialogs Home and the vehicle page use. */
function QuickLogForms({ chosen, closeChosen }: Pick<QuickLogState, 'chosen' | 'closeChosen'>) {
  return (
    <>
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
      {chosen?.action === 'accessory' ? (
        <AccessoryFormDialog isOpen onClose={closeChosen} vehicleId={chosen.vehicle.id} />
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

/**
 * The phone bar's centre ＋: every quick write in one sheet, then the matching
 * form: the same dialogs Home uses for a service or a fill, the odometer
 * update, the paper form, or the reminder and vehicle pages.
 */
export function QuickLogButton() {
  const state = useQuickLog();

  return (
    <>
      <Sheet onOpenChange={state.onOpenChange} open={state.isOpen}>
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
          <QuickLogPanel
            Description={SheetDescription}
            Header={SheetHeader}
            Title={SheetTitle}
            actions={QUICK_LOG_ACTIONS}
            state={state}
          />
        </SheetContent>
      </Sheet>
      <QuickLogForms chosen={state.chosen} closeChosen={state.closeChosen} />
    </>
  );
}

/** Home's actions, without Add vehicle (the garage and the top bar carry that). */
const HOME_ACTIONS = QUICK_LOG_ACTIONS.filter((spec) => spec.action !== 'vehicle');

/**
 * Home's one "＋ Log" from `md` up, where the phone bar's ＋ is not shown: the
 * same five writes and the same vehicle question, in a dialog.
 */
export function QuickLogMenuButton({ className }: { className?: string }) {
  const state = useQuickLog();

  return (
    <>
      <Button
        className={className}
        data-testid="home-log-button"
        onClick={() => state.onOpenChange(true)}
        type="button"
      >
        <Plus aria-hidden="true" />
        Log
      </Button>
      <Dialog onOpenChange={state.onOpenChange} open={state.isOpen}>
        <DialogContent className="sm:max-w-md">
          <QuickLogPanel
            Description={DialogDescription}
            Header={DialogHeader}
            Title={DialogTitle}
            actions={HOME_ACTIONS}
            state={state}
          />
        </DialogContent>
      </Dialog>
      <QuickLogForms chosen={state.chosen} closeChosen={state.closeChosen} />
    </>
  );
}
