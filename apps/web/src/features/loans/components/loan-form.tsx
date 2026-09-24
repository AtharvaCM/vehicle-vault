import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateVehicleLoanInput } from '@vehicle-vault/shared';

import { Figure } from '@/components/shared/figure';
import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format } from '@/lib/format';

import { loanFormSchema, type LoanFormValues } from '../schemas/loan-form.schema';
import { computeEmiPreview } from '../utils/compute-emi';

type LoanFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: CreateVehicleLoanInput) => Promise<void> | void;
  submitError?: string | null;
  initialValues?: Partial<LoanFormValues>;
  submitLabel?: string;
};

export function LoanForm({
  isSubmitting = false,
  onSubmit,
  submitError,
  initialValues,
  submitLabel = 'Save loan',
}: LoanFormProps) {
  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      lender: '',
      accountNumber: '',
      // Empty rather than 0, so there is nothing to clear before typing.
      principal: undefined,
      interestRate: undefined,
      tenureMonths: 60,
      startDate: new Date().toISOString().split('T')[0],
      notes: '',
      ...initialValues,
    },
  });

  const principal = form.watch('principal');
  const interestRate = form.watch('interestRate');
  const tenureMonths = form.watch('tenureMonths');
  const emiPreview = computeEmiPreview(principal, interestRate, tenureMonths);
  const totalPayable = emiPreview > 0 ? emiPreview * tenureMonths : 0;
  const totalInterest = emiPreview > 0 ? Math.max(0, totalPayable - principal) : 0;

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit({
        ...values,
        startDate: new Date(values.startDate).toISOString(),
        accountNumber: values.accountNumber || undefined,
        notes: values.notes || undefined,
      });
    } catch {
      // Parent surfaces error.
    }
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="loan-lender"
          label="Lender"
          error={form.formState.errors.lender?.message}
        >
          <Input
            id="loan-lender"
            {...form.register('lender')}
            placeholder="HDFC Bank, SBI, Bajaj Finserv…"
          />
        </FormField>

        <FormField
          htmlFor="loan-account"
          label="Account number (optional)"
          error={form.formState.errors.accountNumber?.message}
        >
          <Input id="loan-account" {...form.register('accountNumber')} />
        </FormField>

        <FormField
          htmlFor="loan-principal"
          label="Principal (₹)"
          error={form.formState.errors.principal?.message}
        >
          <Input
            id="loan-principal"
            {...form.register('principal', { valueAsNumber: true })}
            type="number"
            min={0}
            step="1"
          />
        </FormField>

        <FormField
          htmlFor="loan-rate"
          label="Interest rate (% per year)"
          error={form.formState.errors.interestRate?.message}
        >
          <Input
            id="loan-rate"
            {...form.register('interestRate', { valueAsNumber: true })}
            type="number"
            min={0}
            max={100}
            step="0.01"
          />
        </FormField>

        <FormField
          htmlFor="loan-tenure"
          label="Tenure (months)"
          error={form.formState.errors.tenureMonths?.message}
        >
          <Input
            id="loan-tenure"
            {...form.register('tenureMonths', { valueAsNumber: true })}
            type="number"
            min={1}
            max={600}
            step="1"
          />
        </FormField>

        <FormField
          htmlFor="loan-start"
          label="Start date"
          error={form.formState.errors.startDate?.message}
        >
          <Input id="loan-start" {...form.register('startDate')} type="date" />
        </FormField>
      </div>

      <FormField htmlFor="loan-notes" label="Notes" error={form.formState.errors.notes?.message}>
        <Textarea
          id="loan-notes"
          {...form.register('notes')}
          placeholder="Co-borrower, EMI date…"
        />
      </FormField>

      <div className="rounded-md border border-border bg-muted/30 p-4 text-ui">
        <div className="font-medium text-foreground/90">Preview</div>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <Figure label="EMI" value={format.money(emiPreview)} />
          <Figure label="Total interest" value={format.money(totalInterest)} />
          <Figure label="Total payable" value={format.money(totalPayable)} />
        </div>
      </div>

      {submitError ? <InlineError message={submitError} /> : null}

      <div className="flex justify-end pt-2">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
