import {
  DEFAULT_VEHICLE_CATALOG_MARKET,
  FuelType,
  type VehicleCatalogVariantOption,
  VehicleType,
} from '@vehicle-vault/shared';
import { useEffect, useMemo, useState } from 'react';
import { Controller, type Path, useForm } from 'react-hook-form';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { SearchableSelect, type SearchableSelectOption } from '@/components/shared/searchable-select';
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

const fuelOptions = Object.values(FuelType);
const vehicleTypeOptions = Object.values(VehicleType);

function formatOptionLabel(value: string) {
  if (value.length <= 3) {
    return value.toUpperCase();
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
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

  const catalogError = getCatalogError([
    makesQuery.error,
    modelsQuery.error,
    variantsQuery.error,
  ]);
  const canUseCatalogSelectors = usesCatalog && !catalogError;

  const makeOptions = useMemo(
    () => mergeSelectedOption((makesQuery.data ?? []).map(toMakeOption), selectedMake),
    [makesQuery.data, selectedMake],
  );
  const modelOptions = useMemo(
    () => mergeSelectedOption((modelsQuery.data ?? []).map(toModelOption), selectedModel),
    [modelsQuery.data, selectedModel],
  );
  const variantOptions = useMemo(
    () => mergeSelectedOption((variantsQuery.data ?? []).map(toVariantOption), selectedVariant),
    [selectedVariant, variantsQuery.data],
  );
  const selectedVariantOption = useMemo(
    () => variantsQuery.data?.find((variant) => variant.name === selectedVariant),
    [selectedVariant, variantsQuery.data],
  );
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

    try {
      await onSubmit(result.data);
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
                      form.setValue('make', '', { shouldDirty: true });
                      form.setValue('model', '', { shouldDirty: true });
                      form.setValue('variant', '', { shouldDirty: true });
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

            <FormField htmlFor="vehicle-year" label="Year" error={form.formState.errors.year?.message}>
              <Input
                id="vehicle-year"
                {...form.register('year', {
                  valueAsNumber: true,
                  onChange: () => {
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

            <FormField htmlFor="vehicle-make" label="Make" error={form.formState.errors.make?.message}>
              {canUseCatalogSelectors ? (
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

            <FormField htmlFor="vehicle-model" label="Model" error={form.formState.errors.model?.message}>
              {canUseCatalogSelectors ? (
                <Controller
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <SearchableSelect
                      disabled={!selectedMake}
                      emptyMessage={selectedMake ? 'No models found for this make.' : 'Select a make first.'}
                      id="vehicle-model"
                      onChange={(nextModel) => {
                        field.onChange(nextModel);
                        form.setValue('variant', '', { shouldDirty: true });
                      }}
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

            <FormField htmlFor="vehicle-variant" label="Variant" error={form.formState.errors.variant?.message}>
              {canUseCatalogSelectors ? (
                <Controller
                  control={form.control}
                  name="variant"
                  render={({ field }) => (
                    <SearchableSelect
                      disabled={!selectedModel}
                      emptyMessage={
                        selectedModel ? 'No variants found for this model.' : 'Select a model first.'
                      }
                      id="vehicle-variant"
                      onChange={field.onChange}
                      options={variantOptions}
                      placeholder={
                        !selectedModel
                          ? 'Select model first'
                          : variantsQuery.isLoading
                            ? 'Loading variants...'
                            : 'Select variant'
                      }
                      searchPlaceholder="Search variants..."
                      value={field.value}
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

            <FormField htmlFor="fuel-type" label="Fuel type" error={form.formState.errors.fuelType?.message}>
              <Controller
                control={form.control}
                name="fuelType"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="fuel-type" aria-invalid={Boolean(form.formState.errors.fuelType)}>
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

            <FormField htmlFor="vehicle-odometer" label="Odometer" error={form.formState.errors.odometer?.message}>
              <Input
                id="vehicle-odometer"
                {...form.register('odometer', { valueAsNumber: true })}
                aria-invalid={Boolean(form.formState.errors.odometer)}
                min={0}
                type="number"
              />
            </FormField>

            <FormField htmlFor="vehicle-nickname" label="Nickname" error={form.formState.errors.nickname?.message}>
              <Input
                id="vehicle-nickname"
                {...form.register('nickname')}
                aria-invalid={Boolean(form.formState.errors.nickname)}
                placeholder="Family SUV"
              />
            </FormField>
          </div>

          {canUseCatalogSelectors ? (
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
  return [...new Set([label.toLowerCase(), ...(keywords ?? []).map((keyword) => keyword.toLowerCase())])];
}
