import { ShieldCheck, Plus, Car, ReceiptText } from 'lucide-react';
import { useVehicleDocuments } from '../../vehicle-documents/hooks/use-documents';
import { DocumentCard } from '../../vehicle-documents/components/document-card';
import { ClaimCard } from '../../claims/components/claim-card';
import { ClaimFormDialog } from '../../claims/components/claim-form-dialog';
import { useVehicleClaims } from '../../claims/hooks/use-claims';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingState } from '@/components/shared/loading-state';
import { useState } from 'react';
import { DocumentFormDialog } from '../../vehicle-documents/components/document-form-dialog';
import { type Claim, type VehicleDocument, type VehicleDocumentKind } from '@vehicle-vault/shared';

interface ProtectionTabProps {
  vehicleId: string;
}

export function ProtectionTab({ vehicleId }: ProtectionTabProps) {
  const documentsQuery = useVehicleDocuments(vehicleId);
  const claimsQuery = useVehicleClaims(vehicleId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [defaultKind, setDefaultKind] = useState<VehicleDocumentKind>('insurance');
  const [editingDocument, setEditingDocument] = useState<VehicleDocument | null>(null);

  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);

  if (documentsQuery.isPending) {
    return <LoadingState title="Loading protection details" description="Checking policy and warranty status..." />;
  }

  const allDocuments = documentsQuery.data || [];
  const policies = allDocuments.filter(d => d.kind === 'insurance');
  const warranties = allDocuments.filter(d => d.kind === 'warranty');
  const claims = claimsQuery.data || [];

  function openDialog(kind: VehicleDocumentKind) {
    setEditingDocument(null);
    setDefaultKind(kind);
    setIsDialogOpen(true);
  }

  function handleEdit(doc: VehicleDocument) {
    setEditingDocument(doc);
    setDefaultKind(doc.kind);
    setIsDialogOpen(true);
  }

  function handleClose() {
    setEditingDocument(null);
    setIsDialogOpen(false);
  }

  function openClaimDialog() {
    setEditingClaim(null);
    setIsClaimDialogOpen(true);
  }

  function handleClaimEdit(claim: Claim) {
    setEditingClaim(claim);
    setIsClaimDialogOpen(true);
  }

  function handleClaimClose() {
    setEditingClaim(null);
    setIsClaimDialogOpen(false);
  }

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
            <Button size="sm" variant="outline" onClick={() => openDialog('insurance')}>
              <Plus className="mr-2 h-4 w-4" />
              Add Policy
            </Button>
          </div>

          <div className="grid gap-4">
            {policies.length > 0 ? (
              policies.map((policy) => (
                <DocumentCard key={policy.id} document={policy} vehicleId={vehicleId} onEdit={handleEdit} />
              ))
            ) : (
              <EmptyState 
                title="No insurance policies" 
                description="Keep your motor insurance details handy for renewals and claims."
                action={
                  <Button variant="secondary" onClick={() => openDialog('insurance')}>
                    Register first policy
                  </Button>
                }
              />
            )}
          </div>
        </section>

        {/* Claims Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold text-slate-900">Insurance Claims</h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={openClaimDialog}
              disabled={policies.length === 0}
              title={policies.length === 0 ? 'Add an insurance policy first' : undefined}
            >
              <Plus className="mr-2 h-4 w-4" />
              Record Claim
            </Button>
          </div>

          <div className="grid gap-4">
            {claimsQuery.isPending ? (
              <p className="text-xs text-slate-400">Loading claims…</p>
            ) : claims.length > 0 ? (
              claims.map((claim) => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  vehicleId={vehicleId}
                  onEdit={handleClaimEdit}
                />
              ))
            ) : (
              <EmptyState
                title="No claims yet"
                description={
                  policies.length === 0
                    ? 'Add an insurance policy before recording a claim.'
                    : 'Track accident repairs and what your insurer covered.'
                }
                action={
                  policies.length > 0 ? (
                    <Button variant="secondary" onClick={openClaimDialog}>
                      Record first claim
                    </Button>
                  ) : undefined
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
            <Button size="sm" variant="outline" onClick={() => openDialog('warranty')}>
              <Plus className="mr-2 h-4 w-4" />
              Add Warranty
            </Button>
          </div>

          <div className="grid gap-4">
            {warranties.length > 0 ? (
              warranties.map((warranty) => (
                <DocumentCard key={warranty.id} document={warranty} vehicleId={vehicleId} onEdit={handleEdit} />
              ))
            ) : (
              <EmptyState 
                title="No warranty info" 
                description="Track your manufacturer or extended warranty coverage."
                action={
                  <Button variant="secondary" onClick={() => openDialog('warranty')}>
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

      <DocumentFormDialog
        isOpen={isDialogOpen}
        onClose={handleClose}
        vehicleId={vehicleId}
        defaultKind={defaultKind}
        editingDocument={editingDocument}
      />

      <ClaimFormDialog
        isOpen={isClaimDialogOpen}
        onClose={handleClaimClose}
        vehicleId={vehicleId}
        insurancePolicies={policies}
        editingClaim={editingClaim}
      />
    </div>
  );
}
