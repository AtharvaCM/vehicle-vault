import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex items-center gap-2">
          {accent ? <div>{accent}</div> : null}
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
