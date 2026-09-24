import { Link, useNavigate } from '@tanstack/react-router';
import { CarFront, ChevronRight, ClipboardList, Fuel, Gauge, LayoutGrid, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Figure } from '@/components/shared/figure';
import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { SectionHeader } from '@/components/shared/section-header';
import { ResourceLoadError } from '@/components/errors/resource-load-error';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useActiveTabInView } from '@/hooks/use-active-tab-in-view';

import { MaintenanceRecordCard } from '@/features/maintenance/components/maintenance-record-card';
import { useMaintenanceRecords } from '@/features/maintenance/hooks/use-maintenance-records';
import { ReminderCard } from '@/features/reminders/components/reminder-card';
import { useVehicleReminders } from '@/features/reminders/hooks/use-vehicle-reminders';
import { FuelType, ReminderStatus } from '@vehicle-vault/shared';
import { VehicleIdentity } from '@/components/shared/vehicle-identity';

import { FuelTab } from '@/features/fuel-logs/components/fuel-tab';
import { FuelEconomyCard } from '@/features/fuel-logs/components/fuel-economy-card';
import { MembersTab } from '@/features/vehicle-sharing/components/members-tab';
import { useCurrentUserRole } from '@/features/vehicle-sharing/hooks/use-sharing';
import { AuditFeed } from '@/features/audit/components/audit-feed';
import { useVehicleAudit } from '@/features/audit/hooks/use-vehicle-audit';
import { OdometerForecastCard } from '../components/odometer-forecast-card';
import { OdometerHistoryCard } from '../components/odometer-history-card';
import { VehicleSpecsCard } from '../components/vehicle-specs-card';
import { ServiceTrendCard } from '../components/service-trend-card';
import { VehicleSummaryCard } from '../components/vehicle-summary-card';
import { VehicleTyreTracker } from '../components/vehicle-tyre-tracker';
import { AccessoriesTab } from '@/features/accessories/components/accessories-tab';
import { ServiceHistoryCard } from '@/features/service-baseline/components/service-history-card';
import { ProtectionTab } from '../components/protection-tab';
import { accessFor, useVehicleAccess, VehicleAccessProvider } from '../context/vehicle-access';
import { VehicleSetupPrompt } from '../components/vehicle-setup-prompt';
import { ResaleReportDialog } from '../components/resale-report-dialog';
import { describeVehicleModel } from '../utils/describe-vehicle-model';
import { TcoCard } from '@/features/analytics/components/tco-card';
import { VehicleLoansPanel } from '@/features/loans/components/vehicle-loans-panel';

