import { Calendar, Gauge, Trash2, Shield } from 'lucide-react';
import { format, isBefore } from 'date-fns';
import { type Warranty } from '@vehicle-vault/shared';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDeleteWarranty } from '../hooks/use-warranty';
import { appToast } from '@/lib/toast';

interface WarrantyCardProps {
  warranty: Warranty;
  vehicleId: string;
}

export function WarrantyCard({ warranty, vehicleId }: WarrantyCardProps) {
  const deleteMutation = useDeleteWarranty(vehicleId);

  const isExpiredByDate = warranty.endDate ? isBefore(new Date(warranty.endDate), new Date()) : false;
  // Odometer check would need current vehicle odometer, passed from parent if needed
  // For now, focus on date

  async function handleDelete() {
    if (confirm('Are you sure you want to delete this warranty record?')) {
      try {
        await deleteMutation.mutateAsync(warranty.id);
        appToast.success({ title: 'Warranty removed', description: 'Warranty history updated.' });
      } catch (error) {
        appToast.error({ title: 'Delete failed', description: 'Failed to remove warranty record.' });
      }
    }
  }

  return (
    <Card className="border-slate-200/60 bg-white shadow-premium-sm overflow-hidden hover:border-primary/20 transition-all">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex-[1.5] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{warranty.type} Warranty</p>
                <h4 className="font-black text-slate-900 leading-tight">{warranty.provider}</h4>
                {warranty.warrantyNumber && <p className="text-xs font-bold text-slate-500 tabular-nums">#{warranty.warrantyNumber}</p>}
              </div>
              <Badge 
                variant={isExpiredByDate ? 'destructive' : 'outline'}
                className={isExpiredByDate ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-50' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-50'}
              >
                {isExpiredByDate ? 'Expired' : 'In Force'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
               <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                     <Calendar className="h-3 w-3" />
                     Coverage Start
                  </div>
                  <p className="text-sm font-bold text-slate-700">{format(new Date(warranty.startDate), 'dd MMM yyyy')}</p>
               </div>
               <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                     <Shield className="h-3 w-3" />
                     Coverage End
                  </div>
                  <p className="text-sm font-bold text-slate-700">{warranty.endDate ? format(new Date(warranty.endDate), 'dd MMM yyyy') : 'No Date Limit'}</p>
               </div>
            </div>
          </div>

          <div className="flex-1 bg-slate-50 border-l border-slate-100 p-5 flex flex-col justify-between">
             <div className="space-y-3">
                {warranty.endOdometer && (
                   <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Odometer Limit</p>
                      <div className="flex items-center gap-2">
                         <Gauge className="h-4 w-4 text-slate-400" />
                         <p className="text-lg font-black tracking-tight text-slate-900">{warranty.endOdometer.toLocaleString()}</p>
                         <span className="text-[10px] font-bold text-slate-400 uppercase">km</span>
                      </div>
                   </div>
                )}
             </div>

             <div className="flex items-center justify-end gap-2 pt-4">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-full"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                 >
                   <Trash2 className="h-4 w-4" />
                </Button>
             </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
