import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';

import { DashboardOverview } from '../components/dashboard-overview';

const dashboardStats = {
  totalVehicles: 12,
  upcomingReminders: 5,
  overdueTasks: 2,
};

export function DashboardPage() {
  return (
    <PageContainer>
      <PageTitle
        description="Track the high-level state of your fleet, upcoming work, and items that need immediate attention."
        title="Dashboard"
      />

      <DashboardOverview {...dashboardStats} />
    </PageContainer>
  );
}
