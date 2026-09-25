import { Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { confirm } from '@/components/shared/confirm';
import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { ResourceLoadError } from '@/components/errors/resource-load-error';
import { buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { useMaintenanceRecords } from '@/features/maintenance/hooks/use-maintenance-records';
import { useCurrentUserRole } from '@/features/vehicle-sharing/hooks/use-sharing';
import { useVehicleAudit } from '@/features/audit/hooks/use-vehicle-audit';
import { useVehicleDocuments } from '@/features/vehicle-documents/hooks/use-documents';
import { papersAttention } from '@/features/vehicle-documents/utils/papers-attention';
import { ProtectionTab } from '../components/protection-tab';
import { accessFor, VehicleAccessProvider } from '../context/vehicle-access';
import { VehicleSetupPrompt } from '../components/vehicle-setup-prompt';
import { ResaleReportDialog } from '../components/resale-report-dialog';
import { VehicleDetailHeader, type VehicleActions } from '../components/vehicle-detail-header';
import { VehicleHistoryTab } from '../components/vehicle-history-tab';
import { VehicleMoreTab } from '../components/vehicle-more-tab';
import { VehicleOverview } from '../components/vehicle-overview';
import { VehicleRemindersTab } from '../components/vehicle-reminders-tab';
import { VehicleTabList } from '../components/vehicle-tab-list';

import { downloadServiceHistoryPdf } from '../api/download-service-history';
import { useDeleteVehicle } from '../hooks/use-delete-vehicle';
import { useVehicle } from '../hooks/use-vehicle';
import {
  defaultVehicleDetailTab,
  defaultVehicleHistoryView,
  type VehicleDetailSearch,
  type VehicleDetailTab,
} from '../types/vehicle-detail-search';
import { getVehicleServiceInsights } from '../utils/get-vehicle-service-insights';

type VehicleDetailPageProps = {
  onSearchStateChange: (next: Partial<VehicleDetailSearch>) => void;
  searchState: VehicleDetailSearch;
  vehicleId: string;
};

export function VehicleDetailPage({
  onSearchStateChange,
  searchState,
  vehicleId,
}: VehicleDetailPageProps) {
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isResaleDialogOpen, setIsResaleDialogOpen] = useState(false);
  const vehicleQuery = useVehicle(vehicleId);
  const maintenanceQuery = useMaintenanceRecords(vehicleId);
  const documentsQuery = useVehicleDocuments(vehicleId);
  const auditQuery = useVehicleAudit(vehicleId);
  // The vehicle payload carries the caller's role, so it is known as soon as the
  // vehicle is; the members lookup is only a fallback for an API that omits it.
  const { role: memberRole, isLoading: isMemberRoleLoading } = useCurrentUserRole(vehicleId);
  const currentUserRole = vehicleQuery.data?.currentUserRole ?? memberRole ?? null;
  const isRoleLoading = !vehicleQuery.data?.currentUserRole && isMemberRoleLoading;
  const isOwner = accessFor(currentUserRole).isOwner;
  const selectedTab = searchState.tab ?? defaultVehicleDetailTab;
  const deleteVehicleMutation = useDeleteVehicle();
  const vehicle = vehicleQuery.data ?? null;
  const serviceInsights = useMemo(
    () =>
      vehicle
        ? getVehicleServiceInsights({
            vehicle,
            records: maintenanceQuery.data ?? [],
          })
        : null,
    [maintenanceQuery.data, vehicle],
  );
  const papers = useMemo(
    () => (documentsQuery.data ? papersAttention(documentsQuery.data) : null),
    [documentsQuery.data],
  );

  // Loans are the owner's: anyone else sent there lands on the list of sections.
  useEffect(() => {
    if (searchState.section === 'loans' && !isRoleLoading && !isOwner) {
      onSearchStateChange({ tab: 'more', section: undefined });
    }
  }, [isOwner, isRoleLoading, onSearchStateChange, searchState.section]);

  const handleDeleteVehicle = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Delete this vehicle?',
      description:
        "This removes the vehicle, its service history, reminders, and attachment details. This can't be undone.",
      confirmLabel: 'Delete vehicle',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      setActionError(null);
      await deleteVehicleMutation.mutateAsync(vehicleId);
      appToast.success({
        title: 'Vehicle deleted',
        description: 'The vehicle and its linked history were removed.',
      });
      await navigate({ to: '/garage' });
    } catch (error) {
      appToast.error({
        title: 'Unable to delete vehicle',
        description: getApiErrorMessage(error, 'Unable to delete the vehicle.'),
      });
      setActionError(getApiErrorMessage(error, 'Unable to delete the vehicle.'));
    }
  }, [deleteVehicleMutation, navigate, vehicleId]);

  if (vehicleQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle
          description="Loading this vehicle and its latest activity."
          title="Vehicle detail"
        />
        <LoadingState description="Getting this vehicle ready." title="Loading vehicle" />
      </PageContainer>
    );
  }

  if (vehicleQuery.isError) {
    return (
      <ResourceLoadError
        error={vehicleQuery.error}
        isRetrying={vehicleQuery.isRefetching}
        listAction={
          <Link className={buttonVariants({ variant: 'secondary' })} to="/garage">
            Your garage
          </Link>
        }
        onRetry={() => void vehicleQuery.refetch()}
        pageDescription="Review one vehicle's details, service history, reminders, and receipts in one place."
        resourceLabel="Vehicle"
        subject="vehicle"
      />
    );
  }

  if (!vehicle || !serviceInsights) {
    return null;
  }

  const actions: VehicleActions = {
    onDownloadServiceHistory: () => {
      void (async () => {
        try {
          await downloadServiceHistoryPdf(vehicle.id, vehicle.registrationNumber);
          appToast.success({
            title: 'Service history downloaded',
            description: 'Saved as a PDF you can share or print.',
          });
        } catch (error) {
          appToast.error({
            title: 'Could not generate PDF',
            description: getApiErrorMessage(error),
          });
        }
      })();
    },
    onDownloadResaleReport: () => setIsResaleDialogOpen(true),
    onDeleteVehicle: () => void handleDeleteVehicle(),
  };

  return (
    <VehicleAccessProvider role={currentUserRole}>
      <Tabs
        className="min-h-screen"
        // A tab starts on its own default view: History on the service log, More on its list.
        onValueChange={(tab) => onSearchStateChange({ tab: tab as VehicleDetailTab })}
        value={selectedTab}
      >
        <VehicleDetailHeader
          actions={actions}
          documents={documentsQuery.data}
          tabs={<VehicleTabList papers={papers} />}
          vehicle={vehicle}
        />

        <ResaleReportDialog
          onOpenChange={setIsResaleDialogOpen}
          open={isResaleDialogOpen}
          registrationNumber={vehicle.registrationNumber}
          vehicleId={vehicle.id}
        />

        <PageContainer className="py-6 md:py-8">
          {actionError ? (
            <div className="mb-6">
              <InlineError message={actionError} />
            </div>
          ) : null}

          <TabsContent value="overview" className="mt-0 space-y-6 animate-in fade-in duration-500">
            <VehicleSetupPrompt
              dismissedAt={vehicle.setupPromptDismissedAt}
              fuelType={vehicle.fuelType}
              vehicleId={vehicleId}
            />
            <VehicleOverview canEdit={accessFor(currentUserRole).canEdit} vehicle={vehicle} />
          </TabsContent>

          <TabsContent value="history" className="mt-0 animate-in fade-in duration-500">
            <VehicleHistoryTab
              fuelType={vehicle.fuelType}
              odometer={vehicle.odometer}
              onSearchChange={(search) => onSearchStateChange({ tab: 'history', search })}
              onViewChange={(view) => onSearchStateChange({ tab: 'history', view })}
              search={searchState.search}
              serviceInsights={serviceInsights}
              vehicle={vehicle}
              view={searchState.view ?? defaultVehicleHistoryView}
            />
          </TabsContent>

          <TabsContent value="reminders" className="mt-0 animate-in fade-in duration-500">
            <VehicleRemindersTab vehicleId={vehicleId} />
          </TabsContent>

          <TabsContent value="papers" className="mt-0 animate-in fade-in duration-500">
            <ProtectionTab fuelType={vehicle.fuelType} vehicleId={vehicleId} />
          </TabsContent>

          <TabsContent value="more" className="mt-0 animate-in fade-in duration-500">
            <VehicleMoreTab
              actions={actions}
              auditQuery={auditQuery}
              currentUserRole={currentUserRole}
              maintenanceQuery={maintenanceQuery}
              section={searchState.section}
              vehicle={vehicle}
            />
          </TabsContent>
        </PageContainer>
      </Tabs>
    </VehicleAccessProvider>
  );
}
