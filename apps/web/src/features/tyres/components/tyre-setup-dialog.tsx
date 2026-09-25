import { useEffect, useState } from 'react';
import {
  TyrePosition,
  type CreateTyreInspectionInput,
  type VehicleType,
} from '@vehicle-vault/shared';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

import { useCreateTyre, useCreateTyreInspections } from '../hooks/use-tyres';
import { parseDotCode } from '../schemas/tyre-form.schema';
import { positionOptionsFor } from './tyre-form-dialog';

type TyreSetupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  vehicleType: VehicleType;
  vehicleOdometer: number;
  /** The catalogue's size for the variant, filled in to start with. */
  catalogSize?: string | null;
};

const STEPS = ['Size and brand', 'Age', 'Tread'] as const;

/** The tyres a vehicle rolls on: a two-wheeler's two, a car's four. The spare is added on its own. */
function rollingPositions(vehicleType: VehicleType): TyrePosition[] {
  return positionOptionsFor(vehicleType).filter((position) => position !== TyrePosition.Spare);
}

/**
 * Adding tyres for the first time, in three short steps, each skippable:
 * size and brand (the same for every tyre), the DOT date (the same too), and
 * tread per wheel. Saving fits one tyre at each position from today's
 * reading, then records the tread as an inspection.
 */
export function TyreSetupDialog({
  open,
  onOpenChange,
  vehicleId,
  vehicleType,
  vehicleOdometer,
  catalogSize,
}: TyreSetupDialogProps) {
  const positions = rollingPositions(vehicleType);
  const [step, setStep] = useState(0);
  const [size, setSize] = useState(catalogSize ?? '');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [dotCode, setDotCode] = useState('');
  const [treads, setTreads] = useState<Partial<Record<TyrePosition, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const createTyre = useCreateTyre(vehicleId);
  const createInspections = useCreateTyreInspections(vehicleId);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSize(catalogSize ?? '');
    setBrand('');
    setModel('');
    setDotCode('');
    setTreads({});
    setError(null);
  }, [open, catalogSize]);

  const dot = dotCode.trim() ? parseDotCode(dotCode.trim()) : null;
  const dotInvalid = dotCode.trim() !== '' && dot === null;
  const treadValue = (position: TyrePosition) => {
    const text = treads[position]?.trim();
    if (!text) return undefined;
    const value = Number(text);
    return Number.isFinite(value) && value >= 0 && value <= 30 ? value : Number.NaN;
  };
  const treadInvalid = positions.some((position) => Number.isNaN(treadValue(position)));

  /** `withTread: false` is "Skip and save": the tread typed on this step is left out. */
  async function save({ withTread = true }: { withTread?: boolean } = {}) {
    setError(null);
    setIsSaving(true);
    const fittedDate = new Date().toISOString();

    try {
      // One at a time: fitting a tyre retires what was at its position, and
      // a partial set is still worth keeping if a later one fails.
      const created = [];
      for (const position of positions) {
        created.push(
          await createTyre.mutateAsync({
            position,
            brand: brand.trim() || null,
            model: model.trim() || null,
            size: size.trim() || null,
            dotWeek: dot?.week ?? null,
            dotYear: dot?.year ?? null,
            fittedDate,
            fittedOdometer: vehicleOdometer,
            removedDate: null,
            removedOdometer: null,
            expectedLifeKm: null,
            notes: null,
          }),
        );
      }

      const readings: CreateTyreInspectionInput[] = created.flatMap((tyre) => {
        const value = withTread ? treadValue(tyre.position) : undefined;
        return value === undefined
          ? []
          : [
              {
                tyreId: tyre.id,
                inspectedAt: fittedDate,
                odometer: vehicleOdometer,
                treadDepthMm: value,
              },
            ];
      });
      if (readings.length > 0) {
        await createInspections.mutateAsync(readings);
      }

      appToast.success({
        title: 'Tyres added',
        description:
          readings.length > 0
            ? `${created.length} tyres, with tread on ${readings.length}.`
            : `${created.length} tyres. Log an inspection to add their tread.`,
      });
      onOpenChange(false);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "We couldn't add your tyres. Try again."));
    } finally {
      setIsSaving(false);
    }
  }

  const last = step === STEPS.length - 1;
  const stepInvalid = (step === 1 && dotInvalid) || (step === 2 && treadInvalid);

  function skip() {
    if (step === 0) {
      setSize('');
      setBrand('');
      setModel('');
    }
    if (step === 1) setDotCode('');
    if (last) void save({ withTread: false });
    else setStep(step + 1);
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add your tyres</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}. Skip anything you don’t know.
          </DialogDescription>
        </DialogHeader>

        <ol aria-label="Steps" className="flex gap-1.5">
          {STEPS.map((name, index) => (
            <li
              aria-current={index === step ? 'step' : undefined}
              className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-line'}`}
              key={name}
            >
              <span className="sr-only">{name}</span>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="grid gap-4">
            <p className="text-small text-fg-2">
              The same for every tyre; each can be edited later.
            </p>
            <FormField htmlFor="setup-size" label="Size">
              <Input
                id="setup-size"
                onChange={(event) => setSize(event.currentTarget.value)}
                placeholder="205/55 R16"
                value={size}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="setup-brand" label="Brand">
                <Input
                  id="setup-brand"
                  onChange={(event) => setBrand(event.currentTarget.value)}
                  placeholder="MRF"
                  value={brand}
                />
              </FormField>
              <FormField htmlFor="setup-model" label="Model">
                <Input
                  id="setup-model"
                  onChange={(event) => setModel(event.currentTarget.value)}
                  placeholder="ZLX"
                  value={model}
                />
              </FormField>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <FormField
            description="Four digits on the sidewall after “DOT”: week then year, so 3624 is week 36 of 2024. Rubber ages even when the tread is fine."
            error={dotInvalid ? 'Enter the four digits, e.g. 3624' : undefined}
            htmlFor="setup-dot"
            label="DOT date"
          >
            <Input
              id="setup-dot"
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => setDotCode(event.currentTarget.value)}
              placeholder="3624"
              value={dotCode}
            />
          </FormField>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4">
            <p className="text-small text-fg-2">
              Tread depth in millimetres. A coin or a tread gauge will do; 1.6 mm is the legal
              limit.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {positions.map((position) => (
                <FormField
                  error={Number.isNaN(treadValue(position)) ? 'Between 0 and 30 mm' : undefined}
                  htmlFor={`setup-tread-${position}`}
                  key={position}
                  label={format.enumLabel('tyrePosition', position)}
                >
                  <Input
                    id={`setup-tread-${position}`}
                    inputMode="decimal"
                    onChange={(event) => {
                      // Read now: React clears currentTarget before an updater runs.
                      const { value } = event.currentTarget;
                      setTreads((current) => ({ ...current, [position]: value }));
                    }}
                    placeholder="mm"
                    value={treads[position] ?? ''}
                  />
                </FormField>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <InlineError message={error} /> : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            disabled={step === 0 || isSaving}
            onClick={() => setStep(step - 1)}
            type="button"
            variant="ghost"
          >
            Back
          </Button>
          <div className="flex gap-2">
            <Button disabled={isSaving} onClick={skip} type="button" variant="outline">
              {last ? 'Skip and save' : 'Skip'}
            </Button>
            <Button
              disabled={stepInvalid || isSaving}
              onClick={() => (last ? void save() : setStep(step + 1))}
              type="button"
            >
              {last ? (isSaving ? 'Saving…' : 'Save tyres') : 'Next'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
