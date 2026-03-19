import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/hooks/use-auth';

export function SettingsPage() {
  const auth = useAuth();

  return (
    <PageContainer>
      <PageTitle
        description="Keep account details visible and leave deeper preferences lightweight until concrete workflows demand them."
        title="Settings"
      />

      <div className="grid gap-6 md:grid-cols-2">
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
