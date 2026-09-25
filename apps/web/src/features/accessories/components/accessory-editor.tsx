import { useVehicleAccessories } from '../hooks/use-accessories';
import { AccessoryFormDialog } from './accessory-form-dialog';

type AccessoryEditorProps = {
  /** The accessory to edit, with its vehicle. Mounted only while one is open. */
  target: { vehicleId: string; accessoryId: string };
  onClose: () => void;
};

/**
 * Opens an accessory from its History row: History carries only what the row
 * shows, so the whole accessory comes from its vehicle's list. Editors only;
 * the row is not a control for anyone else.
 */
export function AccessoryEditor({ target, onClose }: AccessoryEditorProps) {
  const accessoriesQuery = useVehicleAccessories(target.vehicleId);
  const accessory =
    accessoriesQuery.data?.find((candidate) => candidate.id === target.accessoryId) ?? null;

  return (
    <AccessoryFormDialog
      canDelete
      editingAccessory={accessory}
      isOpen={Boolean(accessory)}
      onClose={onClose}
      vehicleId={target.vehicleId}
    />
  );
}
