import { Link } from '@tanstack/react-router';
import { ChevronRight, ClipboardList } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import type { MaintenanceRecord } from '../types/maintenance-record';
import { formatMaintenanceCategory } from '../utils/format-maintenance-category';

type MaintenanceRecordCardProps = {
  record: MaintenanceRecord;
  selectionControl?: ReactNode;
  vehicleLabel?: string;
};

export function MaintenanceRecordCard({
  record,
  selectionControl,
  vehicleLabel,
}: MaintenanceRecordCardProps) {
  return (
    <div className="group relative flex items-center gap-4">
      {selectionControl ? (
        <div className="flex-shrink-0">
          {selectionControl}
        </div>
      ) : null}
      
      <Card className="flex-1 overflow-hidden border-slate-200/60 bg-white/70 shadow-premium-sm transition-all duration-300 hover:border-primary/20 hover:bg-white hover:shadow-premium-md">
        <Link 
          className="flex flex-col p-0 md:flex-row md:items-center" 
          params={{ recordId: record.id }} 
          to="/maintenance-records/$recordId"
        >
          {/* Main Content */}
          <div className="flex flex-1 items-center gap-4 p-4 sm:p-5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <ClipboardList className="h-5 w-5" />
            </div>
            
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-bold text-slate-900 group-hover:text-primary transition-colors">
                  {record.workshopName?.trim() || 'Direct Service / DIY'}
                </p>
                <Badge variant="outline" className="bg-white text-[10px] font-bold uppercase tracking-widest">{formatMaintenanceCategory(record.category)}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-slate-500">
                {vehicleLabel ? <span>{vehicleLabel}</span> : null}
                {vehicleLabel ? <span className="text-slate-300">•</span> : null}
                <span>{formatDate(record.serviceDate)}</span>
              </div>
            </div>
          </div>

          {/* Metrics & Action */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 p-4 md:border-l md:border-t-0 md:bg-transparent md:px-6 md:py-0">
            <div className="flex items-center gap-8 md:gap-12">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Odometer</p>
                <p className="text-[13px] font-semibold tabular-nums text-slate-700">{record.odometer.toLocaleString('en-IN')} km</p>
              </div>
              
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Cost</p>
                <p className="text-[13px] font-bold tabular-nums text-primary">{formatCurrency(record.totalCost)}</p>
              </div>
            </div>

            <div className="ml-4 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-300 shadow-premium-sm transition-all group-hover:translate-x-1 group-hover:text-primary">
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </Link>
      </Card>
    </div>
  );
}
