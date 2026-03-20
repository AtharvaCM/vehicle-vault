import { SectionCard } from '@/components/shared/section-card';
import { Skeleton } from '@/components/ui/skeleton';

type LoadingStateProps = {
  title: string;
  description: string;
};

export function LoadingState({ title, description }: LoadingStateProps) {
  return (
    <SectionCard description={description} title={title}>
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
    </SectionCard>
  );
}
