import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { SectionCard } from '@/components/shared/section-card';

type ErrorStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <SectionCard className="border-rose-200 bg-rose-50/60" title={title}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <p className="text-sm leading-6 text-rose-800">{description}</p>
        </div>
        {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
      </div>
    </SectionCard>
  );
}
