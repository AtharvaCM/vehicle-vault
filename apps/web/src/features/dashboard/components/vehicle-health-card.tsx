import { Link } from '@tanstack/react-router';
import { BellRing, IdCard, MoreHorizontal, Wrench } from 'lucide-react';
import { FuelType } from '@vehicle-vault/shared';

import { StatusPill } from '@/components/shared/status-pill';
import { VehicleIdentity } from '@/components/shared/vehicle-identity';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import type { DashboardVehicleHealth } from '../types/dashboard';
import type { VehicleDetailSearch } from '@/features/vehicles/types/vehicle-detail-search';
import { format } from '@/lib/format';
import { ATTENTION_KIND_SEARCH } from '../utils/attention-kind-tab';
import { vehicleHealthStatus } from '../utils/status';
import { DataRow, LastServiceRow, NextDueRow, OdometerRow, PapersRow } from './vehicle-health-rows';

type VehicleHealthCardProps = {
  vehicle: DashboardVehicleHealth;
  /** Injectable for deterministic document day math in tests. */
  today?: Date;
};

export function VehicleHealthCard({ vehicle, today }: VehicleHealthCardProps) {
  const canEdit = vehicle.currentUserRole !== 'viewer';
  const statusSearch: VehicleDetailSearch | undefined =
    vehicle.status === 'ok' || !vehicle.nextDue
      ? undefined
      : vehicle.nextDue.kind === 'reminder'
        ? { tab: 'reminders' }
        : ATTENTION_KIND_SEARCH[vehicle.nextDue.kind];
  const health = vehicleHealthStatus(vehicle);

  return (
    <Card
      className={cn(
        '@container flex flex-col gap-3 border-line/60 bg-surface/70 transition-colors hover:bg-surface',
        vehicle.status === 'overdue' && 'border-late/60',
        vehicle.status === 'due_soon' && 'border-soon/60',
      )}
      data-testid="vehicle-health-card"
      size="sm"
    >
      <div className="flex items-start gap-3">
        <Link
          className="group min-w-0 flex-1 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          params={{ vehicleId: vehicle.id }}
          to="/vehicles/$vehicleId"
        >
          <VehicleIdentity
            electric={vehicle.fuelType === FuelType.Electric}
            layout="card"
            name={vehicle.displayName}
            registration={vehicle.registrationNumber}
          />
        </Link>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Link
            className="rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            params={{ vehicleId: vehicle.id }}
            search={statusSearch ?? {}}
            to="/vehicles/$vehicleId"
          >
            <StatusPill status={health.status}>{health.words}</StatusPill>
          </Link>
          {vehicle.currentUserRole !== 'owner' ? (
            <Badge variant="accent">Shared · {vehicle.currentUserRole}</Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2.5">
        <NextDueRow vehicle={vehicle} />
        <PapersRow today={today} vehicle={vehicle} />
        <LastServiceRow vehicle={vehicle} />
        <DataRow canEdit={canEdit} vehicle={vehicle} />
        <OdometerRow canEdit={canEdit} today={today} vehicle={vehicle} />
      </div>

      {/* Where the grid adds a column (sm, then xl beside the sidebar), a card is narrower
          than on a phone, so the footer goes by the card's own width: under 22rem the
          reading gets a row to itself and the labelled actions take the row below. Icons
          alone (on a phone) or the menu alone (for a viewer) fit beside the reading. Both
          rows can still wrap, so a long reading or a wide font never pushes a button out
          of the card. */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-3">
        <span
          className={cn(
            'shrink-0 whitespace-nowrap text-caption tabular-nums text-fg-3',
            canEdit && 'sm:basis-full sm:@[22rem]:basis-auto',
          )}
        >
          {format.odometer(vehicle.odometer)}
        </span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {/* For every role: a viewer may be the one stopped at a checkpoint. */}
          <Link
            aria-label={`Show papers for ${vehicle.displayName}`}
            className={buttonVariants({ size: 'xs', variant: 'outline' })}
            params={{ vehicleId: vehicle.id }}
            to="/vehicles/$vehicleId/papers"
          >
            <IdCard aria-hidden="true" />
            Show papers
          </Link>
          {canEdit ? (
            <>
              <Link
                aria-label={`Log service for ${vehicle.displayName}`}
                className={buttonVariants({ size: 'xs', variant: 'outline' })}
                params={{ vehicleId: vehicle.id }}
                to="/vehicles/$vehicleId/maintenance/new"
              >
                <Wrench aria-hidden="true" />
                <span className="hidden sm:inline">Log service</span>
              </Link>
              <Link
                aria-label={`Add reminder for ${vehicle.displayName}`}
                className={buttonVariants({ size: 'xs', variant: 'outline' })}
                params={{ vehicleId: vehicle.id }}
                to="/vehicles/$vehicleId/reminders/new"
              >
                <BellRing aria-hidden="true" />
                <span className="hidden sm:inline">Reminder</span>
              </Link>
            </>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`More actions for ${vehicle.displayName}`}
                className="md:h-7 md:w-7"
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link
                  className="cursor-pointer"
                  params={{ vehicleId: vehicle.id }}
                  search={{ tab: 'history', view: 'fuel' }}
                  to="/vehicles/$vehicleId"
                >
                  Add fuel
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  className="cursor-pointer"
                  params={{ vehicleId: vehicle.id }}
                  search={{ tab: 'papers' }}
                  to="/vehicles/$vehicleId"
                >
                  Documents
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  className="cursor-pointer"
                  params={{ vehicleId: vehicle.id }}
                  search={{ tab: 'reminders' }}
                  to="/vehicles/$vehicleId"
                >
                  All reminders
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
