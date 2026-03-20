import type { ReactNode } from 'react';

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

export function FormField({
  label,
  htmlFor,
  children,
  error,
  description,
  className,
}: FormFieldProps) {
  const message = error ?? description;

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {message ? (
        <p className={cn('text-xs', error ? 'text-rose-600' : 'text-muted-foreground')}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
