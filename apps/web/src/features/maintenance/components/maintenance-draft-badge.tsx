import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Beside a record's category wherever it is listed: see `isDraftRecord`. */
export function MaintenanceDraftBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={cn('shrink-0 text-[10px] font-bold uppercase tracking-widest', className)}
      tone="warning"
    >
      Draft
    </Badge>
  );
}
