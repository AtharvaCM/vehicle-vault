import { Link, type LinkProps } from '@tanstack/react-router';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/cn';

import type { DashboardVehicleHealth } from '../types/dashboard';

export type VehiclePickerVehicle = Pick<
  DashboardVehicleHealth,
  'id' | 'displayName' | 'registrationNumber'
>;

type VehiclePickerMenuProps = {
  label: string;
  icon: LucideIcon;
  vehicles: VehiclePickerVehicle[];
  /** Builds the typed link for a chosen vehicle, e.g. `/vehicles/$vehicleId/reminders/new`. */
  buildLink: (vehicleId: string) => LinkProps;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
};

/**
 * Vehicle-scoped action launcher. Forms such as "Log service" need a vehicle
 * id, so with one vehicle this is a plain link and with several it opens a
 * menu listing them. Never nests a Button inside a Link.
 */
export function VehiclePickerMenu({
  label,
  icon: Icon,
  vehicles,
  buildLink,
  variant = 'outline',
  size = 'default',
  className,
}: VehiclePickerMenuProps) {
  const sortedVehicles = useMemo(
    () => [...vehicles].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [vehicles],
  );

  const [onlyVehicle] = sortedVehicles;

  if (!onlyVehicle) {
    return null;
  }

  if (sortedVehicles.length === 1) {
    return (
      <Link
        {...buildLink(onlyVehicle.id)}
        className={cn(buttonVariants({ variant, size }), className)}
      >
        <Icon aria-hidden="true" />
        {label}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-haspopup="menu" className={className} size={size} type="button" variant={variant}>
          <Icon aria-hidden="true" />
          {label}
          <ChevronDown aria-hidden="true" className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        {sortedVehicles.map((vehicle) => (
          <DropdownMenuItem asChild key={vehicle.id}>
            <Link {...buildLink(vehicle.id)} className="flex cursor-pointer flex-col items-start gap-0.5">
              <span className="text-sm font-medium text-slate-900">{vehicle.displayName}</span>
              <span className="text-[11px] tabular-nums text-slate-500">
                {vehicle.registrationNumber}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
