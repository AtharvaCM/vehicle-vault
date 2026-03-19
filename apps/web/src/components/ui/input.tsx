import { forwardRef } from 'react';

import { cn } from '@/lib/utils/cn';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200',
        className,
      )}
      ref={ref}
      type={type}
      {...props}
    />
  );
});
