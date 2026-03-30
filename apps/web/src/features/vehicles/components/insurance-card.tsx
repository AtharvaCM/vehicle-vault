import { Calendar, CreditCard, ShieldCheck, Trash2 } from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { type InsurancePolicy } from '@vehicle-vault/shared';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDeleteInsurancePolicy } from '../hooks/use-insurance';
import { appToast } from '@/lib/toast';

interface InsuranceCardProps {
  policy: InsurancePolicy;
  vehicleId: string;
}

export function InsuranceCard({ policy, vehicleId }: InsuranceCardProps) {
  const deleteMutation = useDeleteInsurancePolicy(vehicleId);

  const isExpired = isBefore(new Date(policy.endDate), new Date());
  const isExpiringSoon = !isExpired && isBefore(new Date(policy.endDate), addDays(new Date(), 30));

  async function handleDelete() {
    if (confirm('Are you sure you want to delete this insurance policy?')) {
      try {
        await deleteMutation.mutateAsync(policy.id);
        appToast.success({ title: 'Policy removed', description: 'Insurance history updated.' });
      } catch (error) {
        appToast.error({ title: 'Delete failed', description: 'Failed to remove insurance record.' });
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
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Provider & Policy</p>
                <h4 className="font-black text-slate-900 leading-tight">{policy.provider}</h4>
                <p className="text-xs font-bold text-slate-500 tabular-nums">#{policy.policyNumber}</p>
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
                  <p className="text-sm font-bold text-slate-700">{format(new Date(policy.startDate), 'dd MMM yyyy')}</p>
               </div>
               <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                     <Calendar className="h-3 w-3" />
                     Valid Till
                  </div>
                  <p className="text-sm font-bold text-slate-700">{format(new Date(policy.endDate), 'dd MMM yyyy')}</p>
               </div>
            </div>
          </div>

          <div className="flex-1 bg-slate-50 border-l border-slate-100 p-5 flex flex-col justify-between">
             <div className="space-y-3">
                {policy.premiumAmount && (
                   <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Premium Paid</p>
                      <p className="text-lg font-black tracking-tight text-slate-900">₹{policy.premiumAmount.toLocaleString('en-IN')}</p>
                   </div>
                )}
                {policy.insuredValue && (
                   <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Insured Declared Value (IDV)</p>
                      <p className="text-sm font-bold text-slate-600">₹{policy.insuredValue.toLocaleString('en-IN')}</p>
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
