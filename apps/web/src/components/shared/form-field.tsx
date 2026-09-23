import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';

type FormFieldProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  error?: string;
  description?: string;
  className?: string;
};

type DescribableProps = { 'aria-describedby'?: string };

export function FormField({
  label,
  htmlFor,
  children,
  error,
  description,
  className,
}: FormFieldProps) {
  const message = error ?? description;
  const messageId = `${htmlFor}-message`;
  // The control points at its message so a screen reader reads the error with
  // the field, and an error is an alert so it is announced when it appears.
  const control =
    message && isValidElement<DescribableProps>(children) && !children.props['aria-describedby']
      ? cloneElement(children as ReactElement<DescribableProps>, { 'aria-describedby': messageId })
      : children;

  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label className="text-[13px] font-medium text-foreground/90" htmlFor={htmlFor}>
        {label}
      </Label>
      {control}
      {message ? (
        <p
          className={cn('text-xs leading-5', error ? 'text-rose-600' : 'text-muted-foreground')}
          id={messageId}
          role={error ? 'alert' : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
