import {
  DEFAULT_VEHICLE_CATALOG_MARKET,
  FuelType,
  type VehicleCatalogVariantOption,
  VehicleType,
} from '@vehicle-vault/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, type Path, useForm } from 'react-hook-form';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/shared/searchable-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api/api-error';

import { supportsVehicleCatalog } from '../data/vehicle-catalog';
import { useVehicleCatalogMakes } from '../hooks/use-vehicle-catalog-makes';
import { useVehicleCatalogModels } from '../hooks/use-vehicle-catalog-models';
import { useVehicleCatalogVariants } from '../hooks/use-vehicle-catalog-variants';
import { type VehicleFormValues, vehicleFormSchema } from '../schemas/vehicle-form.schema';
import { buildVehicleUpdatePayload } from '../utils/build-vehicle-update-payload';
import { keepsCatalogSelection, type VariantYears } from '../utils/keeps-catalog-selection';

const fuelOptions = Object.values(FuelType);

/**
 * Car and SUV are one decision to an owner (most would call a Creta or a Nexon
 * "a car"), but the catalog files each model under one of them. Searching one
 * searches both, and picking a model the catalog files under the other type
 * switches the type to it: the catalog's body type decides what is stored.
 */
function siblingCatalogType(vehicleType: VehicleType) {
  if (vehicleType === VehicleType.Car) return VehicleType.SUV;
  if (vehicleType === VehicleType.SUV) return VehicleType.Car;
  return null;
}

/** The catalog pickers, in order: entering one by hand frees it and the ones after it. */
const catalogFields = ['make', 'model', 'variant'] as const;
type CatalogField = (typeof catalogFields)[number];
const vehicleTypeOptions = Object.values(VehicleType);

function formatOptionLabel(value: string) {
  if (value.length <= 3) {
    return value.toUpperCase();
  }

  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

type VehicleFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: VehicleFormValues) => Promise<void> | void;
  submitError?: string | null;
  initialValues?: Partial<VehicleFormValues>;
  onDirtyChange?: (isDirty: boolean) => void;
  submitLabel?: string;
  submittingLabel?: string;
  submitHint?: string;
  successMessage?: string;
  /**
   * `'create'` (the default) sends the full validated object, since there is
   * no prior vehicle to diff against. `'edit'` sends only what changed: a
   * saved purchase date, price or odometer the owner never touched must not
   * come back as an explicit `null` and wipe what is already stored.
   */
  mode?: 'create' | 'edit';
};

const defaultVehicleValues: VehicleFormValues = {
  registrationNumber: '',
  make: '',
  model: '',
  variant: '',
  year: new Date().getFullYear(),
  vehicleType: VehicleType.Car,
  fuelType: FuelType.Petrol,
  odometer: 0,
  nickname: '',
};

