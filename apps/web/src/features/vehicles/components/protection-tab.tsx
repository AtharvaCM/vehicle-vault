import { ShieldCheck, Plus, Car } from 'lucide-react';
import { useInsurancePolicies } from '../hooks/use-insurance';
import { useWarranties } from '../hooks/use-warranty';
import { InsuranceCard } from './insurance-card';
import { WarrantyCard } from './warranty-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingState } from '@/components/shared/loading-state';
import { useState } from 'react';
import { InsuranceFormDialog } from './insurance-form-dialog';
import { WarrantyFormDialog } from './warranty-form-dialog';

interface ProtectionTabProps {
  vehicleId: string;
}

export function ProtectionTab({ vehicleId }: ProtectionTabProps) {
  const insuranceQuery = useInsurancePolicies(vehicleId);
  const warrantyQuery = useWarranties(vehicleId);
  
  const [isInsuranceDialogOpen, setIsInsuranceDialogOpen] = useState(false);
  const [isWarrantyDialogOpen, setIsWarrantyDialogOpen] = useState(false);

  if (insuranceQuery.isPending || warrantyQuery.isPending) {
    return <LoadingState title="Loading protection details" description="Checking policy and warranty status..." />;
  }

  const policies = insuranceQuery.data || [];
  const warranties = warrantyQuery.data || [];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
      <div className="space-y-8">
        {/* Insurance Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold text-slate-900">Insurance Policies</h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsInsuranceDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Policy
            </Button>
          </div>

          <div className="grid gap-4">
            {policies.length > 0 ? (
              policies.map((policy) => (
                <InsuranceCard key={policy.id} policy={policy} vehicleId={vehicleId} />
              ))
            ) : (
              <EmptyState 
                title="No insurance policies" 
                description="Keep your motor insurance details handy for renewals and claims."
                action={
                  <Button variant="secondary" onClick={() => setIsInsuranceDialogOpen(true)}>
                    Register first policy
                  </Button>
                }
              />
            )}
          </div>
        </section>

        {/* Warranty Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold text-slate-900">Warranty Coverage</h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsWarrantyDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Warranty
            </Button>
          </div>

          <div className="grid gap-4">
            {warranties.length > 0 ? (
              warranties.map((warranty) => (
                <WarrantyCard key={warranty.id} warranty={warranty} vehicleId={vehicleId} />
              ))
            ) : (
              <EmptyState 
                title="No warranty info" 
                description="Track your manufacturer or extended warranty coverage."
                action={
                  <Button variant="secondary" onClick={() => setIsWarrantyDialogOpen(true)}>
                    Add warranty details
                  </Button>
                }
              />
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-6">
         <Card className="border-slate-200/60 bg-white/70 shadow-premium-sm sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Document Guide</CardTitle>
              <CardDescription>Managing your vehicle protection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-[13px] leading-relaxed text-slate-500">
               <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <p className="font-bold text-primary mb-1">Insurance</p>
                  <p>In India, Third Party insurance is mandatory. Comprehensive covers own damage. Keep your policy PDF in the attachments.</p>
               </div>
               <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="font-bold text-slate-700 mb-1">Warranty</p>
                  <p>Warranties often have date AND odometer limits. We track whichever comes first to keep you informed.</p>
               </div>
            </CardContent>
         </Card>
      </aside>

      <InsuranceFormDialog 
        isOpen={isInsuranceDialogOpen} 
        onClose={() => setIsInsuranceDialogOpen(false)} 
        vehicleId={vehicleId}
      />
      <WarrantyFormDialog 
        isOpen={isWarrantyDialogOpen} 
        onClose={() => setIsWarrantyDialogOpen(false)} 
        vehicleId={vehicleId}
      />
    </div>
  );
}
