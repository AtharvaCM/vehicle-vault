import { Download, ShieldCheck } from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { InlineError } from '@/components/shared/inline-error';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { useDownloadAccountExport } from '../hooks/use-download-account-export';

export function SettingsPage() {
  const auth = useAuth();
  const exportMutation = useDownloadAccountExport();

  async function handleExport() {
    try {
      await exportMutation.mutateAsync();
      appToast.success({
        title: 'Export downloaded',
        description:
          'Your account snapshot was downloaded as a JSON file for backup or migration use.',
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to export account data',
        description: getApiErrorMessage(
          error,
          'The export request failed. Please try again after the API is reachable.',
        ),
      });
    }
  }

  return (
    <PageContainer>
      <PageTitle
        description="Review the current account, export owned data, and keep deeper preferences lightweight until concrete workflows demand them."
        title="Settings"
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your current authenticated workspace identity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">{auth.user?.name}</p>
              <p>{auth.user?.email}</p>
            </div>
            <p>
              Vehicles, maintenance records, reminders, and attachments are now scoped to this
              account.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data export</CardTitle>
            <CardDescription>
              Download a user-scoped backup of vehicles, maintenance, reminders, attachments, and
              account details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
            <div className="space-y-2">
              <p>
                The export is delivered as a JSON snapshot so you can retain an ownership history
                outside the app.
              </p>
              <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-slate-50/80 px-3.5 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-slate-500" />
                <p>
                  Only data owned by <span className="font-medium text-slate-900">{auth.user?.email}</span>{' '}
                  is included in this export.
                </p>
              </div>
            </div>
            {exportMutation.isError ? (
              <InlineError
                message={getApiErrorMessage(
                  exportMutation.error,
                  'The export request failed. Please try again after the API is reachable.',
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
              {exportMutation.isPending ? 'Preparing export...' : 'Download JSON export'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>
              Workspace-level defaults for reminders and formatting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>Reminder cadence and notification defaults.</p>
            <p>Locale, currency, and date presentation.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
