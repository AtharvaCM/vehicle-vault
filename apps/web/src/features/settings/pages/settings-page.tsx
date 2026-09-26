import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { BellRing, ChevronRight, Download, History, ScanSearch, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { InlineError } from '@/components/shared/inline-error';
import { PageTitle } from '@/components/shared/page-title';
import { StatusPill } from '@/components/shared/status-pill';
import { Button, buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { accountSecurityQueryOptions } from '../api/account-security';
import { ChangePasswordDialog } from '../components/change-password-dialog';
import { DeleteAccountDialog } from '../components/delete-account-dialog';
import { NameRow } from '../components/name-row';
import { SessionRows } from '../components/session-rows';
import { SettingsRow, SettingsSection } from '../components/settings-layout';
import { useDownloadAccountExport } from '../hooks/use-download-account-export';
import { useReconcileAttachments } from '../hooks/use-reconcile-attachments';

/**
 * Settings as a directory (#315): Profile, Security, Notifications, and Data &
 * privacy, each row owning one decision.
 */
export function SettingsPage() {
  const auth = useAuth();
  const exportMutation = useDownloadAccountExport();
  const reconcileMutation = useReconcileAttachments();
  const security = useQuery(accountSecurityQueryOptions()).data;
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

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

  const provider = (name: 'google' | 'github') => (name === 'google' ? 'Google' : 'GitHub');
  const signInMethods = security
    ? [
        ...(security.hasPassword ? ['Email and password'] : []),
        ...security.oauthProviders.map(provider),
      ]
    : [];

  return (
    <PageContainer>
      <PageTitle description="Your account, how you sign in, and your data." title="Settings" />

      <div className="max-w-3xl space-y-6">
        <SettingsSection title="Profile">
          <NameRow />
          <SettingsRow
            label="Email"
            value={
              <span className="flex flex-wrap items-center gap-2 break-all">
                {auth.user?.email}
                {auth.user?.emailVerified ? (
                  <StatusPill status="ok">Verified</StatusPill>
                ) : (
                  <StatusPill status="soon">Not verified</StatusPill>
                )}
              </span>
            }
          />
        </SettingsSection>

        <SettingsSection title="Security">
          <SettingsRow
            action={
              security ? (
                <Button
                  onClick={() => setIsPasswordOpen(true)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {security.hasPassword ? 'Change' : 'Set a password'}
                  <ChevronRight aria-hidden="true" />
                </Button>
              ) : null
            }
            label="Password"
            value={security ? (security.hasPassword ? 'Set' : 'Not set yet') : 'Loading…'}
          />
          <SettingsRow
            label="Sign-in methods"
            value={signInMethods.length ? signInMethods.join(' · ') : security ? '—' : 'Loading…'}
          />
          <SessionRows />
        </SettingsSection>

        <SettingsSection title="Notifications">
          <SettingsRow
            action={
              <Link
                className={buttonVariants({ size: 'sm', variant: 'ghost' })}
                to="/settings/preferences"
              >
                <BellRing aria-hidden="true" />
                Preferences
                <ChevronRight aria-hidden="true" />
              </Link>
            }
            label="Alerts"
            value="What we tell you about, and where"
          />
        </SettingsSection>

        <SettingsSection title="Data & privacy">
          <SettingsRow
            action={
              <Link
                className={buttonVariants({ size: 'sm', variant: 'ghost' })}
                to="/settings/activity"
              >
                <History aria-hidden="true" />
                Activity log
                <ChevronRight aria-hidden="true" />
              </Link>
            }
            label="Activity"
            value="Every change and sign-in"
          />
          <SettingsRow
            action={
              <Button
                disabled={exportMutation.isPending}
                onClick={() => void handleExport()}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Download aria-hidden="true" />
                {exportMutation.isPending ? 'Preparing…' : 'Download JSON backup'}
              </Button>
            }
            label="Download your data"
            value="Vehicles, records, reminders and papers as JSON"
          />
          {/* An operations tool: reconciles stored-file entries with storage. */}
          {auth.user?.role === 'admin' ? (
            <SettingsRow
              action={
                <Button
                  disabled={reconcileMutation.isPending}
                  onClick={() => void handleReconcileAttachments()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ScanSearch aria-hidden="true" />
                  {reconcileMutation.isPending ? 'Checking…' : 'Check files'}
                </Button>
              }
              label="Stored files"
              value="Remove entries for receipts no longer in storage"
            />
          ) : null}
          <SettingsRow
            action={
              <Button
                onClick={() => setIsDeleteOpen(true)}
                size="sm"
                type="button"
                variant="destructive-outline"
              >
                <Trash2 aria-hidden="true" />
                Delete account
              </Button>
            }
            label="Delete your account"
            value="Everything you’ve added, gone at once"
          />
          {exportMutation.isError ? (
            <div className="px-5 py-3">
              <InlineError
                message={getApiErrorMessage(
                  exportMutation.error,
                  "We couldn't prepare your export. Try again in a moment.",
                )}
              />
            </div>
          ) : null}
        </SettingsSection>
      </div>

      <DeleteAccountDialog
        isExporting={exportMutation.isPending}
        onExport={() => void handleExport()}
        onOpenChange={setIsDeleteOpen}
        open={isDeleteOpen}
      />

      {security ? (
        <ChangePasswordDialog
          hasPassword={security.hasPassword}
          onOpenChange={setIsPasswordOpen}
          open={isPasswordOpen}
        />
      ) : null}
    </PageContainer>
  );
}
