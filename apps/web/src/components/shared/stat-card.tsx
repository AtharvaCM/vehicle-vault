import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type StatCardProps = {
  label: string;
  value: string;
  description: string;
  accent?: ReactNode;
};

export function StatCard({ label, value, description, accent }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <CardTitle className="text-sm font-medium text-slate-600">{label}</CardTitle>
        {accent ? <div>{accent}</div> : null}
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="text-sm text-slate-600">{description}</p>
      </CardContent>
    </Card>
  );
}
