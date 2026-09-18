import { VehicleRole } from '@vehicle-vault/shared';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type VehicleAccess = {
  role: VehicleRole | null;
  /** Owners and editors: anything that creates, changes or removes a record. */
  canEdit: boolean;
  /** Owners only: deleting the vehicle, transferring it, managing its members. */
  isOwner: boolean;
  isViewer: boolean;
};

/**
 * What the signed-in user may do to the vehicle on screen, provided once by the
 * vehicle page so every tab — and whatever it nests — can hide the controls a
 * role cannot use instead of offering them and failing with a 403.
 *
 * The API is the enforcement; this is only about not showing a button that will
 * refuse. So outside a vehicle page, and while a role is unknown, nothing is
 * hidden that was shown before — except owner-only controls, which stay behind a
 * confirmed owner role as they always have (the Loans tab).
 */
const UNSCOPED: VehicleAccess = { role: null, canEdit: true, isOwner: false, isViewer: false };

const VehicleAccessContext = createContext<VehicleAccess>(UNSCOPED);

export function VehicleAccessProvider({
  role,
  children,
}: {
  role: VehicleRole | null | undefined;
  children: ReactNode;
}) {
  const value = useMemo(() => accessFor(role ?? null), [role]);
  return <VehicleAccessContext.Provider value={value}>{children}</VehicleAccessContext.Provider>;
}

export function useVehicleAccess(): VehicleAccess {
  return useContext(VehicleAccessContext);
}

export function accessFor(role: VehicleRole | null): VehicleAccess {
  return {
    role,
    canEdit: role !== VehicleRole.Viewer,
    isOwner: role === VehicleRole.Owner,
    isViewer: role === VehicleRole.Viewer,
  };
}
