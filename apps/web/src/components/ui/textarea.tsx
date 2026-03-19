import { forwardRef } from 'react';

import { cn } from '@/lib/utils/cn';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200',
        className,
      )}
      ref={ref}
      rows={rows}
      {...props}
    />
  );
});
