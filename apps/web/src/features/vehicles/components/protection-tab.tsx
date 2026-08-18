import { ShieldCheck, Plus, Car, ReceiptText, Scan, Loader2, FileBadge } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { forwardRef, useRef, useState } from 'react';
import { useVehicleDocuments } from '../../vehicle-documents/hooks/use-documents';
import { DocumentCard } from '../../vehicle-documents/components/document-card';
import {
  useScanStatusQuery,
  useScanVehicleDocument,
} from '../../vehicle-documents/hooks/use-scan-document';
import { ClaimCard } from '../../claims/components/claim-card';
import { ClaimFormDialog } from '../../claims/components/claim-form-dialog';
import { useVehicleClaims } from '../../claims/hooks/use-claims';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { DocumentFormDialog } from '../../vehicle-documents/components/document-form-dialog';
import {
  documentKindNouns,
  documentKindTitles,
  isComplianceKind,
} from '../../vehicle-documents/utils/document-kind-labels';
import {
  complianceDocumentKinds,
  type Claim,
  type VehicleDocument,
  type VehicleDocumentExtractionDraft,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

type ScanButtonProps = {
  available: boolean | undefined;
  isScanning: boolean;
  label: string;
  onClick?: () => void;
};

/**
 * The dot on the icon reports whether extraction is configured server-side, so
 * a user who clicks and gets nothing knows it is the backend, not their file.
 * Forwards its ref so it can be a DropdownMenu trigger.
 */
const ScanButton = forwardRef<HTMLButtonElement, ScanButtonProps>(function ScanButton(
  { available, isScanning, label, onClick, ...triggerProps },
  ref,
) {
  return (
    <Button
      ref={ref}
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={isScanning}
      title={available ? 'AI Ready' : 'AI Plugin Missing'}
      {...triggerProps}
    >
      {isScanning ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <span className="relative mr-2 inline-flex">
          <Scan className="h-4 w-4" />
          <span
            className={`absolute -top-1 -right-1 h-2 w-2 rounded-full border border-white dark:border-zinc-950 ${available ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-400'}`}
          />
        </span>
      )}
      {isScanning ? 'Analyzing…' : label}
    </Button>
  );
});

interface ProtectionTabProps {
  vehicleId: string;
}

