import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { SectionHeader } from '@/components/shared/section-header';
import { LoansSection } from '@/features/loans/components/loans-section';

import { CostSplitDonut } from '../components/cost-split-donut';
import { CostTrendChart } from '../components/cost-trend-chart';
import { VehicleSpendList } from '../components/vehicle-spend-list';

/**
 * Everything about what the garage costs, in one place (#281): the spend
 * charts that used to sit on Home, per-vehicle spend and cost per km, and
 * the loans page's whole body. `/loans` redirects here
 * (`routes/legacy-redirect-routes.tsx`).
 */
export function CostsPage() {
  return (
    <PageContainer className="pb-10">
      <PageTitle
        description="What your garage costs to run, and what's left on its loans."
        title="Costs"
      />

      <section aria-labelledby="spend-heading" className="space-y-3">
        <SectionHeader
          description="Where the money went, across all your vehicles."
          id="spend-heading"
          title="Spend"
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <CostSplitDonut />
          <CostTrendChart />
        </div>
      </section>

      <section aria-labelledby="by-vehicle-heading" className="space-y-3">
        <SectionHeader
          description="Lifetime spend and running cost per kilometre, one row per vehicle."
          id="by-vehicle-heading"
          title="By vehicle"
        />
        <VehicleSpendList />
      </section>

      <LoansSection />
    </PageContainer>
  );
}