export function VehicleForm({
  isSubmitting = false,
  onSubmit,
  submitError,
  initialValues,
  onDirtyChange,
  submitLabel = 'Save Vehicle',
  submittingLabel = 'Saving vehicle...',
  submitHint = 'You can add service history and reminders as soon as this vehicle is saved.',
  successMessage = 'Vehicle details saved.',
  mode = 'create',
}: VehicleFormProps) {
  const [submissionState, setSubmissionState] = useState<string | null>(null);
  const resolvedInitialValues = useMemo(
    () => ({
      ...defaultVehicleValues,
      ...initialValues,
    }),
    [initialValues],
  );

  const form = useForm<VehicleFormValues>({
    defaultValues: resolvedInitialValues,
  });

  const selectedVehicleType = form.watch('vehicleType');
  const selectedYear = form.watch('year');
  const selectedMake = form.watch('make');
  const selectedModel = form.watch('model');
  const selectedVariant = form.watch('variant');
  const selectedFuelType = form.watch('fuelType');
  const usesCatalog = supportsVehicleCatalog(selectedVehicleType);
  const catalogYear = Number.isFinite(selectedYear) ? selectedYear : undefined;
  const siblingType = siblingCatalogType(selectedVehicleType);
  // The first catalog field the owner chose to type by hand; it and every field
  // after it are free text, whatever the type.
  const [manualFrom, setManualFrom] = useState<CatalogField | null>(null);
  const isManual = (field: CatalogField) =>
    manualFrom !== null && catalogFields.indexOf(field) >= catalogFields.indexOf(manualFrom);
  const enterManually = (field: CatalogField, typed: string) => {
    form.setValue(field, typed, { shouldDirty: true });
    for (const later of catalogFields.slice(catalogFields.indexOf(field) + 1)) {
      form.setValue(later, '', { shouldDirty: true });
    }
    setManualFrom(field);
    // Focus the now-editable input once it has rendered.
    window.setTimeout(() => form.setFocus(field), 0);
  };

  const makesQuery = useVehicleCatalogMakes(
    {
      marketCode: DEFAULT_VEHICLE_CATALOG_MARKET,
      vehicleType: selectedVehicleType,
      year: catalogYear,
    },
    usesCatalog,
  );
  const modelsQuery = useVehicleCatalogModels(
    {
      make: selectedMake,
      marketCode: DEFAULT_VEHICLE_CATALOG_MARKET,
      vehicleType: selectedVehicleType,
      year: catalogYear,
    },
    usesCatalog && Boolean(selectedMake),
  );
  const siblingMakesQuery = useVehicleCatalogMakes(
    {
      marketCode: DEFAULT_VEHICLE_CATALOG_MARKET,
      vehicleType: siblingType ?? selectedVehicleType,
      year: catalogYear,
    },
    usesCatalog && siblingType !== null,
  );
  const siblingModelsQuery = useVehicleCatalogModels(
    {
      make: selectedMake,
      marketCode: DEFAULT_VEHICLE_CATALOG_MARKET,
      vehicleType: siblingType ?? selectedVehicleType,
      year: catalogYear,
    },
    usesCatalog && siblingType !== null && Boolean(selectedMake),
  );
  const variantsQuery = useVehicleCatalogVariants(
    {
      make: selectedMake,
      marketCode: DEFAULT_VEHICLE_CATALOG_MARKET,
      model: selectedModel,
      vehicleType: selectedVehicleType,
      year: catalogYear,
    },
    usesCatalog && Boolean(selectedMake) && Boolean(selectedModel),
  );

  const catalogError = getCatalogError([makesQuery.error, modelsQuery.error, variantsQuery.error]);
  const canUseCatalogSelectors = usesCatalog && !catalogError;

  // A sibling-type list that fails only narrows the search; it never takes the
  // pickers away the way a failure of the type's own list does.
  const makeOptions = useMemo(
    () =>
      mergeSelectedOption(
        uniqueByValue([
          ...(makesQuery.data ?? []).map(toMakeOption),
          ...(siblingMakesQuery.data ?? []).map(toMakeOption),
        ]).sort((left, right) => left.label.localeCompare(right.label)),
        selectedMake,
      ),
    [makesQuery.data, selectedMake, siblingMakesQuery.data],
  );
  const siblingOnlyModels = useMemo(() => {
    const ownNames = new Set((modelsQuery.data ?? []).map((model) => model.name));

    return new Set(
      (siblingModelsQuery.data ?? [])
        .map((model) => model.name)
        .filter((name) => !ownNames.has(name)),
    );
  }, [modelsQuery.data, siblingModelsQuery.data]);
  const modelOptions = useMemo(
    () =>
      mergeSelectedOption(
        [
          ...(modelsQuery.data ?? []).map(toModelOption),
          ...(siblingModelsQuery.data ?? [])
            .filter((model) => siblingOnlyModels.has(model.name))
            .map((model) => ({
              ...toModelOption(model),
              label: `${model.name} · listed under ${formatOptionLabel(siblingType ?? '')}`,
            })),
        ],
        selectedModel,
      ),
    [modelsQuery.data, selectedModel, siblingModelsQuery.data, siblingOnlyModels, siblingType],
  );
  const variantOptions = useMemo(
    () =>
      mergeSelectedOption((variantsQuery.data ?? []).map(toVariantOption), selectedVariant ?? ''),
    [selectedVariant, variantsQuery.data],
  );
  const selectedVariantOption = useMemo(
    () => variantsQuery.data?.find((variant) => variant.name === selectedVariant),
    [selectedVariant, variantsQuery.data],
  );
  // The years the chosen variant was sold in, held on to while a new year is
  // typed: the picker's list for a half-typed year is empty, and a prefilled
  // variant should survive the owner correcting the year to their own.
  const chosenVariantYearsRef = useRef<VariantYears | null>(null);
  useEffect(() => {
    if (!selectedVariant) {
      chosenVariantYearsRef.current = null;
    } else if (selectedVariantOption) {
      chosenVariantYearsRef.current = selectedVariantOption;
    }
  }, [selectedVariant, selectedVariantOption]);
  const availableFuelOptions = useMemo(
    () =>
      selectedVariantOption?.fuelTypes.length
        ? fuelOptions.filter((fuelType) => selectedVariantOption.fuelTypes.includes(fuelType))
        : fuelOptions,
    [selectedVariantOption],
  );

  useEffect(() => {
    if (submitError) {
      setSubmissionState(null);
    }
  }, [submitError]);

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  useEffect(() => {
    if (!selectedVariantOption) {
      return;
    }

    const [primaryFuelType] = selectedVariantOption.fuelTypes;

    if (!primaryFuelType) {
      return;
    }

    if (!selectedVariantOption.fuelTypes.includes(selectedFuelType)) {
      form.setValue('fuelType', primaryFuelType, {
        shouldDirty: form.formState.isDirty,
      });
    }
  }, [form, form.formState.isDirty, selectedFuelType, selectedVariantOption]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const result = vehicleFormSchema.safeParse({
      ...values,
      nickname: values.nickname?.trim() ? values.nickname.trim() : undefined,
      // Optional: an untouched combobox or input means "I don't know it".
      variant: values.variant?.trim() ? values.variant.trim() : undefined,
      catalogVariantId: selectedVariantOption?.id,
    });

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];

        if (typeof field === 'string') {
          form.setError(field as Path<VehicleFormValues>, {
            message: issue.message,
          });
        }
      });

      setSubmissionState(null);
      return;
    }

    const payload =
      mode === 'edit'
        ? buildVehicleUpdatePayload(result.data, form.formState.dirtyFields)
        : result.data;

    try {
      // `onSubmit` is typed for the full create shape; in edit mode the
      // payload is deliberately a partial subset (see buildVehicleUpdatePayload)
      // that the API's partial-update handler accepts.
      await onSubmit(payload as VehicleFormValues);
      setSubmissionState(successMessage);
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmissionState(null);
        return;
      }

      setSubmissionState(null);
    }
  });

  return (
    <Card size="sm">
      <CardHeader className="pb-3">
        <CardTitle>Vehicle details</CardTitle>
        <CardDescription>
          Add the basics so this vehicle is easy to recognise everywhere in the app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-3.5 md:grid-cols-2">
            <FormField
              htmlFor="vehicle-registration-number"
              label="Registration number"
              error={form.formState.errors.registrationNumber?.message}
            >
              <Input
                id="vehicle-registration-number"
                {...form.register('registrationNumber')}
                aria-invalid={Boolean(form.formState.errors.registrationNumber)}
                placeholder="MH12AB1234"
              />
            </FormField>

            <FormField
              htmlFor="vehicle-type"
              label="Vehicle type"
              error={form.formState.errors.vehicleType?.message}
            >
              <Controller
                control={form.control}
                name="vehicleType"
                render={({ field }) => (
                  <Select
                    onValueChange={(nextVehicleType) => {
                      field.onChange(nextVehicleType);

                      // Typed by hand, the names do not depend on the type.
                      if (manualFrom === 'make') {
                        return;
                      }

                      // Car and SUV search the same makes, so the make stays.
                      if (siblingCatalogType(nextVehicleType as VehicleType) !== field.value) {
                        form.setValue('make', '', { shouldDirty: true });
                      }
                      form.setValue('model', '', { shouldDirty: true });
                      form.setValue('variant', '', { shouldDirty: true });
                      setManualFrom(null);
                    }}
                    value={field.value}
                  >
                    <SelectTrigger
                      id="vehicle-type"
                      aria-invalid={Boolean(form.formState.errors.vehicleType)}
                    >
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicleTypeOptions.map((vehicleType) => (
                        <SelectItem key={vehicleType} value={vehicleType}>
                          {formatOptionLabel(vehicleType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField
              htmlFor="vehicle-year"
              label="Year"
              error={form.formState.errors.year?.message}
            >
              <Input
                id="vehicle-year"
                {...form.register('year', {
                  valueAsNumber: true,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    if (
                      manualFrom !== null ||
                      keepsCatalogSelection(
                        Number(event.target.value),
                        chosenVariantYearsRef.current,
                      )
                    ) {
                      return;
                    }

                    form.setValue('make', '', { shouldDirty: true });
                    form.setValue('model', '', { shouldDirty: true });
                    form.setValue('variant', '', { shouldDirty: true });
                  },
                })}
                aria-invalid={Boolean(form.formState.errors.year)}
                min={1900}
                type="number"
              />
            </FormField>

            <FormField
              htmlFor="vehicle-make"
              label="Make"
              error={form.formState.errors.make?.message}
            >
              {canUseCatalogSelectors && !isManual('make') ? (
                <Controller
                  control={form.control}
                  name="make"
                  render={({ field }) => (
                    <SearchableSelect
                      id="vehicle-make"
                      onChange={(nextMake) => {
                        field.onChange(nextMake);
                        form.setValue('model', '', { shouldDirty: true });
                        form.setValue('variant', '', { shouldDirty: true });
                      }}
                      onManualEntry={(typed) => enterManually('make', typed)}
                      options={makeOptions}
                      placeholder={makesQuery.isLoading ? 'Loading makes...' : 'Select make'}
                      searchPlaceholder="Search makes..."
                      value={field.value}
                    />
                  )}
                />
              ) : (
                <Input
                  id="vehicle-make"
                  {...form.register('make')}
                  aria-invalid={Boolean(form.formState.errors.make)}
                  placeholder="Hyundai"
                />
              )}
            </FormField>

            <FormField
              htmlFor="vehicle-model"
              label="Model"
              error={form.formState.errors.model?.message}
            >
              {canUseCatalogSelectors && !isManual('model') ? (
                <Controller
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <SearchableSelect
                      disabled={!selectedMake}
                      emptyMessage={
                        selectedMake ? 'No models found for this make.' : 'Select a make first.'
                      }
                      id="vehicle-model"
                      onChange={(nextModel) => {
                        // A model the catalog files under the sibling type takes
                        // that type, keeping the make.
                        if (siblingType && siblingOnlyModels.has(nextModel)) {
                          form.setValue('vehicleType', siblingType, { shouldDirty: true });
                        }
                        field.onChange(nextModel);
                        form.setValue('variant', '', { shouldDirty: true });
                      }}
                      onManualEntry={(typed) => enterManually('model', typed)}
                      options={modelOptions}
                      placeholder={
                        !selectedMake
                          ? 'Select make first'
                          : modelsQuery.isLoading
                            ? 'Loading models...'
                            : 'Select model'
                      }
                      searchPlaceholder="Search models..."
                      value={field.value}
                    />
                  )}
                />
              ) : (
                <Input
                  id="vehicle-model"
                  {...form.register('model')}
                  aria-invalid={Boolean(form.formState.errors.model)}
                  placeholder="Creta"
                />
              )}
            </FormField>

            <FormField
              htmlFor="vehicle-variant"
              label="Variant (optional)"
              error={form.formState.errors.variant?.message}
            >
              {canUseCatalogSelectors && !isManual('variant') ? (
                <Controller
                  control={form.control}
                  name="variant"
                  render={({ field }) => (
                    <SearchableSelect
                      disabled={!selectedModel}
                      emptyMessage={
                        selectedModel
                          ? 'No variants found for this model.'
                          : 'Select a model first.'
                      }
                      id="vehicle-variant"
                      onChange={field.onChange}
                      onManualEntry={(typed) => enterManually('variant', typed)}
                      options={variantOptions}
                      placeholder={
                        !selectedModel
                          ? 'Select model first'
                          : variantsQuery.isLoading
                            ? 'Loading variants...'
                            : 'Select variant, or skip'
                      }
                      searchPlaceholder="Search variants..."
                      value={field.value ?? ''}
                    />
                  )}
                />
              ) : (
                <Input
                  id="vehicle-variant"
                  {...form.register('variant')}
                  aria-invalid={Boolean(form.formState.errors.variant)}
                  placeholder="SX (O)"
                />
              )}
            </FormField>

            <FormField
              htmlFor="fuel-type"
              label="Fuel type"
              error={form.formState.errors.fuelType?.message}
            >
              <Controller
                control={form.control}
                name="fuelType"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      id="fuel-type"
                      aria-invalid={Boolean(form.formState.errors.fuelType)}
                    >
                      <SelectValue placeholder="Select fuel type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFuelOptions.map((fuelType) => (
                        <SelectItem key={fuelType} value={fuelType}>
                          {formatOptionLabel(fuelType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField
              htmlFor="vehicle-odometer"
              label="Odometer"
              error={form.formState.errors.odometer?.message}
            >
              <Input
                id="vehicle-odometer"
                {...form.register('odometer', { valueAsNumber: true })}
                aria-invalid={Boolean(form.formState.errors.odometer)}
                min={0}
                type="number"
              />
            </FormField>

            <FormField
              htmlFor="vehicle-nickname"
              label="Nickname"
              error={form.formState.errors.nickname?.message}
            >
              <Input
                id="vehicle-nickname"
                {...form.register('nickname')}
                aria-invalid={Boolean(form.formState.errors.nickname)}
                placeholder="Family SUV"
              />
            </FormField>

            <FormField
              htmlFor="vehicle-purchase-date"
              label="Purchase date (optional)"
              error={form.formState.errors.purchaseDate?.message}
            >
              <Input
                id="vehicle-purchase-date"
                type="date"
                {...form.register('purchaseDate', {
                  setValueAs: (v) => (v ? new Date(v).toISOString() : null),
                })}
                aria-invalid={Boolean(form.formState.errors.purchaseDate)}
              />
            </FormField>

            <FormField
              htmlFor="vehicle-purchase-price"
              label="Purchase price (₹, optional)"
              error={form.formState.errors.purchasePrice?.message}
            >
              <Input
                id="vehicle-purchase-price"
                type="number"
                min={0}
                step="1"
                {...form.register('purchasePrice', {
                  setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                })}
                aria-invalid={Boolean(form.formState.errors.purchasePrice)}
                placeholder="e.g. 850000"
              />
            </FormField>

            <FormField
              htmlFor="vehicle-purchase-odometer"
              label="Odometer at purchase (optional)"
              error={form.formState.errors.purchaseOdometer?.message}
            >
              <Input
                id="vehicle-purchase-odometer"
                type="number"
                min={0}
                step="1"
                {...form.register('purchaseOdometer', {
                  setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                })}
                aria-invalid={Boolean(form.formState.errors.purchaseOdometer)}
                placeholder="0 for brand new"
              />
            </FormField>
          </div>

          {canUseCatalogSelectors && manualFrom ? (
            <p className="text-sm leading-5 text-slate-500">
              You are entering the{' '}
              {formatFieldList(catalogFields.slice(catalogFields.indexOf(manualFrom)))} by hand.{' '}
              <button
                className="font-medium text-slate-700 underline underline-offset-2"
                onClick={() => {
                  for (const field of catalogFields.slice(catalogFields.indexOf(manualFrom))) {
                    form.setValue(field, '', { shouldDirty: true });
                  }
                  setManualFrom(null);
                }}
                type="button"
              >
                Choose from the catalog instead
              </button>
            </p>
          ) : canUseCatalogSelectors ? (
            <p className="text-sm leading-5 text-slate-500">
              Start with vehicle type and year, then search the India catalog for the correct make,
              model, and variant.
            </p>
          ) : catalogError ? (
            <div className="space-y-2">
              <InlineError message={catalogError} />
              <p className="text-sm leading-5 text-slate-500">
                The catalog is temporarily unavailable, so you can enter make, model, and variant
                manually.
              </p>
            </div>
          ) : (
            <p className="text-sm leading-5 text-slate-500">
              Catalog search is available for cars, SUVs, and motorcycles. Other vehicle types can
              be entered manually for now.
            </p>
          )}

          {submitError ? <InlineError message={submitError} /> : null}

          {submissionState ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm leading-5 text-emerald-700">
              {submissionState}
            </p>
          ) : null}

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button disabled={form.formState.isSubmitting || isSubmitting} size="sm" type="submit">
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
            <p className="text-sm leading-5 text-slate-500 sm:max-w-md">
              {isSubmitting ? 'Saving vehicle details...' : submitHint}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function toMakeOption(option: { keywords?: string[]; name: string }): SearchableSelectOption {
  return {
    value: option.name,
    label: option.name,
    keywords: uniqueSearchKeywords(option.name, option.keywords),
  };
}

function toModelOption(option: { keywords?: string[]; name: string }): SearchableSelectOption {
  return {
    value: option.name,
    label: option.name,
    keywords: uniqueSearchKeywords(option.name, option.keywords),
  };
}

function toVariantOption(option: VehicleCatalogVariantOption): SearchableSelectOption {
  const yearLabel = formatVariantYearRange(option.yearStart, option.yearEnd, option.isCurrent);

  return {
    value: option.name,
    label: option.name,
    keywords: uniqueSearchKeywords(option.name, [
      ...(option.keywords ?? []),
      ...option.fuelTypes.map((fuelType) => fuelType.toLowerCase()),
      ...(yearLabel ? [yearLabel] : []),
    ]),
  };
}

function formatFieldList(fields: readonly string[]) {
  return fields.length > 1
    ? `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`
    : (fields[0] ?? '');
}

function uniqueByValue(options: SearchableSelectOption[]) {
  const seen = new Set<string>();

  return options.filter((option) => {
    if (seen.has(option.value)) {
      return false;
    }

    seen.add(option.value);
    return true;
  });
}

function mergeSelectedOption(options: SearchableSelectOption[], selectedValue: string) {
  if (!selectedValue || options.some((option) => option.value === selectedValue)) {
    return options;
  }

  return [
    {
      value: selectedValue,
      label: selectedValue,
      keywords: [selectedValue.toLowerCase()],
    },
    ...options,
  ];
}

function formatVariantYearRange(yearStart?: number, yearEnd?: number, isCurrent?: boolean) {
  if (yearStart && yearEnd) {
    return `${yearStart}-${yearEnd}`;
  }

  if (yearStart && isCurrent) {
    return `${yearStart}+`;
  }

  if (yearStart) {
    return String(yearStart);
  }

  return '';
}

function getCatalogError(errors: Array<unknown>) {
  const apiError = errors.find((error): error is ApiError => error instanceof ApiError);

  return apiError?.message ?? null;
}

function uniqueSearchKeywords(label: string, keywords?: string[]) {
  return [
    ...new Set([label.toLowerCase(), ...(keywords ?? []).map((keyword) => keyword.toLowerCase())]),
  ];
}
