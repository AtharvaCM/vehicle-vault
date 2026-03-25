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
    <Card className="group border-slate-200/60 bg-white/70 shadow-premium-sm transition-all hover:translate-y-[-2px] hover:shadow-premium-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 shadow-inner group-hover:bg-primary/5 group-hover:text-primary group-hover:shadow-none transition-colors">
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-500 transition-colors">
            {label}
          </span>
        </div>
        {accent ? <div className="animate-in fade-in zoom-in duration-500">{accent}</div> : null}
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        <p className="text-3xl font-bold tracking-tight text-slate-900 group-hover:text-primary transition-colors">
          {value}
        </p>
        <p className="text-[13px] leading-relaxed text-slate-500 line-clamp-2">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
