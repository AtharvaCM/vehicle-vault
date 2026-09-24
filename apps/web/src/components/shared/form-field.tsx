import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FormFieldProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  error?: string;
  description?: string;
  className?: string;
  /** Shown beside the label, e.g. where a value came from. */
  labelAddon?: ReactNode;
};

type DescribableProps = {
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
};

export function FormField({
  label,
  htmlFor,
  children,
  error,
  description,
  className,
  labelAddon,
}: FormFieldProps) {
  const message = error ?? description;
  const messageId = `${htmlFor}-message`;
  // The control points at its message so a screen reader reads the error with
  // the field, and an error is an alert so it is announced when it appears.
  // An error also marks the control invalid, which draws it in the late colour.
  const describable = isValidElement<DescribableProps>(children);
  const describe = message && describable && !children.props['aria-describedby'];
  const invalidate = error && describable && children.props['aria-invalid'] === undefined;
  const control =
    describe || invalidate
      ? cloneElement(children as ReactElement<DescribableProps>, {
          ...(describe ? { 'aria-describedby': messageId } : {}),
          ...(invalidate ? { 'aria-invalid': true } : {}),
        })
      : children;

  return (
    <div className={cn('grid gap-1.5', className)}>
      {labelAddon ? (
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={htmlFor}>{label}</Label>
          {labelAddon}
        </div>
      ) : (
        <Label htmlFor={htmlFor}>{label}</Label>
      )}
      {control}
      {message ? (
        <p
          className={cn('text-small', error ? 'text-late' : 'text-fg-2')}
          id={messageId}
          role={error ? 'alert' : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
