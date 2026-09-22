import { requiresPuc, type FuelType } from '@vehicle-vault/shared';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import {
  useCreateVehicleDocument,
  useVehicleDocuments,
} from '@/features/vehicle-documents/hooks/use-documents';

import { useVehicleAccess } from '../context/vehicle-access';
import { useDismissVehicleSetupPrompt } from '../hooks/use-dismiss-setup-prompt';

type VehicleSetupPromptProps = {
  vehicleId: string;
  /** An electric vehicle is exempt from PUC, so it is asked for its insurance alone. */
  fuelType: FuelType;
  /**
   * Null until the prompt has been answered or skipped for this vehicle.
   * Undefined from an API that predates the prompt, which cannot save it.
   */
  dismissedAt: string | null | undefined;
};

/**
 * The two dates an owner knows without fetching paperwork, insurance and PUC
 * expiry, asked once, on the vehicle they have just added; an electric vehicle
 * is exempt from PUC and is asked for the first alone. Filling either starts
 * the expiry alerts the same minute instead of after a later visit to the
 * Protection tab; the insurer and the policy number are filled in later, by a
 * scan or an edit.
 */
export function VehicleSetupPrompt({ dismissedAt, fuelType, vehicleId }: VehicleSetupPromptProps) {
  const { canEdit } = useVehicleAccess();
  const documentsQuery = useVehicleDocuments(vehicleId);
  const createDocument = useCreateVehicleDocument(vehicleId);
  const dismissPrompt = useDismissVehicleSetupPrompt(vehicleId);

  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [pucExpiry, setPucExpiry] = useState('');

  const documents = documentsQuery.data ?? [];
  const hasInsurance = documents.some((document) => document.kind === 'insurance');
  const asksPuc = requiresPuc(fuelType) && !documents.some((document) => document.kind === 'puc');

  // Only an explicit null shows it: an API that predates the prompt omits the
  // field and would refuse both the expiry-only documents and the dismissal,
  // which is the web's state between its own deploy and the API's.
  // A viewer cannot create documents, so the prompt would only 403 on save.
  // Waiting for the documents query keeps it from flashing on a vehicle that
  // already has what it asks for, which is what a second browser tab would show.
  if (!canEdit || dismissedAt !== null || !documentsQuery.isSuccess || (hasInsurance && !asksPuc)) {
    return null;
  }

  const isSaving = createDocument.isPending || dismissPrompt.isPending;
  const hasADate = Boolean(insuranceExpiry || pucExpiry);

  async function dismiss() {
    try {
      await dismissPrompt.mutateAsync();
    } catch (error) {
      appToast.error({
        title: 'Could not close the prompt',
        description: getApiErrorMessage(error),
      });
    }
  }

  async function save() {
    try {
      if (insuranceExpiry && !hasInsurance) {
        await createDocument.mutateAsync({ kind: 'insurance', endDate: new Date(insuranceExpiry) });
      }
      if (pucExpiry && asksPuc) {
        await createDocument.mutateAsync({ kind: 'puc', endDate: new Date(pucExpiry) });
      }
    } catch (error) {
      // The prompt stays open with the dates still in it, so a failed save can
      // be retried rather than lost.
      appToast.error({ title: 'Could not save the dates', description: getApiErrorMessage(error) });
      return;
    }

    appToast.success({
      title: 'Expiry dates saved',
      description: 'You will be reminded before they run out.',
    });
    await dismiss();
  }

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-premium-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-lg font-black">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Never miss a renewal
        </CardTitle>
        <CardDescription>
          {!hasInsurance && asksPuc
            ? 'Add the two expiry dates now and we will remind you before they run out.'
            : 'Add the expiry date now and we will remind you before it runs out.'}{' '}
          {hasInsurance
            ? 'You can fill in the testing centre and certificate number later.'
            : 'You can fill in the insurer and policy number later.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {!hasInsurance && (
            <FormField htmlFor="setup-insurance-expiry" label="Insurance expires on">
              <Input
                id="setup-insurance-expiry"
                onChange={(event) => setInsuranceExpiry(event.target.value)}
                type="date"
                value={insuranceExpiry}
              />
            </FormField>
          )}
          {asksPuc && (
            <FormField htmlFor="setup-puc-expiry" label="PUC expires on">
              <Input
                id="setup-puc-expiry"
                onChange={(event) => setPucExpiry(event.target.value)}
                type="date"
                value={pucExpiry}
              />
            </FormField>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!hasADate || isSaving} onClick={() => void save()}>
            {createDocument.isPending ? 'Saving...' : 'Save dates'}
          </Button>
          <Button disabled={isSaving} onClick={() => void dismiss()} variant="ghost">
            Not now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
