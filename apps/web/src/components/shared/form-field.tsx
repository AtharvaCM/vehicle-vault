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
    <div className={cn('grid gap-1.5', className)}>
      <Label className="text-[13px] font-medium text-foreground/90" htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
      {message ? (
        <p className={cn('text-xs leading-5', error ? 'text-rose-600' : 'text-muted-foreground')}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