import { downloadServiceHistoryPdf } from '../api/download-service-history';
import { useDeleteVehicle } from '../hooks/use-delete-vehicle';
import { useVehicle } from '../hooks/use-vehicle';
import {
  defaultVehicleDetailTab,
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
  const remindersQuery = useVehicleReminders(vehicleId);
  const auditQuery = useVehicleAudit(vehicleId);
  // The vehicle payload carries the caller's role, so it is known as soon as the
  // vehicle is; the members lookup is only a fallback for an API that omits it.
  const { role: memberRole, isLoading: isMemberRoleLoading } = useCurrentUserRole(vehicleId);
  const currentUserRole = vehicleQuery.data?.currentUserRole ?? memberRole ?? null;
  const isRoleLoading = !vehicleQuery.data?.currentUserRole && isMemberRoleLoading;
  const access = accessFor(currentUserRole);
  const isOwner = access.isOwner;
  const selectedTab = searchState.tab ?? defaultVehicleDetailTab;
  const visibleTab = selectedTab === 'loans' && !isOwner ? defaultVehicleDetailTab : selectedTab;
  const tabListRef = useActiveTabInView(visibleTab);
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

  useEffect(() => {
    if (selectedTab === 'loans' && !isRoleLoading && !isOwner) {
      onSearchStateChange({ tab: defaultVehicleDetailTab });
    }
  }, [isOwner, isRoleLoading, onSearchStateChange, selectedTab]);

  async function handleDeleteVehicle() {
    try {
      setActionError(null);
      await deleteVehicleMutation.mutateAsync(vehicleId);
      appToast.success({
        title: 'Vehicle deleted',
        description: 'The vehicle and its linked history were removed.',
      });
      await navigate({ to: '/vehicles' });
    } catch (error) {
      appToast.error({
        title: 'Unable to delete vehicle',
        description: getApiErrorMessage(error, 'Unable to delete the vehicle.'),
      });
      setActionError(getApiErrorMessage(error, 'Unable to delete the vehicle.'));
    }
  }

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
          <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
            Your vehicles
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

  const title = vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;
  const activeReminders = (remindersQuery.data ?? []).filter(
    (reminder) => reminder.status !== ReminderStatus.Completed,
  );

  return (
    <VehicleAccessProvider role={currentUserRole}>
      <div className="min-h-screen">
        {/* Premium Hero Section */}
        <div className="border-b border-line/60 bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Link
                    aria-label="Back to your vehicles"
                    to="/vehicles"
                    className="flex size-11 items-center justify-center rounded-full bg-page text-fg-3 hover:bg-page hover:text-fg-2 transition-colors md:h-8 md:w-8"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </Link>
                  {access.isViewer ? (
                    <Badge
                      className="border-line bg-page text-fg-2"
                      title="You can see this vehicle but not change it. Ask the owner for editor access to make changes."
                      variant="outline"
                    >
                      View only
                    </Badge>
                  ) : null}
                </div>

                <VehicleIdentity
                  details={`${describeVehicleModel(vehicle)} · ${format.odometer(vehicle.odometer)}`}
                  electric={vehicle.fuelType === FuelType.Electric}
                  layout="header"
                  name={title}
                  registration={vehicle.registrationNumber}
                />

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <HeroMetric
                    icon={<Gauge className="h-4 w-4" />}
                    label="Odometer"
                    value={format.odometer(vehicle.odometer)}
                  />
                  <div className="h-8 w-px bg-page hidden sm:block" />
                  <HeroMetric
                    icon={<Fuel className="h-4 w-4" />}
                    label="Fuel type"
                    value={format.enumLabel('fuelType', vehicle.fuelType)}
                  />
                  <div className="h-8 w-px bg-page hidden sm:block" />
                  <HeroMetric
                    icon={<CarFront className="h-4 w-4" />}
                    label="Vehicle type"
                    value={format.enumLabel('vehicleType', vehicle.vehicleType)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {access.canEdit ? (
                    <>
                      <Link
                        className={buttonVariants({ variant: 'outline' })}
                        params={{ vehicleId }}
                        to="/vehicles/$vehicleId/edit"
                      >
                        Edit vehicle
                      </Link>
                      <div className="h-10 w-px bg-line-subtle/60 hidden sm:block" />
                      <Link
                        className={cn(buttonVariants({ variant: 'default' }), ' bg-primary')}
                        params={{ vehicleId }}
                        to="/vehicles/$vehicleId/maintenance/new"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Log service
                      </Link>
                      <Link
                        className={cn(buttonVariants({ variant: 'secondary' }), '')}
                        params={{ vehicleId }}
                        to="/vehicles/$vehicleId/reminders/new"
                      >
                        Add reminder
                      </Link>
                    </>
                  ) : null}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-label="More vehicle actions" size="icon" variant="outline">
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl border-line/60">
                      <DropdownMenuItem asChild>
                        <Link
                          params={{ vehicleId }}
                          className="w-full cursor-pointer"
                          to="/vehicles/$vehicleId/maintenance"
                        >
                          View full history
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          params={{ vehicleId }}
                          className="w-full cursor-pointer"
                          to="/vehicles/$vehicleId/reminders"
                        >
                          Manage all reminders
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onSelect={async (event) => {
                          event.preventDefault();
                          const vehicle = vehicleQuery.data;
                          if (!vehicle) return;
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
                        }}
                      >
                        Download service history (PDF)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setIsResaleDialogOpen(true)}
                      >
                        Download resale report (PDF)
                      </DropdownMenuItem>
                      {isOwner ? <DropdownMenuSeparator /> : null}
                      {isOwner ? (
                        <DropdownMenuItem
                          className="text-late focus:bg-late-tint focus:text-late cursor-pointer"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <ConfirmActionDialog
                            confirmLabel="Delete vehicle"
                            description="This removes the vehicle, its service history, reminders, and attachment details. This can't be undone."
                            isPending={deleteVehicleMutation.isPending}
                            onConfirm={handleDeleteVehicle}
                            title="Delete this vehicle?"
                            triggerLabel="Delete vehicle permanently"
                            triggerVariant="ghost"
                            className="w-full justify-start h-auto p-0 font-normal hover:bg-transparent"
                          />
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ResaleReportDialog
          onOpenChange={setIsResaleDialogOpen}
          open={isResaleDialogOpen}
          registrationNumber={vehicle.registrationNumber}
          vehicleId={vehicle.id}
        />

        <PageContainer className="py-8">
          {actionError ? (
            <div className="mb-6">
              <InlineError message={actionError} />
            </div>
          ) : null}

          <Tabs
            className="space-y-8"
            onValueChange={(tab) => onSearchStateChange({ tab: tab as VehicleDetailTab })}
            value={visibleTab}
          >
            {/* Eleven tabs are wider than a phone, and than some desktops: the strip
                scrolls sideways rather than clipping, with the selected tab kept in view. */}
            <TabsList
              className="relative inline-flex h-auto min-h-11 max-w-full items-center justify-start overflow-x-auto overscroll-x-contain rounded-xl bg-page/80 p-1 shadow-inner scrollbar-thin"
              ref={tabListRef}
            >
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-ui font-bold data-[state=active]:bg-surface data-[state=active]:text-primary transition-colors"
                value="overview"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-ui font-bold data-[state=active]:bg-surface data-[state=active]:text-primary transition-colors"
                value="maintenance"
              >
                Service log
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-ui font-bold data-[state=active]:bg-surface data-[state=active]:text-primary transition-colors"
                value="specs"
              >
                Tech specs
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-ui font-bold data-[state=active]:bg-surface data-[state=active]:text-primary transition-colors"
                value="reminders"
              >
                Reminders
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-ui font-bold data-[state=active]:bg-surface data-[state=active]:text-primary transition-colors"
                value="fuel"
              >
                Fuel
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-ui font-bold data-[state=active]:bg-surface data-[state=active]:text-primary transition-colors"
                value="tyres"
              >
                Tyres
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-ui font-bold data-[state=active]:bg-surface data-[state=active]:text-primary transition-colors"
                value="accessories"
              >
                Accessories
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-ui font-bold data-[state=active]:bg-surface data-[state=active]:text-primary transition-colors"
                value="protection"
              >
                Protection
              </TabsTrigger>
              {isOwner ? (
                <TabsTrigger
                  className="rounded-lg px-6 py-2 text-ui font-bold data-[state=active]:bg-surface data-[state=active]:text-primary transition-colors"
                  value="loans"
                >
                  Loans
                </TabsTrigger>
              ) : null}
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-ui font-bold data-[state=active]:bg-surface data-[state=active]:text-primary transition-colors"
                value="members"
              >
                Members
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-ui font-bold data-[state=active]:bg-surface data-[state=active]:text-primary transition-colors"
                value="activity"
              >
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
              <VehicleSetupPrompt
                dismissedAt={vehicle.setupPromptDismissedAt}
                fuelType={vehicle.fuelType}
                vehicleId={vehicleId}
              />

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <VehicleSummaryCard vehicle={vehicle} />
                <OdometerForecastCard vehicleId={vehicleId} />
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <SnapshotMetric
                  label="Service records"
                  value={maintenanceQuery.isSuccess ? String(maintenanceQuery.data.length) : '...'}
                />
                <SnapshotMetric
                  label="Active reminders"
                  value={remindersQuery.isSuccess ? String(activeReminders.length) : '...'}
                />
                <SnapshotMetric label="Odometer" value={format.odometer(vehicle.odometer)} />
                <SnapshotMetric
                  label="Fuel"
                  value={format.enumLabel('fuelType', vehicle.fuelType)}
                />
              </div>

              <FuelEconomyCard vehicleId={vehicleId} />

              <TcoCard vehicleId={vehicleId} />

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <OdometerHistoryCard insights={serviceInsights} />
                <ServiceTrendCard insights={serviceInsights} />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <MaintenancePanel maintenanceQuery={maintenanceQuery} vehicleId={vehicleId} />
                <ReminderPanel
                  remindersQuery={remindersQuery}
                  vehicleId={vehicleId}
                  visibleReminders={activeReminders}
                />
              </div>
            </TabsContent>

            <TabsContent value="specs" className="animate-in fade-in duration-500">
              <VehicleSpecsCard
                make={vehicle.make}
                model={vehicle.model}
                variant={vehicle.variant}
              />
            </TabsContent>

            <TabsContent value="maintenance" className="animate-in fade-in duration-500">
              <div className="mb-6">
                <ServiceHistoryCard vehicleId={vehicleId} />
              </div>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <MaintenancePanel
                  maintenanceQuery={maintenanceQuery}
                  title="Service history"
                  vehicleId={vehicleId}
                  visibleCount={undefined}
                />
                <Card className="h-fit border-line/60 bg-surface/70">
                  <CardHeader>
                    <CardTitle className="text-lead font-bold">Vehicle health</CardTitle>
                    <CardDescription>Maintain a perfect digital service record.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-small leading-relaxed text-fg-3">
                    <div className="flex gap-3">
                      <div className="mt-1 shrink-0 text-primary">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <p>
                        Log each visit or repair with the odometer so the timeline stays accurate.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="mt-1 shrink-0 text-primary">
                        <Plus className="h-4 w-4" />
                      </div>
                      <p>Open a service record to attach receipts, invoices, or photos.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="mt-1 shrink-0 text-primary">
                        <Gauge className="h-4 w-4" />
                      </div>
                      <p>Use next due fields to capture what should happen next.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="reminders" className="animate-in fade-in duration-500">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <ReminderPanel
                  remindersQuery={remindersQuery}
                  title="Reminder queue"
                  vehicleId={vehicleId}
                  visibleCount={undefined}
                  visibleReminders={activeReminders}
                />
                <Card className="h-fit border-line/60 bg-surface/70">
                  <CardHeader>
                    <CardTitle className="text-lead font-bold">Preventative care</CardTitle>
                    <CardDescription>Stay ahead of service tasks.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-small leading-relaxed text-fg-3">
                    <p>Set a due date, a due odometer, or both depending on the job.</p>
                    <p>
                      Overdue and due today reminders show up on the dashboard and reminder lists.
                    </p>
                    <p>Completed reminders stay in history for reference.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="fuel" className="animate-in fade-in duration-500">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <FuelTab vehicleId={vehicleId} />
                <div className="h-fit space-y-6">
                  <FuelEconomyCard vehicleId={vehicleId} />
                  <Card className="h-fit border-line/60 bg-surface/70">
                    <CardHeader>
                      <CardTitle className="text-lead font-bold">
                        Getting an accurate figure
                      </CardTitle>
                      <CardDescription>Economy is measured between fill-ups.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-small leading-relaxed text-fg-3">
                      <div className="flex gap-3">
                        <div className="mt-1 shrink-0 text-primary">
                          <Fuel className="h-4 w-4" />
                        </div>
                        <p>
                          Log every fill-up to see how your driving habits affect your fuel economy.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <div className="mt-1 shrink-0 text-primary">
                          <Gauge className="h-4 w-4" />
                        </div>
                        <p>
                          Capture the precise odometer reading for accurate consumption calculation.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="tyres" className="animate-in fade-in duration-500">
              <VehicleTyreTracker maintenanceQuery={maintenanceQuery} vehicle={vehicle} />
            </TabsContent>
            <TabsContent value="accessories" className="animate-in fade-in duration-500">
              <AccessoriesTab vehicleId={vehicleId} />
            </TabsContent>
            <TabsContent value="protection" className="animate-in fade-in duration-500">
              <ProtectionTab fuelType={vehicle.fuelType} vehicleId={vehicleId} />
            </TabsContent>
            {isOwner ? (
              <TabsContent value="loans" className="animate-in fade-in duration-500">
                <VehicleLoansPanel
                  vehicleId={vehicleId}
                  vehicleLabel={`${vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`} • ${vehicle.registrationNumber}`}
                />
              </TabsContent>
            ) : null}
            <TabsContent value="members" className="animate-in fade-in duration-500">
              <MembersTab vehicleId={vehicleId} currentUserRole={currentUserRole} />
            </TabsContent>
            <TabsContent value="activity" className="animate-in fade-in duration-500">
              <Card className="border-line/60 bg-surface">
                <CardHeader className="border-b border-line-subtle pb-4">
                  <CardTitle className="text-lead font-bold">Activity log</CardTitle>
                  <CardDescription>
                    Every change to this vehicle and its records, newest first. Click an entry to
                    see what changed.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  <AuditFeed
                    query={auditQuery}
                    emptyDescription="Changes to this vehicle and its service, reminders, fuel, and documents will show up here."
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </PageContainer>
      </div>
    </VehicleAccessProvider>
  );
}

function HeroMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="text-fg-3">
        {icon}
      </span>
      <Figure label={label} value={value} />
    </div>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <Figure label={label} value={value} />
    </div>
  );
}

type MaintenancePanelProps = {
  vehicleId: string;
  maintenanceQuery: ReturnType<typeof useMaintenanceRecords>;
  title?: string;
  visibleCount?: number | undefined;
};

function MaintenancePanel({
  vehicleId,
  maintenanceQuery,
  title = 'Recent service',
  visibleCount = 3,
}: MaintenancePanelProps) {
  const { canEdit } = useVehicleAccess();
  const records =
    visibleCount === undefined
      ? (maintenanceQuery.data ?? [])
      : (maintenanceQuery.data ?? []).slice(0, visibleCount);

  return (
    <Card className="border-line/60 bg-surface">
      <CardHeader className="border-b border-line-subtle pb-4">
        <SectionHeader
          actions={
            <>
              <Link
                className={buttonVariants({ size: 'xs', variant: 'ghost' })}
                params={{ vehicleId }}
                to="/vehicles/$vehicleId/maintenance"
              >
                View all
              </Link>
              {canEdit ? (
                <Link
                  className={buttonVariants({ size: 'xs', variant: 'outline' })}
                  params={{ vehicleId }}
                  to="/vehicles/$vehicleId/maintenance/new"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Log
                </Link>
              ) : null}
            </>
          }
          as="h3"
          description="Service history records."
          title={title}
        />
      </CardHeader>
      <CardContent className="pt-5 sm:p-5">
        {maintenanceQuery.isPending ? (
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-page rounded-xl" />
            <div className="h-20 bg-page rounded-xl" />
          </div>
        ) : maintenanceQuery.isError ? (
          <EmptyState
            description="Service history couldn't be loaded right now."
            title="Unable to load service records"
          />
        ) : records.length ? (
          <div className="space-y-3">
            {records.map((record) => (
              <MaintenanceRecordCard key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <EmptyState
            action={
              canEdit ? (
                <Link
                  className={buttonVariants()}
                  params={{ vehicleId }}
                  to="/vehicles/$vehicleId/maintenance/new"
                >
                  Add first record
                </Link>
              ) : undefined
            }
            description="No service logged yet."
            title="No records"
          />
        )}
      </CardContent>
    </Card>
  );
}

type ReminderPanelProps = {
  vehicleId: string;
  remindersQuery: ReturnType<typeof useVehicleReminders>;
  visibleReminders: ReturnType<typeof useVehicleReminders>['data'];
  title?: string;
  visibleCount?: number | undefined;
};

function ReminderPanel({
  vehicleId,
  remindersQuery,
  visibleReminders,
  title = 'Upcoming reminders',
  visibleCount = 3,
}: ReminderPanelProps) {
  const { canEdit } = useVehicleAccess();
  const reminders =
    visibleCount === undefined
      ? (visibleReminders ?? [])
      : (visibleReminders ?? []).slice(0, visibleCount);

  return (
    <Card className="border-line/60 bg-surface">
      <CardHeader className="border-b border-line-subtle pb-4">
        <SectionHeader
          actions={
            <>
              <Link
                className={buttonVariants({ size: 'xs', variant: 'ghost' })}
                params={{ vehicleId }}
                to="/vehicles/$vehicleId/reminders"
              >
                View all
              </Link>
              {canEdit ? (
                <Link
                  className={buttonVariants({ size: 'xs', variant: 'outline' })}
                  params={{ vehicleId }}
                  to="/vehicles/$vehicleId/reminders/new"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Link>
              ) : null}
            </>
          }
          as="h3"
          description="Active service alerts."
          title={title}
        />
      </CardHeader>
      <CardContent className="pt-5 sm:p-5">
        {remindersQuery.isPending ? (
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-page rounded-xl" />
            <div className="h-20 bg-page rounded-xl" />
          </div>
        ) : remindersQuery.isError ? (
          <EmptyState
            description="Reminders couldn't be loaded right now."
            title="Unable to load reminders"
          />
        ) : reminders.length ? (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <ReminderCard key={reminder.id} reminder={reminder} />
            ))}
          </div>
        ) : (
          <EmptyState
            action={
              canEdit ? (
                <Link
                  className={buttonVariants()}
                  params={{ vehicleId }}
                  to="/vehicles/$vehicleId/reminders/new"
                >
                  Add first reminder
                </Link>
              ) : undefined
            }
            description="No active reminders."
            title="No reminders"
          />
        )}
      </CardContent>
    </Card>
  );
}
