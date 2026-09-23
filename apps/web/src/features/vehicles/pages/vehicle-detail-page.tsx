import { Link, useNavigate } from '@tanstack/react-router';
import { CarFront, ChevronRight, ClipboardList, Fuel, Gauge, LayoutGrid, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
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
import { appToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useActiveTabInView } from '@/hooks/use-active-tab-in-view';

import { MaintenanceRecordCard } from '@/features/maintenance/components/maintenance-record-card';
import { useMaintenanceRecords } from '@/features/maintenance/hooks/use-maintenance-records';
import { ReminderCard } from '@/features/reminders/components/reminder-card';
import { useVehicleReminders } from '@/features/reminders/hooks/use-vehicle-reminders';
import { ReminderStatus } from '@vehicle-vault/shared';

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
import { describeVehicleModel } from '../utils/describe-vehicle-model';
import { TcoCard } from '@/features/analytics/components/tco-card';
import { VehicleLoansPanel } from '@/features/loans/components/vehicle-loans-panel';

import { downloadResaleReportPdf } from '../api/download-resale-report';
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
          title="Vehicle Detail"
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
        <div className="border-b border-slate-200/60 bg-white shadow-premium-sm">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Link
                    to="/vehicles"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </Link>
                  <Badge
                    variant="outline"
                    className="bg-slate-50 font-bold uppercase tracking-widest text-[10px]"
                  >
                    Registry entry
                  </Badge>
                  {access.isViewer ? (
                    <Badge
                      className="bg-slate-100 font-bold uppercase tracking-widest text-[10px] text-slate-600"
                      title="You can see this vehicle but not change it. Ask the owner for editor access to make changes."
                      variant="outline"
                    >
                      View only
                    </Badge>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                    {title}
                  </h1>
                  <p className="text-lg font-medium text-slate-500">
                    {describeVehicleModel(vehicle)} <span className="mx-2 text-slate-300">•</span>{' '}
                    {vehicle.year}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <HeroMetric
                    icon={<Gauge className="h-4 w-4" />}
                    label="Odometer"
                    value={`${vehicle.odometer.toLocaleString('en-IN')} km`}
                  />
                  <div className="h-8 w-px bg-slate-100 hidden sm:block" />
                  <HeroMetric
                    icon={<Fuel className="h-4 w-4" />}
                    label="Fuel Type"
                    value={vehicle.fuelType}
                  />
                  <div className="h-8 w-px bg-slate-100 hidden sm:block" />
                  <HeroMetric
                    icon={<CarFront className="h-4 w-4" />}
                    label="Vehicle Type"
                    value={vehicle.vehicleType}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {access.canEdit ? (
                    <>
                      <Link
                        className={cn(buttonVariants({ variant: 'outline' }), 'shadow-premium-sm')}
                        params={{ vehicleId }}
                        to="/vehicles/$vehicleId/edit"
                      >
                        Edit Vehicle
                      </Link>
                      <div className="h-10 w-px bg-slate-200/60 hidden sm:block" />
                      <Link
                        className={cn(
                          buttonVariants({ variant: 'default' }),
                          'shadow-premium-sm bg-primary',
                        )}
                        params={{ vehicleId }}
                        to="/vehicles/$vehicleId/maintenance/new"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Log Maintenance
                      </Link>
                      <Link
                        className={cn(
                          buttonVariants({ variant: 'secondary' }),
                          'shadow-premium-sm',
                        )}
                        params={{ vehicleId }}
                        to="/vehicles/$vehicleId/reminders/new"
                      >
                        Add Reminder
                      </Link>
                    </>
                  ) : null}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label="More vehicle actions"
                        className="shadow-premium-sm"
                        size="icon"
                        variant="outline"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-56 rounded-xl shadow-premium-lg border-slate-200/60"
                    >
                      <DropdownMenuItem asChild>
                        <Link
                          params={{ vehicleId }}
                          className="w-full cursor-pointer"
                          to="/vehicles/$vehicleId/maintenance"
                        >
                          View Full History
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          params={{ vehicleId }}
                          className="w-full cursor-pointer"
                          to="/vehicles/$vehicleId/reminders"
                        >
                          Manage All Reminders
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
                        Download Service History (PDF)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onSelect={async (event) => {
                          event.preventDefault();
                          const vehicle = vehicleQuery.data;
                          if (!vehicle) return;
                          const input = window.prompt(
                            'Optional asking price (₹). Leave blank to omit.',
                            '',
                          );
                          if (input === null) return;
                          const trimmed = input.trim();
                          const askingPrice = trimmed === '' ? undefined : Number(trimmed);
                          if (
                            askingPrice != null &&
                            (!Number.isFinite(askingPrice) || askingPrice < 0)
                          ) {
                            appToast.error({
                              title: 'Invalid asking price',
                              description: 'Enter a positive number or leave blank.',
                            });
                            return;
                          }
                          try {
                            await downloadResaleReportPdf(
                              vehicle.id,
                              vehicle.registrationNumber,
                              askingPrice,
                            );
                            appToast.success({
                              title: 'Resale report downloaded',
                              description: 'Buyer-facing PDF saved.',
                            });
                          } catch (error) {
                            appToast.error({
                              title: 'Could not generate report',
                              description: getApiErrorMessage(error),
                            });
                          }
                        }}
                      >
                        Download Resale Report (PDF)
                      </DropdownMenuItem>
                      {isOwner ? <DropdownMenuSeparator /> : null}
                      {isOwner ? (
                        <DropdownMenuItem
                          className="text-rose-600 focus:bg-rose-50 focus:text-rose-700 cursor-pointer"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <ConfirmActionDialog
                            confirmLabel="Delete vehicle"
                            description="This removes the vehicle, its maintenance history, reminders, and attachment details. This can't be undone."
                            isPending={deleteVehicleMutation.isPending}
                            onConfirm={handleDeleteVehicle}
                            title="Delete this vehicle?"
                            triggerLabel="Delete Vehicle Permanently"
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
              className="relative inline-flex h-auto min-h-11 max-w-full items-center justify-start overflow-x-auto overscroll-x-contain rounded-xl bg-slate-100/80 p-1 shadow-inner [scrollbar-width:thin]"
              ref={tabListRef}
            >
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-premium-sm transition-all"
                value="overview"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-premium-sm transition-all"
                value="maintenance"
              >
                Service Log
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-premium-sm transition-all"
                value="specs"
              >
                Tech Specs
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-premium-sm transition-all"
                value="reminders"
              >
                Reminders
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-premium-sm transition-all"
                value="fuel"
              >
                Fuel
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-premium-sm transition-all"
                value="tyres"
              >
                Tyres
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-premium-sm transition-all"
                value="accessories"
              >
                Accessories
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-premium-sm transition-all"
                value="protection"
              >
                Protection
              </TabsTrigger>
              {isOwner ? (
                <TabsTrigger
                  className="rounded-lg px-6 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-premium-sm transition-all"
                  value="loans"
                >
                  Loans
                </TabsTrigger>
              ) : null}
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-premium-sm transition-all"
                value="members"
              >
                Members
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg px-6 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-premium-sm transition-all"
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
                  label="Total Records"
                  value={maintenanceQuery.isSuccess ? String(maintenanceQuery.data.length) : '...'}
                />
                <SnapshotMetric
                  label="Active Reminders"
                  value={remindersQuery.isSuccess ? String(activeReminders.length) : '...'}
                />
                <SnapshotMetric
                  label="Official Odometer"
                  value={`${vehicle.odometer.toLocaleString('en-IN')} km`}
                />
                <SnapshotMetric label="Engine Type" value={vehicle.fuelType} />
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
                <Card className="h-fit border-slate-200/60 bg-white/70 shadow-premium-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Vehicle Health</CardTitle>
                    <CardDescription>Maintain a perfect digital service record.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-[13px] leading-relaxed text-slate-500">
                    <div className="flex gap-3">
                      <div className="mt-1 flex-shrink-0 text-primary">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <p>
                        Log each visit or repair with the odometer so the timeline stays accurate.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="mt-1 flex-shrink-0 text-primary">
                        <Plus className="h-4 w-4" />
                      </div>
                      <p>Open a service entry to attach receipts, invoices, or photos.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="mt-1 flex-shrink-0 text-primary">
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
                <Card className="h-fit border-slate-200/60 bg-white/70 shadow-premium-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Preventative Care</CardTitle>
                    <CardDescription>Stay ahead of maintenance tasks.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-[13px] leading-relaxed text-slate-500">
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
                  <Card className="h-fit border-slate-200/60 bg-white/70 shadow-premium-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold">
                        Getting an accurate figure
                      </CardTitle>
                      <CardDescription>Economy is measured between fill-ups.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-[13px] leading-relaxed text-slate-500">
                      <div className="flex gap-3">
                        <div className="mt-1 flex-shrink-0 text-primary">
                          <Fuel className="h-4 w-4" />
                        </div>
                        <p>
                          Log every fill-up to see how your driving habits affect your fuel economy.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <div className="mt-1 flex-shrink-0 text-primary">
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
              <Card className="border-slate-200/60 bg-white shadow-premium-sm">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg font-bold">Activity log</CardTitle>
                  <CardDescription>
                    Every change to this vehicle and its records, newest first. Click an entry to
                    see what changed.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  <AuditFeed
                    query={auditQuery}
                    emptyDescription="Changes to this vehicle and its maintenance, reminders, fuel, and documents will show up here."
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
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-400 shadow-inner">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-sm font-bold tabular-nums text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50 hover:shadow-inner">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black tracking-tight text-slate-900 tabular-nums">{value}</p>
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
  title = 'Recent maintenance',
  visibleCount = 3,
}: MaintenancePanelProps) {
  const { canEdit } = useVehicleAccess();
  const records =
    visibleCount === undefined
      ? (maintenanceQuery.data ?? [])
      : (maintenanceQuery.data ?? []).slice(0, visibleCount);

  return (
    <Card className="border-slate-200/60 bg-white shadow-premium-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <CardTitle className="text-lg font-bold">{title}</CardTitle>
          <CardDescription>Service history records.</CardDescription>
        </div>
        <div className="flex gap-2">
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
        </div>
      </CardHeader>
      <CardContent className="pt-5 sm:p-5">
        {maintenanceQuery.isPending ? (
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-slate-50 rounded-xl" />
            <div className="h-20 bg-slate-50 rounded-xl" />
          </div>
        ) : maintenanceQuery.isError ? (
          <EmptyState
            description="Service history couldn't be loaded right now."
            title="Unable to load maintenance"
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
            description="No service entries logged yet."
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
    <Card className="border-slate-200/60 bg-white shadow-premium-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <CardTitle className="text-lg font-bold">{title}</CardTitle>
          <CardDescription>Active maintenance alerts.</CardDescription>
        </div>
        <div className="flex gap-2">
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
        </div>
      </CardHeader>
      <CardContent className="pt-5 sm:p-5">
        {remindersQuery.isPending ? (
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-slate-50 rounded-xl" />
            <div className="h-20 bg-slate-50 rounded-xl" />
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
            title="Clear list"
          />
        )}
      </CardContent>
    </Card>
  );
}
