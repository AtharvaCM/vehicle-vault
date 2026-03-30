import {
  MaintenanceCategory,
  MaintenanceLineItemKind,
  type MaintenanceLineItem,
} from '@vehicle-vault/shared';
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';

import { FormField } from '@/components/shared/form-field';
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
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils/format-currency';

import type { MaintenanceFormValues } from '../schemas/maintenance-form.schema';
import { resolveMaintenanceLineItemTotal } from '../utils/get-maintenance-line-item-breakdown';
import { formatMaintenanceCategory } from '../utils/format-maintenance-category';

const kindOptions = Object.values(MaintenanceLineItemKind);
const categoryOptions = Object.values(MaintenanceCategory);

type MaintenanceLineItemsEditorProps = {
  control: Control<MaintenanceFormValues>;
  currencyCode: string;
  errors: FieldErrors<MaintenanceFormValues>;
  register: UseFormRegister<MaintenanceFormValues>;
  setValue: UseFormSetValue<MaintenanceFormValues>;
};

const emptyLineItem: MaintenanceFormValues['lineItems'][number] = {
  kind: MaintenanceLineItemKind.Job,
  name: '',
  normalizedCategory: undefined,
  quantity: undefined,
  unit: '',
  unitPrice: undefined,
  lineTotal: undefined,
  brand: '',
  partNumber: '',
  notes: '',
};

