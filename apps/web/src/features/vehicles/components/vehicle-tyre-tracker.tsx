import { useMemo } from 'react';
import { RotateCw, Settings2, ShieldCheck, AlertCircle } from 'lucide-react';
import {
  MaintenanceCategory,
  type MaintenanceRecord,
  type Vehicle,
} from '@vehicle-vault/shared';
import { formatDistanceToNow } from 'date-fns';
import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

import type { useMaintenanceRecords } from '../../maintenance/hooks/use-maintenance-records';

type TyreStatus = 'healthy' | 'due' | 'overdue';
type TyrePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const TYRE_CATEGORIES: MaintenanceCategory[] = [
  MaintenanceCategory.TyreRotation,
  MaintenanceCategory.WheelAlignment,
  MaintenanceCategory.TyreReplacement,
];

interface VehicleTyreTrackerProps {
  vehicle: Vehicle | null;
  maintenanceQuery: ReturnType<typeof useMaintenanceRecords>;
}

export function VehicleTyreTracker({ vehicle, maintenanceQuery }: VehicleTyreTrackerProps) {
  const records = useMemo<MaintenanceRecord[]>(
    () => maintenanceQuery.data ?? [],
    [maintenanceQuery.data],
  );

  const vehicleOdometer = vehicle?.odometer ?? 0;

  const tyreData = useMemo(() => {
    const lastRotation = records.find((r) => r.category === MaintenanceCategory.TyreRotation);
    const lastAlignment = records.find((r) => r.category === MaintenanceCategory.WheelAlignment);
    const lastReplacement = records.find(
      (r) => r.category === MaintenanceCategory.TyreReplacement,
    );

    const kmSinceRotation = lastRotation
      ? vehicleOdometer - lastRotation.odometer
      : vehicleOdometer;
    const kmSinceAlignment = lastAlignment
      ? vehicleOdometer - lastAlignment.odometer
      : vehicleOdometer;

    // Thresholds: Rotation every 10k, Alignment every 5k
    const rotationStatus: TyreStatus =
      kmSinceRotation > 10000 ? 'overdue' : kmSinceRotation > 8000 ? 'due' : 'healthy';
    const alignmentStatus: TyreStatus =
      kmSinceAlignment > 5000 ? 'overdue' : kmSinceAlignment > 4000 ? 'due' : 'healthy';

    return {
      lastRotation,
      lastAlignment,
      lastReplacement,
      kmSinceRotation,
      kmSinceAlignment,
      rotationStatus,
      alignmentStatus,
    };
  }, [records, vehicleOdometer]);

  const tyreRecords = useMemo(
    () => records.filter((r) => TYRE_CATEGORIES.includes(r.category as MaintenanceCategory)),
    [records],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
      <div className="space-y-6">
        <Card className="border-slate-200/60 bg-white shadow-premium-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Wheel & Tyre Geometry</CardTitle>
                <CardDescription>Visual health overview of your vehicle&apos;s footprint.</CardDescription>
              </div>
              <Badge variant="outline" className="bg-white font-bold tracking-tight uppercase text-[10px]">
                Active Monitoring
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-12">
             <div className="relative mx-auto w-full max-w-[200px] aspect-[1/2] border-2 border-slate-200 rounded-[40px] bg-slate-50/30 flex items-center justify-center">
                {/* Horizontal Axles */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[120%] h-1 bg-slate-200" />
                <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[120%] h-1 bg-slate-200" />

                {/* Tyres */}
                <TyreComponent position="top-left" status={tyreData.alignmentStatus} />
                <TyreComponent position="top-right" status={tyreData.alignmentStatus} />
                <TyreComponent position="bottom-left" status={tyreData.rotationStatus} />
                <TyreComponent position="bottom-right" status={tyreData.rotationStatus} />

                {/* Chassis Decoration */}
                <div className="w-1/2 h-2/3 border border-slate-200/50 rounded-2xl flex items-center justify-center">
                   <div className="text-[10px] font-black text-slate-300 uppercase rotate-90">Chassis</div>
                </div>
             </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              icon={<RotateCw className="h-4 w-4" />}
              label="Tyre Rotation"
              value={`${tyreData.kmSinceRotation.toLocaleString()} km`}
              subValue="since last rotation"
              status={tyreData.rotationStatus}
              lastDate={tyreData.lastRotation?.serviceDate}
            />
            <StatCard
              icon={<Settings2 className="h-4 w-4" />}
              label="Wheel Alignment"
              value={`${tyreData.kmSinceAlignment.toLocaleString()} km`}
              subValue="since last alignment"
              status={tyreData.alignmentStatus}
              lastDate={tyreData.lastAlignment?.serviceDate}
            />
        </div>
      </div>

      <div className="space-y-6">
        <Card className="border-slate-200/60 bg-white shadow-premium-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Tyre Records</CardTitle>
            <CardDescription>Recent wheel related service history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {tyreRecords.slice(0, 5).map((record) => (
               <div key={record.id} className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <div className="space-y-1">
                     <p className="text-xs font-bold uppercase tracking-tight text-slate-900">
                        {record.category.replace('_', ' ')}
                     </p>
                     <p className="text-[10px] text-slate-500">
                        {new Date(record.serviceDate).toLocaleDateString()} • {record.odometer.toLocaleString()} km
                     </p>
                  </div>
               </div>
             ))}
             {tyreRecords.length === 0 && (
               <p className="text-xs text-slate-400 italic text-center py-4">No tyre records found.</p>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface TyreComponentProps {
  position: TyrePosition;
  status: TyreStatus;
}

function TyreComponent({ position, status }: TyreComponentProps) {
  const baseClasses = "absolute w-12 h-20 bg-slate-900 rounded-lg shadow-premium-md flex flex-col items-center justify-center gap-0.5 overflow-hidden border-2";
  const posClasses = {
    'top-left': '-top-4 -left-10',
    'top-right': '-top-4 -right-10',
    'bottom-left': '-bottom-4 -left-10',
    'bottom-right': '-bottom-4 -right-10',
  }[position];

  const statusClasses = {
    healthy: 'border-emerald-500/50',
    due: 'border-orange-500/50',
    overdue: 'border-rose-500/50',
  }[status];

  return (
    <div className={cn(baseClasses, posClasses, statusClasses)}>
       {/* Tread Pattern Mockup */}
       {[...Array(6)].map((_, i) => (
         <div key={i} className="w-full h-px bg-slate-800" />
       ))}
       {status === 'overdue' && <AlertCircle className="h-3 w-3 text-rose-500 absolute" />}
       {status === 'healthy' && <ShieldCheck className="h-3 w-3 text-emerald-500 absolute" />}
    </div>
  );
}

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  subValue: string;
  status: TyreStatus;
  lastDate?: Date | string | null;
}

function StatCard({ icon, label, value, subValue, status, lastDate }: StatCardProps) {
  const statusColor = status === 'overdue' ? 'bg-rose-50 border-rose-100' : status === 'due' ? 'bg-orange-50 border-orange-100' : 'bg-emerald-50 border-emerald-100';
  const iconColor = status === 'overdue' ? 'text-rose-600' : status === 'due' ? 'text-orange-600' : 'text-emerald-600';

  return (
    <div className={cn("rounded-2xl border p-5 transition-all shadow-premium-sm", statusColor)}>
      <div className="flex items-center justify-between mb-3">
        <div className={cn("p-2 rounded-xl bg-white shadow-sm", iconColor)}>
          {icon}
        </div>
        <Badge variant="outline" className="bg-white text-[9px] font-black uppercase tracking-wider">
          {status}
        </Badge>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-black tracking-tighter text-slate-900">{value}</p>
        <p className="text-[11px] font-medium text-slate-500 mt-1">{subValue}</p>
        {lastDate && (
          <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">
            Last: {formatDistanceToNow(new Date(lastDate))} ago
          </p>
        )}
      </div>
    </div>
  );
}
