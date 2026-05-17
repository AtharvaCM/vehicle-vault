import { Calendar, Gauge, Pencil, Trash2, Shield } from 'lucide-react';
import { format, isBefore, addDays } from 'date-fns';
import { type VehicleDocument } from '@vehicle-vault/shared';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDeleteVehicleDocument } from '../hooks/use-documents';
import { appToast } from '@/lib/toast';

interface DocumentCardProps {
  document: VehicleDocument;
  vehicleId: string;
  onEdit?: (document: VehicleDocument) => void;
}

export function DocumentCard({ document, vehicleId, onEdit }: DocumentCardProps) {
  const deleteMutation = useDeleteVehicleDocument(vehicleId);

  const isExpired = document.endDate ? isBefore(new Date(document.endDate), new Date()) : false;
  const isExpiringSoon = document.endDate && !isExpired ? isBefore(new Date(document.endDate), addDays(new Date(), 30)) : false;

  async function handleDelete() {
    if (confirm(`Are you sure you want to delete this ${document.kind} record?`)) {
      try {
        await deleteMutation.mutateAsync({ id: document.id, kind: document.kind });
        appToast.success({ title: `${document.kind === 'insurance' ? 'Policy' : 'Warranty'} removed`, description: 'History updated.' });
      } catch {
        appToast.error({ title: 'Delete failed', description: 'Failed to remove record.' });
      }
    }
  }

  if (document.kind === 'insurance') {
    return (
      <Card className="border-slate-200/60 bg-white shadow-premium-sm overflow-hidden hover:border-primary/20 transition-all">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="flex-[1.5] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Provider & Policy</p>
                  <h4 className="font-black text-slate-900 leading-tight">{document.provider}</h4>
                  <p className="text-xs font-bold text-slate-500 tabular-nums">#{document.number}</p>
                </div>
                <Badge 
                  variant={isExpired ? 'destructive' : isExpiringSoon ? 'secondary' : 'outline'}
                  className={isExpired ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-50' : isExpiringSoon ? 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-50' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50' }
                >
                  {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring Soon' : 'Active'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                 <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                       <Calendar className="h-3 w-3" />
                       Valid From
                    </div>
                    <p className="text-sm font-bold text-slate-700">{format(new Date(document.startDate), 'dd MMM yyyy')}</p>
                 </div>
                 <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                       <Calendar className="h-3 w-3" />
                       Valid Till
                    </div>
                    <p className="text-sm font-bold text-slate-700">{document.endDate ? format(new Date(document.endDate), 'dd MMM yyyy') : 'No Date Limit'}</p>
                 </div>
              </div>
            </div>

            <div className="flex-1 bg-slate-50 border-l border-slate-100 p-5 flex flex-col justify-between">
               <div className="space-y-3">
                  {typeof document.details?.premiumAmount === 'number' && (
                     <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Premium Paid</p>
                        <p className="text-lg font-black tracking-tight text-slate-900">₹{document.details.premiumAmount.toLocaleString('en-IN')}</p>
                     </div>
                  )}
                  {typeof document.details?.insuredValue === 'number' && (
                     <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Insured Declared Value (IDV)</p>
                        <p className="text-sm font-bold text-slate-600">₹{document.details.insuredValue.toLocaleString('en-IN')}</p>
                     </div>
                  )}
               </div>

               <div className="flex items-center justify-end gap-2 pt-4">
                  {onEdit && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-400 hover:text-primary rounded-full"
                      onClick={() => onEdit(document)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
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

  // Warranty kind
  return (
    <Card className="border-slate-200/60 bg-white shadow-premium-sm overflow-hidden hover:border-primary/20 transition-all">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex-[1.5] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{document.details?.type as string || 'Warranty'}</p>
                <h4 className="font-black text-slate-900 leading-tight">{document.provider}</h4>
                {document.number && <p className="text-xs font-bold text-slate-500 tabular-nums">#{document.number}</p>}
              </div>
              <Badge 
                variant={isExpired ? 'destructive' : 'outline'}
                className={isExpired ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-50' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-50'}
              >
                {isExpired ? 'Expired' : 'In Force'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
               <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                     <Calendar className="h-3 w-3" />
                     Coverage Start
                  </div>
                  <p className="text-sm font-bold text-slate-700">{format(new Date(document.startDate), 'dd MMM yyyy')}</p>
               </div>
               <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                     <Shield className="h-3 w-3" />
                     Coverage End
                  </div>
                  <p className="text-sm font-bold text-slate-700">{document.endDate ? format(new Date(document.endDate), 'dd MMM yyyy') : 'No Date Limit'}</p>
               </div>
            </div>
          </div>

          <div className="flex-1 bg-slate-50 border-l border-slate-100 p-5 flex flex-col justify-between">
             <div className="space-y-3">
                {typeof document.details?.endOdometer === 'number' && (
                   <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Odometer Limit</p>
                      <div className="flex items-center gap-2">
                         <Gauge className="h-4 w-4 text-slate-400" />
                         <p className="text-lg font-black tracking-tight text-slate-900">{document.details.endOdometer.toLocaleString()}</p>
                         <span className="text-[10px] font-bold text-slate-400 uppercase">km</span>
                      </div>
                   </div>
                )}
             </div>

             <div className="flex items-center justify-end gap-2 pt-4">
                {onEdit && (
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-slate-400 hover:text-primary rounded-full"
                    onClick={() => onEdit(document)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
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