export function MaintenanceLineItemsEditor({
  control,
  currencyCode,
  errors,
  register,
  setValue,
}: MaintenanceLineItemsEditorProps) {
  const { append, fields, remove } = useFieldArray({
    control,
    name: 'lineItems',
  });
  const lineItems = useWatch({
    control,
    name: 'lineItems',
  });

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Detailed items</CardTitle>
            <CardDescription>
              Break the visit into jobs, fluids, parts, taxes, and discounts.
            </CardDescription>
          </div>
          <Button onClick={() => append(emptyLineItem)} size="sm" type="button" variant="secondary">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.length ? (
          fields.map((field, index) => {
            const lineItem = lineItems?.[index];
            const resolvedTotal = resolveMaintenanceLineItemTotal(lineItem ?? {});

            return (
              <div
                key={field.id}
                className="rounded-2xl border border-border/70 bg-slate-50/60 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Item {index + 1}</p>
                    <p className="text-xs text-slate-500">
                      {resolvedTotal > 0
                        ? `Resolved total ${formatCurrency(resolvedTotal, currencyCode)}`
                        : 'Set a line total directly or derive it from quantity × unit price.'}
                    </p>
                  </div>
                  <Button
                    aria-label={`Remove maintenance line item ${index + 1}`}
                    onClick={() => remove(index)}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FormField
                    error={errors.lineItems?.[index]?.kind?.message}
                    htmlFor={`maintenance-line-item-kind-${index}`}
                    label="Kind"
                  >
                    <Controller
                      control={control}
                      name={`lineItems.${index}.kind`}
                      render={({ field: controlledField }) => (
                        <Select
                          onValueChange={controlledField.onChange}
                          value={controlledField.value}
                        >
                          <SelectTrigger id={`maintenance-line-item-kind-${index}`}>
                            <SelectValue placeholder="Select item kind" />
                          </SelectTrigger>
                          <SelectContent>
                            {kindOptions.map((kind) => (
                              <SelectItem key={kind} value={kind}>
                                {formatLineItemKind(kind)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormField>

                  <FormField
                    error={errors.lineItems?.[index]?.normalizedCategory?.message}
                    htmlFor={`maintenance-line-item-category-${index}`}
                    label="Mapped category"
                  >
                    <Controller
                      control={control}
                      name={`lineItems.${index}.normalizedCategory`}
                      render={({ field: controlledField }) => (
                        <Select
                          onValueChange={(value) =>
                            controlledField.onChange(value === '__none' ? undefined : value)
                          }
                          value={controlledField.value ?? '__none'}
                        >
                          <SelectTrigger id={`maintenance-line-item-category-${index}`}>
                            <SelectValue placeholder="Optional category mapping" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">No mapping</SelectItem>
                            {categoryOptions.map((category) => (
                              <SelectItem key={category} value={category}>
                                {formatMaintenanceCategory(category)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormField>

                  <FormField
                    className="md:col-span-2 xl:col-span-2"
                    error={errors.lineItems?.[index]?.name?.message}
                    htmlFor={`maintenance-line-item-name-${index}`}
                    label="Name"
                  >
                    <Input
                      id={`maintenance-line-item-name-${index}`}
                      placeholder="Engine oil, labor, GST, oil filter"
                      {...register(`lineItems.${index}.name`)}
                    />
                  </FormField>

                  <FormField
                    error={errors.lineItems?.[index]?.brand?.message}
                    htmlFor={`maintenance-line-item-brand-${index}`}
                    label="Brand"
                  >
                    <Input
                      id={`maintenance-line-item-brand-${index}`}
                      placeholder="Shell, Bosch"
                      {...register(`lineItems.${index}.brand`)}
                    />
                  </FormField>

                  <FormField
                    error={errors.lineItems?.[index]?.partNumber?.message}
                    htmlFor={`maintenance-line-item-part-number-${index}`}
                    label="Part number"
                  >
                    <Input
                      id={`maintenance-line-item-part-number-${index}`}
                      placeholder="Optional"
                      {...register(`lineItems.${index}.partNumber`)}
                    />
                  </FormField>

                  <FormField
                    error={errors.lineItems?.[index]?.quantity?.message}
                    htmlFor={`maintenance-line-item-quantity-${index}`}
                    label="Quantity"
                  >
                    <Input
                      id={`maintenance-line-item-quantity-${index}`}
                      min={0}
                      step="0.01"
                      type="number"
                      {...register(`lineItems.${index}.quantity`, {
                        setValueAs: toOptionalNumber,
                      })}
                    />
                  </FormField>

                  <FormField
                    error={errors.lineItems?.[index]?.unit?.message}
                    htmlFor={`maintenance-line-item-unit-${index}`}
                    label="Unit"
                  >
                    <Input
                      id={`maintenance-line-item-unit-${index}`}
                      placeholder="L, pcs, hrs"
                      {...register(`lineItems.${index}.unit`)}
                    />
                  </FormField>

                  <FormField
                    error={errors.lineItems?.[index]?.unitPrice?.message}
                    htmlFor={`maintenance-line-item-unit-price-${index}`}
                    label="Unit price"
                  >
                    <Input
                      id={`maintenance-line-item-unit-price-${index}`}
                      min={0}
                      step="0.01"
                      type="number"
                      {...register(`lineItems.${index}.unitPrice`, {
                        setValueAs: toOptionalNumber,
                      })}
                    />
                  </FormField>

                  <FormField
                    description={
                      typeof lineItem?.quantity === 'number' &&
                      typeof lineItem?.unitPrice === 'number' &&
                      lineItem?.lineTotal === undefined
                        ? `Will resolve to ${formatCurrency(resolvedTotal, currencyCode)}`
                        : undefined
                    }
                    error={errors.lineItems?.[index]?.lineTotal?.message}
                    htmlFor={`maintenance-line-item-total-${index}`}
                    label="Line total"
                  >
                    <Input
                      id={`maintenance-line-item-total-${index}`}
                      min={0}
                      step="0.01"
                      type="number"
                      {...register(`lineItems.${index}.lineTotal`, {
                        setValueAs: toOptionalNumber,
                      })}
                    />
                  </FormField>
                </div>

                <FormField
                  className="mt-4"
                  error={errors.lineItems?.[index]?.notes?.message}
                  htmlFor={`maintenance-line-item-notes-${index}`}
                  label="Item notes"
                >
                  <Textarea
                    id={`maintenance-line-item-notes-${index}`}
                    placeholder="Part grade, job details, fitment notes, or warranty context"
                    {...register(`lineItems.${index}.notes`)}
                  />
                </FormField>

                {typeof lineItem?.quantity === 'number' &&
                typeof lineItem?.unitPrice === 'number' &&
                lineItem?.lineTotal === undefined ? (
                  <div className="mt-3 flex justify-end">
                    <Button
                      onClick={() =>
                        setValue(`lineItems.${index}.lineTotal`, resolvedTotal, {
                          shouldDirty: true,
                        })
                      }
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      Use Derived Total
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-slate-50/60 px-4 py-6 text-sm text-slate-500">
            Add the individual jobs, parts, or fluids if you want a structured service record.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function toOptionalNumber(value: string) {
  return value === '' ? undefined : Number(value);
}

function formatLineItemKind(kind: MaintenanceLineItem['kind']) {
  return kind
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
