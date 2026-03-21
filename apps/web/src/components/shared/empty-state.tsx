import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { Inbox } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3.5 rounded-xl border border-dashed border-border bg-slate-50/80 p-5',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
        <Icon className="h-4.5 w-4.5 text-slate-500" />
      </div>
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="max-w-2xl text-sm leading-5 text-muted-foreground">{description}</p>
      </div>

      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyStateAction({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button className={cn('rounded-xl', className)} {...props}>
      {children}
    </Button>
  );
}
