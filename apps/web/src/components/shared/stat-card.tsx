import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type StatCardProps = {
  label: string;
  value: string;
  description: string;
  accent?: ReactNode;
  icon?: LucideIcon;
};

export function StatCard({
  label,
  value,
  description,
  accent,
  icon: Icon = ArrowUpRight,
}: StatCardProps) {
  return (
    <Card className="group border-line bg-surface/70 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-page text-fg-3 shadow-inner group-hover:bg-primary/5 group-hover:text-primary group-hover:shadow-none transition-colors">
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-small font-medium text-fg-3 group-hover:text-fg-2 transition-colors">
            {label}
          </span>
        </div>
        {accent ? <div className="animate-in fade-in">{accent}</div> : null}
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        <p className="text-title font-bold tracking-tight text-fg group-hover:text-primary transition-colors">
          {value}
        </p>
        <p className="text-small leading-relaxed text-fg-3 line-clamp-2">{description}</p>
      </CardContent>
    </Card>
  );
}
