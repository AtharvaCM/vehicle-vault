import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SettingsPage() {
  return (
    <PageContainer>
      <PageTitle
        description="Keep settings lightweight for now and add grouped preference sections only when concrete user workflows need them."
        title="Settings"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Reserved for profile and organization settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>Primary user details and ownership preferences will live here.</p>
            <p>Authentication is intentionally not connected yet.</p>
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
