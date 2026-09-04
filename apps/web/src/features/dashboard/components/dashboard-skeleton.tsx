import { Skeleton } from '@/components/ui/skeleton';

/** Mirrors the loaded layout above the fold so the page barely shifts when data lands. */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="space-y-5" role="status">
      <Skeleton className="h-[108px] w-full" />

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="space-y-2 border-b border-border/60 px-5 pb-4 pt-5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="flex h-14 items-center gap-3 px-5" key={index}>
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="ml-auto h-8 w-16" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton className="h-[180px] w-full" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
