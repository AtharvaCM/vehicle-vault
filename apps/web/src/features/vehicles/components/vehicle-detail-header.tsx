import { Link } from '@tanstack/react-router';
import { ChevronDown, IdCard, MoreHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { FuelType, type Vehicle, type VehicleDocument } from '@vehicle-vault/shared';

import { VehicleIdentity } from '@/components/shared/vehicle-identity';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from '@/lib/format';
import { formatRelativeAgo } from '@/features/dashboard/utils/format-due';
import { FuelLogDialog } from '@/features/dashboard/components/fuel-log-dialog';
import { OdometerUpdateForm } from '@/features/dashboard/components/odometer-update-form';
import { DocumentFormDialog } from '@/features/vehicle-documents/components/document-form-dialog';

import { useVehicleAccess } from '../context/vehicle-access';
import { describeVehicleModel } from '../utils/describe-vehicle-model';

export type VehicleActions = {
  onDownloadServiceHistory: () => void;
  onDownloadResaleReport: () => void;
  onDeleteVehicle: () => void;
};

type VehicleDetailHeaderProps = {
  vehicle: Vehicle;
  /** The vehicle's papers, once loaded: with none, "Show papers" opens the Papers tab to add one. */
  documents: readonly VehicleDocument[] | undefined;
  actions: VehicleActions;
  /** The tab strip, drawn along the header's bottom edge. */
  tabs: ReactNode;
};

type LogDialog = 'fuel' | 'odometer' | 'paper' | null;

/**
 * The vehicle page's identity bar: the L plate, nickname, model and odometer,
 * then Show papers, Log ▾ and a more menu. A viewer gets Show papers and the
 * downloads only: every write action is left out, not disabled.
 */
export function VehicleDetailHeader({
  vehicle,
  documents,
  actions,
  tabs,
}: VehicleDetailHeaderProps) {
  const { canEdit, isOwner, isViewer } = useVehicleAccess();
  const [logDialog, setLogDialog] = useState<LogDialog>(null);
  const vehicleId = vehicle.id;
  const name = vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;
  // With none on file, the Papers tab is where one gets added.
  const hasNoPapers = documents?.length === 0;

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pt-5 sm:px-6 md:gap-5 md:pt-8 lg:px-8">
        {/* The way back is the topbar's breadcrumb (Garage › this vehicle). */}
        {isViewer ? (
          <Badge
            className="self-start border-line bg-page text-fg-2"
            title="You can see this vehicle but not change it. Ask the owner for editor access to make changes."
            variant="outline"
          >
            View only
          </Badge>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <VehicleIdentity
            className="min-w-0"
            details={
              <>
                {describeVehicleModel(vehicle)} · {format.odometer(vehicle.odometer)}, updated{' '}
                {formatRelativeAgo(vehicle.updatedAt)}
              </>
            }
            electric={vehicle.fuelType === FuelType.Electric}
            layout="header"
            name={name}
            registration={vehicle.registrationNumber}
          />

          <div className="flex shrink-0 items-center gap-2">
            {hasNoPapers ? (
              <Link
                className={buttonVariants({ variant: 'outline', className: 'max-lg:flex-1' })}
                params={{ vehicleId }}
                search={{ tab: 'papers' }}
                to="/vehicles/$vehicleId"
              >
                <IdCard aria-hidden="true" />
                Show papers
              </Link>
            ) : (
              <Link
                className={buttonVariants({ variant: 'outline', className: 'max-lg:flex-1' })}
                params={{ vehicleId }}
                to="/vehicles/$vehicleId/papers"
              >
                <IdCard aria-hidden="true" />
                Show papers
              </Link>
            )}

            {canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="max-lg:flex-1">
                    Log
                    <ChevronDown aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link params={{ vehicleId }} to="/vehicles/$vehicleId/maintenance/new">
                      Service
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLogDialog('fuel')}>Fuel</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLogDialog('odometer')}>
                    Odometer
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLogDialog('paper')}>Paper</DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link params={{ vehicleId }} to="/vehicles/$vehicleId/reminders/new">
                      Reminder
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label="More vehicle actions" size="icon" variant="outline">
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {canEdit ? (
                  <DropdownMenuItem asChild>
                    <Link params={{ vehicleId }} to="/vehicles/$vehicleId/edit">
                      Edit vehicle
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={actions.onDownloadServiceHistory}>
                  Download service history (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={actions.onDownloadResaleReport}>
                  Download resale report (PDF)
                </DropdownMenuItem>
                {isOwner ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-late focus:bg-late-tint focus:text-late"
                      onSelect={actions.onDeleteVehicle}
                    >
                      Delete vehicle
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {tabs}
      </div>

      {canEdit ? (
        <>
          <FuelLogDialog
            onOpenChange={(open) => setLogDialog(open ? 'fuel' : null)}
            open={logDialog === 'fuel'}
            vehicles={[
              {
                id: vehicleId,
                displayName: name,
                registrationNumber: vehicle.registrationNumber,
                odometer: vehicle.odometer,
              },
            ]}
          />
          <Dialog
            onOpenChange={(open) => setLogDialog(open ? 'odometer' : null)}
            open={logDialog === 'odometer'}
          >
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Update odometer</DialogTitle>
              </DialogHeader>
              <OdometerUpdateForm
                displayName={name}
                odometer={vehicle.odometer}
                onCancel={() => setLogDialog(null)}
                onDone={() => setLogDialog(null)}
                vehicleId={vehicleId}
              />
            </DialogContent>
          </Dialog>
          <DocumentFormDialog
            isOpen={logDialog === 'paper'}
            onClose={() => setLogDialog(null)}
            vehicleId={vehicleId}
          />
        </>
      ) : null}
    </header>
  );
}
