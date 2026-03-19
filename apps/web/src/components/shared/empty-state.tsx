import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-4 py-10">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>

        {action ? <div>{action}</div> : null}
      </CardContent>
    </Card>
  );
}
