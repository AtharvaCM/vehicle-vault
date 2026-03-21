import { Download, ScanSearch, ShieldCheck } from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { InlineError } from '@/components/shared/inline-error';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { useDownloadAccountExport } from '../hooks/use-download-account-export';
import { useReconcileAttachments } from '../hooks/use-reconcile-attachments';

export function SettingsPage() {
  const auth = useAuth();
  const exportMutation = useDownloadAccountExport();
  const reconcileMutation = useReconcileAttachments();

  async function handleExport() {
    try {
      await exportMutation.mutateAsync();
      appToast.success({
        title: 'Export downloaded',
        description: 'Your garage data was downloaded as a JSON backup.',
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to export account data',
        description: getApiErrorMessage(
          error,
          "We couldn't prepare your export. Try again in a moment.",
        ),
      });
    }
  }

  async function handleReconcileAttachments() {
    try {
      const response = await reconcileMutation.mutateAsync();
      const removedCount = response.data.removedMissingMetadataCount;

      appToast.success({
        title: 'Attachment check finished',
        description:
          removedCount > 0
            ? `Removed ${removedCount} stale attachment entr${removedCount === 1 ? 'y' : 'ies'} that no longer exist in storage.`
            : 'All attachment metadata already matched the stored files.',
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to reconcile attachments',
        description: getApiErrorMessage(
          error,
          "We couldn't complete the attachment cleanup check right now.",
        ),
      });
    }
  }

  return (
    <PageContainer>
      <PageTitle
        description="View your account and download a backup of your garage data."
        title="Settings"
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>The account currently signed in to Vehicle Vault.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">{auth.user?.name}</p>
              <p>{auth.user?.email}</p>
            </div>
            <p>Everything in your garage is tied to this account.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data export</CardTitle>
            <CardDescription>
              Download a JSON backup of your vehicles, maintenance history, reminders, receipts,
              and account details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
            <div className="space-y-2">
              <p>Use this export as a backup of your ownership history outside the app.</p>
              <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-slate-50/80 px-3.5 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-slate-500" />
                <p>
                  Only data saved under <span className="font-medium text-slate-900">{auth.user?.email}</span>{' '}
                  is included in this export.
                </p>
              </div>
            </div>
            {exportMutation.isError ? (
              <InlineError
                message={getApiErrorMessage(
                  exportMutation.error,
                  "We couldn't prepare your export. Try again in a moment.",
                )}
              />
            ) : null}
            <Button
              className="w-full justify-center sm:w-auto"
              disabled={exportMutation.isPending}
              onClick={() => {
                void handleExport();
              }}
              type="button"
            >
              <Download className="mr-2 h-4 w-4" />
              {exportMutation.isPending ? 'Preparing export...' : 'Download JSON backup'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>More personal settings will appear here over time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
            <div className="space-y-2">
              <p>Reminder defaults, currency, and date formatting are planned for a future update.</p>
              <p>For now, this page also includes a repair tool for attachment metadata.</p>
            </div>
            <div className="space-y-3 rounded-xl border border-border/70 bg-slate-50/80 p-4">
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">Attachment reconciliation</p>
                <p className="text-sm leading-6 text-slate-600">
                  Scan your attachment records and remove stale metadata if a stored file is no longer available.
                </p>
              </div>
              {reconcileMutation.isError ? (
                <InlineError
                  message={getApiErrorMessage(
                    reconcileMutation.error,
                    "We couldn't complete the attachment cleanup check right now.",
                  )}
                />
              ) : null}
              <Button
                className="w-full justify-center sm:w-auto"
                disabled={reconcileMutation.isPending}
                onClick={() => {
                  void handleReconcileAttachments();
                }}
                type="button"
                variant="outline"
              >
                <ScanSearch className="mr-2 h-4 w-4" />
                {reconcileMutation.isPending ? 'Checking attachments...' : 'Reconcile attachments'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