export function ProtectionTab({ vehicleId }: ProtectionTabProps) {
  const documentsQuery = useVehicleDocuments(vehicleId);
  const claimsQuery = useVehicleClaims(vehicleId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [defaultKind, setDefaultKind] = useState<VehicleDocumentKind>('insurance');
  const [editingDocument, setEditingDocument] = useState<VehicleDocument | null>(null);
  const [scannedDraft, setScannedDraft] = useState<VehicleDocumentExtractionDraft | null>(null);
  // Which kind the file picker is currently collecting a scan for. The endpoint
  // needs it up front so the prompt can narrow to that document type.
  const [scanKind, setScanKind] = useState<VehicleDocumentKind>('insurance');

  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const scanMutation = useScanVehicleDocument();
  const insuranceScanStatus = useQuery(useScanStatusQuery(vehicleId, 'insurance'));
  const warrantyScanStatus = useQuery(useScanStatusQuery(vehicleId, 'warranty'));
  const complianceScanStatus = useQuery(useScanStatusQuery(vehicleId, 'registration'));

  if (documentsQuery.isPending) {
    return <LoadingState title="Loading protection details" description="Checking policy and warranty status..." />;
  }

  // Without this branch a failed request falls through to `|| []`, and the tab
  // reports "no insurance policies" to someone whose policies simply failed to
  // load — the same reassuring empty state a brand-new vehicle shows.
  if (documentsQuery.isError) {
    return (
      <ErrorState
        action={
          <Button onClick={() => documentsQuery.refetch()} variant="secondary">
            Retry
          </Button>
        }
        description={getApiErrorMessage(
          documentsQuery.error,
          "We couldn't load this vehicle's documents. Your policies and warranties are safe — this is a display problem.",
        )}
        title="Unable to load protection details"
      />
    );
  }

  const allDocuments = documentsQuery.data || [];
  const policies = allDocuments.filter(d => d.kind === 'insurance');
  const warranties = allDocuments.filter(d => d.kind === 'warranty');
  const complianceDocuments = allDocuments.filter(
    d => d.kind === 'registration' || d.kind === 'puc' || d.kind === 'road_tax',
  );
  const claims = claimsQuery.data || [];

  function openDialog(kind: VehicleDocumentKind) {
    setEditingDocument(null);
    setScannedDraft(null);
    setDefaultKind(kind);
    setIsDialogOpen(true);
  }

  function handleEdit(doc: VehicleDocument) {
    setEditingDocument(doc);
    setScannedDraft(null);
    setDefaultKind(doc.kind);
    setIsDialogOpen(true);
  }

  function handleClose() {
    setEditingDocument(null);
    setScannedDraft(null);
    setIsDialogOpen(false);
  }

  function triggerScan(kind: VehicleDocumentKind, available: boolean | undefined) {
    if (available === false) {
      appToast.error({
        title: 'AI scan unavailable',
        description: 'Set GEMINI_API_KEY in the backend .env to enable document scanning.',
      });
      return;
    }
    setScanKind(kind);
    scanInputRef.current?.click();
  }

  async function handleScanFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const result = await scanMutation.mutateAsync({ vehicleId, kind: scanKind, file });
      setScannedDraft(result.data);
      setEditingDocument(null);
      setDefaultKind(scanKind);
      setIsDialogOpen(true);
      appToast.success({
        title: `${documentKindNouns[scanKind]} scanned`,
        description: 'Review the AI-filled fields and save.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      appToast.error({ title: 'Scan failed', description: message });
    }
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
            <div className="flex items-center gap-2">
              <input
                ref={scanInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleScanFile}
                className="hidden"
              />
              <ScanButton
                available={insuranceScanStatus.data?.available}
                isScanning={scanMutation.isPending && scanKind === 'insurance'}
                label="Scan Policy"
                onClick={() => triggerScan('insurance', insuranceScanStatus.data?.available)}
              />
              <Button size="sm" variant="outline" onClick={() => openDialog('insurance')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Policy
              </Button>
            </div>
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
            ) : claimsQuery.isError ? (
              <ErrorState
                action={
                  <Button onClick={() => claimsQuery.refetch()} variant="secondary">
                    Retry
                  </Button>
                }
                description={getApiErrorMessage(
                  claimsQuery.error,
                  "We couldn't load claims for this vehicle.",
                )}
                title="Unable to load claims"
              />
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
            <div className="flex items-center gap-2">
              <ScanButton
                available={warrantyScanStatus.data?.available}
                isScanning={scanMutation.isPending && scanKind === 'warranty'}
                label="Scan Warranty"
                onClick={() => triggerScan('warranty', warrantyScanStatus.data?.available)}
              />
              <Button size="sm" variant="outline" onClick={() => openDialog('warranty')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Warranty
              </Button>
            </div>
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

        {/* Registration & Compliance Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileBadge className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold text-slate-900">Registration &amp; Compliance</h3>
            </div>
            <div className="flex items-center gap-2">
              {/* Three document types share this section, and the prompt is
                  narrowed per type — so the user picks which one they are
                  scanning rather than the model guessing from the page. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ScanButton
                    available={complianceScanStatus.data?.available}
                    isScanning={scanMutation.isPending && isComplianceKind(scanKind)}
                    label="Scan"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {complianceDocumentKinds.map((kind) => (
                    <DropdownMenuItem
                      key={kind}
                      onClick={() => triggerScan(kind, complianceScanStatus.data?.available)}
                    >
                      {documentKindTitles[kind]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="outline" onClick={() => openDialog('registration')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Document
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {complianceDocuments.length > 0 ? (
              complianceDocuments.map((doc) => (
                <DocumentCard key={doc.id} document={doc} vehicleId={vehicleId} onEdit={handleEdit} />
              ))
            ) : (
              <EmptyState
                title="No compliance documents"
                description="Track your RC, PUC certificate, and road tax to get expiry alerts before renewals are due."
                action={
                  <Button variant="secondary" onClick={() => openDialog('puc')}>
                    Add PUC certificate
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
               <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="font-bold text-slate-700 mb-1">PUC &amp; Road Tax</p>
                  <p>PUC certificates typically last 6–12 months and are mandatory. Road tax is often one-time (lifetime) — leave the end date blank for those.</p>
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
        initialValues={scannedDraft ?? undefined}
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
